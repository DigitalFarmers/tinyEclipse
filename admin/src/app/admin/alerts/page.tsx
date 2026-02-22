"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell, ShieldAlert, CheckCircle, RefreshCw, AlertTriangle, XCircle,
  Filter, Globe, Wifi, Lock, Mail, FileText, Zap, Eye, Shield,
  ChevronDown, Search, Clock, ArrowUpRight,
} from "lucide-react";
import { getTenants, getAlerts, acknowledgeAlert, resolveAlert } from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; }
interface Alert {
  id: string; tenant_id: string; check_id: string; title: string;
  severity: string; message: string; created_at: string;
  acknowledged: boolean; resolved: boolean; resolved_at: string | null;
}

const CHECK_ICONS: Record<string, any> = {
  uptime: Wifi, ssl: Lock, dns: Globe, security_headers: Shield,
  forms: FileText, performance: Zap, content_change: Eye, smtp: Mail,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m geleden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u geleden`;
  const days = Math.floor(hrs / 24);
  return `${days}d geleden`;
}

export default function AlertsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => { loadAll(); }, [showResolved]);

  async function loadAll() {
    setLoading(true);
    try {
      const ts = await getTenants().catch(() => []);
      setTenants(ts);
      const all: Alert[] = [];
      await Promise.all(ts.map(async (t: Tenant) => {
        try {
          const a = await getAlerts(t.id, showResolved);
          all.push(...a.map((al: any) => ({ ...al, tenant_id: t.id })));
        } catch {}
      }));
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAlerts(all);
    } finally { setLoading(false); }
  }

  async function resolveAll() {
    const unresolved = filtered.filter(a => !a.resolved);
    if (!unresolved.length || !confirm(`${unresolved.length} alerts markeren als opgelost?`)) return;
    for (const a of unresolved) {
      try { await resolveAlert(a.id); } catch {}
    }
    await loadAll();
  }

  const tn = (id: string) => tenants.find((t) => t.id === id)?.name || id.slice(0, 8);
  const td = (id: string) => tenants.find((t) => t.id === id)?.domain || "";

  // Extract check type from title
  const checkType = (a: Alert) => {
    const match = a.title?.match(/^(\w+)\s+issue/i);
    return match ? match[1].toLowerCase() : "unknown";
  };

  // Filtered alerts
  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filterTenant !== "all" && a.tenant_id !== filterTenant) return false;
      if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
      if (filterType !== "all" && checkType(a) !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = tn(a.tenant_id).toLowerCase();
        const domain = td(a.tenant_id).toLowerCase();
        if (!a.message.toLowerCase().includes(q) && !a.title?.toLowerCase().includes(q) && !name.includes(q) && !domain.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, filterTenant, filterSeverity, filterType, search]);

  // Stats
  const totalOpen = alerts.filter(a => !a.resolved).length;
  const totalCritical = alerts.filter(a => !a.resolved && a.severity === "critical").length;
  const totalWarning = alerts.filter(a => !a.resolved && a.severity === "warning").length;
  const totalResolved = alerts.filter(a => a.resolved).length;

  // Unique check types
  const checkTypes = Array.from(new Set(alerts.map(a => checkType(a)))).filter(t => t !== "unknown");

  // Group by tenant for summary
  const tenantAlertCounts = useMemo(() => {
    const counts: Record<string, { open: number; critical: number }> = {};
    alerts.filter(a => !a.resolved).forEach(a => {
      if (!counts[a.tenant_id]) counts[a.tenant_id] = { open: 0, critical: 0 };
      counts[a.tenant_id].open++;
      if (a.severity === "critical") counts[a.tenant_id].critical++;
    });
    return counts;
  }, [alerts]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="h-6 w-6 text-brand-400" /> Alerts
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Monitoring alerts — {totalOpen} open, {totalCritical} critical
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalOpen > 0 && (
            <button onClick={resolveAll} className="rounded-lg bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400 transition hover:bg-green-500/20">
              ✓ Resolve All ({filtered.filter(a => !a.resolved).length})
            </button>
          )}
          <button onClick={loadAll} disabled={loading} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => { setFilterSeverity("all"); setShowResolved(false); }} className={`rounded-xl border p-4 text-left transition hover:border-white/10 ${filterSeverity === "all" && !showResolved ? "border-brand-500/30 bg-brand-500/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">🚨 Open</div>
          <p className="text-2xl font-bold mt-1">{totalOpen}</p>
        </button>
        <button onClick={() => { setFilterSeverity("critical"); setShowResolved(false); }} className={`rounded-xl border p-4 text-left transition hover:border-red-500/20 ${filterSeverity === "critical" ? "border-red-500/30 bg-red-500/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">🔴 Critical</div>
          <p className="text-2xl font-bold text-red-400 mt-1">{totalCritical}</p>
        </button>
        <button onClick={() => { setFilterSeverity("warning"); setShowResolved(false); }} className={`rounded-xl border p-4 text-left transition hover:border-yellow-500/20 ${filterSeverity === "warning" ? "border-yellow-500/30 bg-yellow-500/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">🟡 Warning</div>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{totalWarning}</p>
        </button>
        <button onClick={() => { setShowResolved(true); setFilterSeverity("all"); }} className={`rounded-xl border p-4 text-left transition hover:border-green-500/20 ${showResolved ? "border-green-500/30 bg-green-500/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">✅ Opgelost</div>
          <p className="text-2xl font-bold text-green-400 mt-1">{totalResolved}</p>
        </button>
      </div>

      {/* Per-site alert summary */}
      {Object.keys(tenantAlertCounts).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(tenantAlertCounts)
            .sort((a, b) => b[1].critical - a[1].critical || b[1].open - a[1].open)
            .map(([tid, counts]) => (
              <button
                key={tid}
                onClick={() => setFilterTenant(filterTenant === tid ? "all" : tid)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                  filterTenant === tid
                    ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                    : counts.critical > 0
                    ? "bg-red-500/5 text-red-400 border border-red-500/10 hover:bg-red-500/10"
                    : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"
                }`}
              >
                <Globe className="h-3 w-3" />
                {tn(tid)}
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${counts.critical > 0 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/40"}`}>
                  {counts.open}
                </span>
              </button>
            ))}
        </div>
      )}

      {/* Filters */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
          <input
            type="text"
            placeholder="Zoek op bericht, site of domein..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/30"
          />
        </div>
        {checkTypes.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterType("all")} className={`rounded-lg px-2.5 py-2 text-[10px] font-medium transition ${filterType === "all" ? "bg-brand-500/20 text-brand-400" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
              Alle types
            </button>
            {checkTypes.map(ct => {
              const Icon = CHECK_ICONS[ct] || Globe;
              return (
                <button key={ct} onClick={() => setFilterType(filterType === ct ? "all" : ct)} className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-medium transition ${filterType === ct ? "bg-brand-500/20 text-brand-400" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
                  <Icon className="h-3 w-3" /> {ct}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-green-500/40" />
          <p className="mt-3 text-sm text-white/40">
            {search || filterTenant !== "all" || filterType !== "all"
              ? "Geen alerts gevonden met deze filters"
              : showResolved ? "Geen opgeloste alerts" : "Geen actieve alerts — alles draait soepel! 🎉"}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {filtered.map((a) => {
            const ct = checkType(a);
            const CheckIcon = CHECK_ICONS[ct] || Globe;
            const domain = td(a.tenant_id);
            return (
              <div
                key={a.id}
                className={`rounded-xl border p-4 transition ${
                  a.resolved
                    ? "border-white/5 bg-white/[0.02] opacity-60"
                    : a.severity === "critical"
                    ? "border-red-500/20 bg-red-500/[0.03]"
                    : "border-yellow-500/20 bg-yellow-500/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">
                      {a.resolved
                        ? <CheckCircle className="h-5 w-5 text-green-400" />
                        : a.severity === "critical"
                        ? <XCircle className="h-5 w-5 text-red-400" />
                        : <AlertTriangle className="h-5 w-5 text-yellow-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold leading-snug ${a.resolved ? "text-white/50 line-through" : "text-white"}`}>
                        {a.title || a.message}
                      </p>
                      {a.title && a.message && a.message !== a.title && (
                        <p className="text-[11px] text-white/30 mt-0.5 line-clamp-2">{a.message}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link href={`/admin/tenants/${a.tenant_id}`} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60 hover:bg-white/15 hover:text-white transition">
                          <Globe className="h-2.5 w-2.5" /> {tn(a.tenant_id)}
                        </Link>
                        {domain && (
                          <a href={`https://${domain}`} target="_blank" rel="noopener" className="text-[10px] text-white/25 hover:text-brand-400 transition flex items-center gap-0.5">
                            {domain} <ArrowUpRight className="h-2.5 w-2.5" />
                          </a>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-white/30">
                          <CheckIcon className="h-2.5 w-2.5" /> {ct}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-white/20">
                          <Clock className="h-2.5 w-2.5" /> {timeAgo(a.created_at)}
                        </span>
                        {a.resolved && a.resolved_at && (
                          <span className="text-[10px] text-green-400/50">
                            ✓ opgelost {timeAgo(a.resolved_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {!a.resolved && (
                      <>
                        {!a.acknowledged && (
                          <button
                            onClick={async () => { await acknowledgeAlert(a.id); await loadAll(); }}
                            className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:bg-white/20"
                            title="Bevestig dat je deze alert hebt gezien"
                          >
                            👁️ Ack
                          </button>
                        )}
                        <button
                          onClick={async () => { await resolveAlert(a.id); await loadAll(); }}
                          className="rounded-lg bg-green-500/15 px-3 py-1.5 text-[11px] font-medium text-green-400 transition hover:bg-green-500/25"
                        >
                          ✓ Resolve
                        </button>
                      </>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      a.resolved
                        ? "bg-green-500/20 text-green-400"
                        : a.severity === "critical"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {a.resolved ? "✅" : a.severity === "critical" ? "🔴" : "🟡"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-[10px] text-white/15">
        {filtered.length} van {alerts.length} alerts · Elke alert moet opgelost worden
      </p>
    </div>
  );
}
