"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Server, Globe, RefreshCw, Search, CheckCircle, XCircle,
  AlertTriangle, ExternalLink, Shield, Zap, Crown, Eye,
  ChevronDown, Wifi,
} from "lucide-react";
import { ListRowSkeleton, StatSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface DomainEntry {
  domain: string;
  whmcs_client_id: number;
  client_name: string;
  whmcs_plan: string;
  whmcs_product_name: string;
  whmcs_status: string;
  has_tenant: boolean;
  tenant_id: string | null;
  tenant_plan: string | null;
  plugin_status: string;
  connector_version: string | null;
  last_heartbeat: string | null;
}

interface ScanStats {
  total_domains: number;
  with_plugin: number;
  without_plugin: number;
  tenant_inactive: number;
  pro_without_plugin: number;
  coverage_pct: number;
  scanned_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  installed_active: { label: "Actief", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle },
  tenant_exists_no_plugin: { label: "Geen Plugin", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: AlertTriangle },
  not_installed: { label: "Niet Geïnstalleerd", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
  tenant_inactive: { label: "Inactief", color: "text-white/30 bg-white/5 border-white/10", icon: XCircle },
};

const PLAN_COLORS: Record<string, string> = {
  pro_plus: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  pro: "bg-brand-500/20 text-brand-400 border-brand-500/30",
  tiny: "bg-white/10 text-white/40 border-white/10",
  unknown: "bg-white/5 text-white/20 border-white/5",
  domain_only: "bg-white/5 text-white/20 border-white/5",
};

export default function ServerPage() {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [probing, setProbing] = useState<Record<string, boolean>>({});
  const [probeResults, setProbeResults] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/api/admin/server/domains`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) {
        const d = await r.json();
        if (d.error) { setError(d.error); }
        else { setDomains(d.domains || []); setStats(d.stats || null); }
      }
    } catch {}
    setLoading(false);
  }

  async function forceScan() {
    setScanning(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/server/domains/scan`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        const d = await r.json();
        setDomains(d.domains || []);
        setStats(d.stats || null);
      }
    } catch {}
    setScanning(false);
  }

  async function probeDomain(domain: string) {
    setProbing(prev => ({ ...prev, [domain]: true }));
    try {
      const r = await fetch(`${API_URL}/api/admin/server/domains/${encodeURIComponent(domain)}/probe`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        const d = await r.json();
        setProbeResults(prev => ({ ...prev, [domain]: d }));
      }
    } catch {}
    setProbing(prev => ({ ...prev, [domain]: false }));
  }

  const filtered = domains.filter(d => {
    if (filter === "active") return d.plugin_status === "installed_active";
    if (filter === "gaps") return d.plugin_status !== "installed_active";
    if (filter === "pro_gaps") return d.whmcs_plan in ["pro", "pro_plus"] && d.plugin_status !== "installed_active";
    if (search) {
      const q = search.toLowerCase();
      return d.domain.toLowerCase().includes(q) || d.client_name.toLowerCase().includes(q);
    }
    return true;
  }).filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.domain.toLowerCase().includes(q) || d.client_name.toLowerCase().includes(q);
  });

  // Sort: PRO gaps first, then other gaps, then active
  const planPriority: Record<string, number> = { pro_plus: 0, pro: 1, tiny: 2, unknown: 3, domain_only: 4 };
  const statusPriority: Record<string, number> = { not_installed: 0, tenant_exists_no_plugin: 1, tenant_inactive: 2, installed_active: 3 };
  const sorted = [...filtered].sort((a, b) =>
    (statusPriority[a.plugin_status] ?? 9) - (statusPriority[b.plugin_status] ?? 9) ||
    (planPriority[a.whmcs_plan] ?? 9) - (planPriority[b.whmcs_plan] ?? 9)
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Server className="h-6 w-6 text-brand-400" /> Server Overzicht
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Alle domeinen op onze server — plugin adoptie & gap detectie
          </p>
        </div>
        <button
          onClick={forceScan}
          disabled={scanning}
          className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-4 py-2 text-xs font-medium text-brand-400 transition hover:bg-brand-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Scan Server"}
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mt-6"><StatSkeleton count={5} cols="grid-cols-2 sm:grid-cols-5" /></div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-red-400">{error}</p>
          <p className="mt-1 text-xs text-white/30">Configureer WHMCS credentials in de backend .env</p>
        </div>
      ) : stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Totaal Domeinen</div>
            <p className="mt-1 text-2xl font-bold">{stats.total_domains}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="text-[10px] text-green-400/60 uppercase tracking-wider">Met Plugin</div>
            <p className="mt-1 text-2xl font-bold text-green-400">{stats.with_plugin}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="text-[10px] text-red-400/60 uppercase tracking-wider">Zonder Plugin</div>
            <p className="mt-1 text-2xl font-bold text-red-400">{stats.without_plugin}</p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-[10px] text-purple-400/60 uppercase tracking-wider">PRO Zonder</div>
            <p className="mt-1 text-2xl font-bold text-purple-400">{stats.pro_without_plugin}</p>
          </div>
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
            <div className="text-[10px] text-brand-400/60 uppercase tracking-wider">Dekking</div>
            <p className="mt-1 text-2xl font-bold text-brand-400">{stats.coverage_pct}%</p>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/5">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${stats.coverage_pct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            placeholder="Zoek op domein of klant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/30"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { key: "all", label: "Alles", count: domains.length },
            { key: "gaps", label: "🔴 Gaps", count: domains.filter(d => d.plugin_status !== "installed_active").length },
            { key: "pro_gaps", label: "👑 PRO Gaps", count: domains.filter(d => ["pro", "pro_plus"].includes(d.whmcs_plan) && d.plugin_status !== "installed_active").length },
            { key: "active", label: "✅ Actief", count: domains.filter(d => d.plugin_status === "installed_active").length },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-2 text-[11px] font-medium transition whitespace-nowrap ${
                filter === f.key ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"
              }`}
            >
              {f.label} <span className="ml-1 opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Domain List */}
      {loading ? (
        <div className="mt-6"><ListRowSkeleton count={8} /></div>
      ) : sorted.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Globe className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-sm text-white/30">Geen domeinen gevonden</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {sorted.map(d => {
            const sc = STATUS_CONFIG[d.plugin_status] || STATUS_CONFIG.not_installed;
            const StatusIcon = sc.icon;
            const probe = probeResults[d.domain];
            const isPro = d.whmcs_plan === "pro" || d.whmcs_plan === "pro_plus";

            return (
              <div
                key={d.domain}
                className={`rounded-xl border p-4 transition ${
                  d.plugin_status === "installed_active"
                    ? "border-white/5 bg-white/[0.02]"
                    : isPro
                    ? "border-purple-500/15 bg-purple-500/[0.02]"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Status icon */}
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${sc.color}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>

                  {/* Domain + Client */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate">{d.domain}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${PLAN_COLORS[d.whmcs_plan] || PLAN_COLORS.unknown}`}>
                        {d.whmcs_plan === "pro_plus" ? "PRO+" : d.whmcs_plan}
                      </span>
                      {d.whmcs_status && d.whmcs_status !== "Active" && (
                        <span className="rounded-full bg-yellow-500/10 px-1.5 py-0.5 text-[9px] text-yellow-400">{d.whmcs_status}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/30 truncate">
                      {d.client_name} · {d.whmcs_product_name}
                      {d.connector_version && <span className="ml-2 text-green-400/50">v{d.connector_version}</span>}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {d.tenant_id && (
                      <Link
                        href={`/admin/tenants/${d.tenant_id}`}
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/40 transition hover:bg-white/10 hover:text-white"
                      >
                        <Eye className="h-3 w-3" />
                      </Link>
                    )}
                    {d.plugin_status !== "installed_active" && (
                      <button
                        onClick={() => probeDomain(d.domain)}
                        disabled={probing[d.domain]}
                        className="rounded-lg bg-brand-500/10 px-3 py-1.5 text-[10px] font-medium text-brand-400 transition hover:bg-brand-500/20 disabled:opacity-50"
                        title="Probe domein voor plugin"
                      >
                        {probing[d.domain] ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wifi className="h-3 w-3" />
                        )}
                      </button>
                    )}
                    <a
                      href={`https://${d.domain}`}
                      target="_blank"
                      rel="noopener"
                      className="text-white/20 hover:text-brand-400 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Probe result */}
                {probe && (
                  <div className="mt-2 rounded-lg bg-white/[0.03] p-2 text-[10px]">
                    {probe.installed ? (
                      <span className="text-green-400">✅ Plugin gevonden — v{probe.version} · {probe.site}</span>
                    ) : (
                      <span className="text-red-400/70">❌ Plugin niet bereikbaar{probe.error ? `: ${probe.error}` : probe.status_code ? ` (HTTP ${probe.status_code})` : ""}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {stats?.scanned_at && (
        <p className="mt-6 text-center text-[10px] text-white/15">
          Laatste scan: {new Date(stats.scanned_at).toLocaleString("nl-BE")} · {sorted.length} van {domains.length} domeinen
        </p>
      )}
    </div>
  );
}
