"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe, Users, MessageSquare, ShieldAlert, Shield, Database, Briefcase,
  ShoppingCart, Gift, FileText, Mail, BookOpen, Calendar, MessageCircle,
  Puzzle, RefreshCw, Eye, Zap, TrendingUp, Activity, ArrowUpRight,
  AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight,
  Play, ExternalLink, Bot, Target, Wifi, Lock, Server,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface MonitoringCheck {
  id: string;
  type: string;
  target: string;
  status: string;
  response_ms: number | null;
  last_checked: string | null;
  failures: number;
}

interface AlertItem {
  id: string;
  severity: string;
  title: string;
  message: string;
  created_at: string;
}

interface TenantSummary {
  tenant_id: string;
  name: string;
  domain: string;
  plan: string;
  status: string;
  environment?: string;
  whmcs_client_id: number;
  chats_24h: number;
  chats_7d: number;
  visitors_24h: number;
  visitors_7d: number;
  open_alerts: number;
  critical_alerts: number;
  escalations_7d: number;
  leads_30d: number;
  sources: number;
  modules: string[];
  health: string;
  monitoring: {
    total: number;
    ok: number;
    warning: number;
    critical: number;
    unknown: number;
    checks: MonitoringCheck[];
  };
  recent_alerts: AlertItem[];
}

interface SuperviewData {
  total_tenants: number;
  total_active: number;
  global_stats: {
    conversations_24h: number;
    conversations_7d: number;
    conversations_30d: number;
    visitors_24h: number;
    visitors_7d: number;
    open_alerts: number;
    resolved_alerts: number;
    total_sources: number;
    total_leads_30d: number;
    escalations_7d: number;
  };
  monitoring_health: {
    total_checks: number;
    ok: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  module_distribution: Record<string, number>;
  tenants: TenantSummary[];
}

const MODULE_EMOJI: Record<string, string> = {
  jobs: "💼", shop: "🛒", giftcard: "🎁", forms: "📋", mail: "📧",
  blog: "📝", booking: "📅", forum: "💬", custom: "🧩",
};

const CHECK_ICONS: Record<string, any> = {
  uptime: Wifi, ssl: Lock, dns: Globe, security_headers: Shield,
  forms: FileText, performance: Zap, content_change: Eye, smtp: Mail,
};

const HEALTH_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: any }> = {
  healthy: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "Healthy", icon: CheckCircle },
  warning: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Warning", icon: AlertTriangle },
  critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critical", icon: XCircle },
  unknown: { color: "text-white/30", bg: "bg-white/5", border: "border-white/10", label: "No Data", icon: Clock },
};

const PLAN_COLORS: Record<string, string> = {
  tiny: "bg-white/10 text-white/50",
  pro: "bg-brand-500/20 text-brand-400",
  pro_plus: "bg-purple-500/20 text-purple-400",
};

export default function AdminSuperviewPage() {
  const [data, setData] = useState<SuperviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [runningChecks, setRunningChecks] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/projects/admin/superview`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }

  async function runChecks(tenantId: string) {
    setRunningChecks(prev => ({ ...prev, [tenantId]: true }));
    try {
      await fetch(`${API_URL}/api/admin/monitoring/run/${tenantId}`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      setTimeout(() => loadData(), 3000);
    } catch {}
    setTimeout(() => setRunningChecks(prev => ({ ...prev, [tenantId]: false })), 5000);
  }

  async function setupMonitoring(tenantId: string) {
    try {
      await fetch(`${API_URL}/api/admin/monitoring/setup/${tenantId}`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      loadData();
    } catch {}
  }

  async function resolveAlert(alertId: string) {
    try {
      await fetch(`${API_URL}/api/admin/monitoring/alerts/${alertId}/resolve`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      loadData();
    } catch {}
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5"><div className="h-6 w-48 animate-pulse rounded bg-white/5" /><div className="h-3 w-32 animate-pulse rounded bg-white/[0.03]" /></div>
          <div className="h-8 w-24 animate-pulse rounded-lg bg-white/5" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="h-2 w-16 rounded bg-white/5" />
              <div className="mt-2 h-5 w-10 rounded bg-white/5" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/5" />
                <div className="flex-1 space-y-1.5"><div className="h-3.5 w-36 rounded bg-white/5" /><div className="h-2.5 w-52 rounded bg-white/[0.03]" /></div>
                <div className="h-5 w-16 rounded-full bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-white/40">Kon superview niet laden.</div>;
  }

  // Filter tenants
  const filtered = data.tenants.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.domain?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "critical") return t.health === "critical";
    if (filter === "warning") return t.health === "warning" || t.health === "critical";
    if (filter === "production") return t.environment !== "staging";
    if (filter === "staging") return t.environment === "staging";
    if (filter === "no_modules") return t.modules.length === 0;
    return true;
  });

  // Sort: critical first, then warning, then unknown, then healthy
  const sortPriority: Record<string, number> = { critical: 0, warning: 1, unknown: 2, healthy: 3 };
  const sorted = [...filtered].sort((a, b) => (sortPriority[a.health] ?? 9) - (sortPriority[b.health] ?? 9));

  const gs = data.global_stats;
  const mh = data.monitoring_health;
  const healthPct = mh.total_checks > 0 ? Math.round((mh.ok / mh.total_checks) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6 text-brand-400" />
            Superview
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Real-time command center — {data.total_active} actieve sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/alerts" className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/20">
            <ShieldAlert className="h-3.5 w-3.5" /> {gs.open_alerts} Alerts
          </Link>
          <button onClick={loadData} disabled={loading} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Global Health Bar */}
      <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60">Platform Health</h2>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${healthPct >= 80 ? "text-green-400" : healthPct >= 50 ? "text-yellow-400" : "text-red-400"}`}>{healthPct}%</span>
            <span className="text-[10px] text-white/30">uptime</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <MiniStat emoji="🌐" label="Sites" value={data.total_active} href="/admin/tenants" />
          <MiniStat emoji="👁️" label="Bezoekers 24h" value={gs.visitors_24h} sub={`${gs.visitors_7d} /7d`} href="/admin/analytics" />
          <MiniStat emoji="💬" label="Chats 24h" value={gs.conversations_24h} sub={`${gs.conversations_7d} /7d`} href="/admin/conversations" />
          <MiniStat emoji="🚨" label="Alerts" value={gs.open_alerts} color={gs.open_alerts > 0 ? "red" : "green"} href="/admin/alerts" />
          <MiniStat emoji="📡" label="Checks OK" value={mh.ok} sub={`/${mh.total_checks}`} color={mh.critical > 0 ? "red" : "green"} href="/admin/monitoring" />
          <MiniStat emoji="🎯" label="Leads 30d" value={gs.total_leads_30d} href="/admin/leads" />
          <MiniStat emoji="⚡" label="Escalaties" value={gs.escalations_7d} color={gs.escalations_7d > 0 ? "yellow" : "green"} href="/admin/conversations?status=escalated" />
          <MiniStat emoji="📚" label="Bronnen" value={gs.total_sources} href="/admin/sources" />
        </div>
      </div>

      {/* Filters + Search */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="🔍 Zoek op naam of domein..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/30"
        />
        <div className="flex gap-1.5">
          {[
            { key: "all", label: "Alles", count: data.tenants.length },
            { key: "critical", label: "🔴 Critical", count: data.tenants.filter(t => t.health === "critical").length },
            { key: "warning", label: "🟡 Warning", count: data.tenants.filter(t => t.health === "warning" || t.health === "critical").length },
            { key: "production", label: "🟢 Productie", count: data.tenants.filter(t => t.environment !== "staging").length },
            { key: "staging", label: "🟠 Staging", count: data.tenants.filter(t => t.environment === "staging").length },
            { key: "no_modules", label: "⚪ Geen modules", count: data.tenants.filter(t => t.modules.length === 0).length },
          ].map((f) => (
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

      {/* Tenant Cards */}
      <div className="mt-6 space-y-3">
        {sorted.map((t) => {
          const isStaging = t.environment === "staging";
          const hc = HEALTH_CONFIG[t.health] || HEALTH_CONFIG.unknown;
          const HealthIcon = hc.icon;
          const isExpanded = expanded[t.tenant_id];

          const isTiny = t.plan === "tiny";

          return (
            <div key={t.tenant_id} className={`rounded-2xl border transition ${hc.border} ${isStaging ? "opacity-60" : ""} ${isTiny && t.health === "healthy" ? "opacity-50 hover:opacity-80" : ""}`}>
              {/* Main Row */}
              <div className="p-4">
                <div className="flex items-center gap-4">
                  {/* Health indicator */}
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [t.tenant_id]: !prev[t.tenant_id] }))}
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${hc.bg} transition hover:scale-105`}
                    title={`${hc.label} — Click to expand`}
                  >
                    <HealthIcon className={`h-5 w-5 ${hc.color}`} />
                  </button>

                  {/* Name + Domain */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/tenants/${t.tenant_id}`} className="text-sm font-bold hover:text-brand-400 transition truncate">
                        {t.name}
                      </Link>
                      {isStaging && <span className="rounded-full bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">staging</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${PLAN_COLORS[t.plan] || PLAN_COLORS.tiny}`}>
                        {t.plan.replace("_", "+")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.domain && (
                        <a href={`https://${t.domain}`} target="_blank" rel="noopener" className="text-[11px] text-white/30 hover:text-brand-400 transition flex items-center gap-1">
                          {t.domain} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Health Bar */}
                  {t.monitoring.total > 0 && (
                    <div className="hidden lg:flex gap-0.5 items-center" title={`${t.monitoring.ok} OK · ${t.monitoring.warning} Warn · ${t.monitoring.critical} Crit`}>
                      {t.monitoring.checks.map((c) => (
                        <div
                          key={c.id}
                          className={`h-6 w-2 rounded-full transition ${
                            c.status === "ok" ? "bg-green-500/60" : c.status === "warning" ? "bg-yellow-500/60" : c.status === "critical" ? "bg-red-500/60" : "bg-white/10"
                          }`}
                          title={`${c.type}: ${c.status}${c.response_ms ? ` (${c.response_ms}ms)` : ""}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="hidden sm:flex items-center gap-4 text-[10px] text-white/40">
                    <Link href={`/admin/analytics?tenant=${t.tenant_id}`} className="flex items-center gap-1 hover:text-white/60 transition" title="Bezoekers 24h">
                      <Eye className="h-3 w-3" /> {t.visitors_24h}
                    </Link>
                    <Link href={`/admin/conversations?tenant_id=${t.tenant_id}`} className="flex items-center gap-1 hover:text-white/60 transition" title="Chats 24h">
                      <MessageSquare className="h-3 w-3" /> {t.chats_24h}
                    </Link>
                    {t.open_alerts > 0 && (
                      <Link href={`/admin/alerts?tenant=${t.tenant_id}`} className="flex items-center gap-1 text-red-400 hover:text-red-300 transition" title="Open alerts">
                        <ShieldAlert className="h-3 w-3" /> {t.open_alerts}
                      </Link>
                    )}
                    <span className="flex items-center gap-1" title="Kennisbronnen">
                      <Database className="h-3 w-3" /> {t.sources}
                    </span>
                  </div>

                  {/* Module badges (icons only) — only show if modules exist */}
                  {t.modules.length > 0 && (
                    <div className="hidden md:flex gap-1">
                      {t.modules.map((mod) => (
                        <span key={mod} className="text-sm" title={mod}>{MODULE_EMOJI[mod] || "🧩"}</span>
                      ))}
                    </div>
                  )}
                  {t.modules.length === 0 && (
                    <span className="hidden md:block text-[9px] text-white/15 italic">geen modules</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <Link href={`/admin/tenants/${t.tenant_id}`} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/40 transition hover:bg-white/10 hover:text-white">
                      <Activity className="h-3 w-3" />
                    </Link>
                    {t.monitoring.total > 0 ? (
                      <button
                        onClick={() => runChecks(t.tenant_id)}
                        disabled={runningChecks[t.tenant_id]}
                        className="rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-[10px] font-medium text-brand-400 transition hover:bg-brand-500/20 disabled:opacity-40"
                        title="Run all checks"
                      >
                        <Play className={`h-3 w-3 ${runningChecks[t.tenant_id] ? "animate-spin" : ""}`} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setupMonitoring(t.tenant_id)}
                        className="rounded-lg bg-green-500/10 px-2.5 py-1.5 text-[10px] font-medium text-green-400 transition hover:bg-green-500/20"
                        title="Setup monitoring"
                      >
                        <Zap className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [t.tenant_id]: !prev[t.tenant_id] }))}
                      className="rounded-lg bg-white/5 px-2 py-1.5 text-white/30 transition hover:bg-white/10 hover:text-white"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Critical alert banner */}
                {t.critical_alerts > 0 && t.recent_alerts.length > 0 && !isExpanded && (
                  <div className="mt-3 rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2">
                    <div className="flex items-center gap-2 text-[11px] text-red-400">
                      <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="font-semibold">{t.recent_alerts[0].title}</span>
                      <button onClick={() => resolveAlert(t.recent_alerts[0].id)} className="ml-auto rounded bg-red-500/20 px-2 py-0.5 text-[9px] font-bold hover:bg-red-500/30 transition">
                        Resolve
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="border-t border-white/5 p-4 bg-white/[0.01]">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Monitoring Checks */}
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-2">📡 Monitoring Checks</h4>
                      {t.monitoring.checks.length > 0 ? (
                        <div className="space-y-1.5">
                          {t.monitoring.checks.map((c) => {
                            const CheckIcon = CHECK_ICONS[c.type] || Globe;
                            const statusColor = c.status === "ok" ? "text-green-400" : c.status === "warning" ? "text-yellow-400" : c.status === "critical" ? "text-red-400" : "text-white/20";
                            return (
                              <Link key={c.id} href={`/admin/monitoring?tenant=${t.tenant_id}&check=${c.id}`} className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2 transition hover:bg-white/[0.06]">
                                <CheckIcon className={`h-3.5 w-3.5 ${statusColor}`} />
                                <span className="text-[11px] font-medium flex-1">{c.type.replace("_", " ")}</span>
                                {c.response_ms && <span className="text-[9px] text-white/25">{c.response_ms}ms</span>}
                                <span className={`h-2 w-2 rounded-full ${c.status === "ok" ? "bg-green-500" : c.status === "warning" ? "bg-yellow-500" : c.status === "critical" ? "bg-red-500" : "bg-white/20"}`} />
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-white/10 p-4 text-center">
                          <p className="text-[11px] text-white/30">Geen monitoring geconfigureerd</p>
                          <button onClick={() => setupMonitoring(t.tenant_id)} className="mt-2 rounded-lg bg-brand-500/10 px-3 py-1.5 text-[10px] font-medium text-brand-400 hover:bg-brand-500/20 transition">
                            ⚡ Setup Monitoring
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stats Detail */}
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-2">📊 Statistieken</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Link href={`/admin/analytics?tenant=${t.tenant_id}`} className="rounded-lg bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]">
                          <div className="text-[9px] text-white/25">👁️ Bezoekers 24h</div>
                          <div className="text-lg font-bold">{t.visitors_24h}</div>
                          <div className="text-[9px] text-white/20">{t.visitors_7d} /7d</div>
                        </Link>
                        <Link href={`/admin/conversations?tenant_id=${t.tenant_id}`} className="rounded-lg bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]">
                          <div className="text-[9px] text-white/25">💬 Chats 24h</div>
                          <div className="text-lg font-bold">{t.chats_24h}</div>
                          <div className="text-[9px] text-white/20">{t.chats_7d} /7d</div>
                        </Link>
                        <Link href={`/admin/leads?tenant_id=${t.tenant_id}`} className="rounded-lg bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]">
                          <div className="text-[9px] text-white/25">🎯 Leads 30d</div>
                          <div className="text-lg font-bold">{t.leads_30d}</div>
                        </Link>
                        <Link href={`/admin/sources?tenant_id=${t.tenant_id}`} className="rounded-lg bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]">
                          <div className="text-[9px] text-white/25">📚 Bronnen</div>
                          <div className="text-lg font-bold">{t.sources}</div>
                        </Link>
                      </div>
                    </div>

                    {/* Alerts + Actions */}
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-2">🚨 Alerts & Acties</h4>
                      {t.recent_alerts.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                          {t.recent_alerts.map((a) => (
                            <div key={a.id} className={`rounded-lg p-2 ${a.severity === "critical" ? "bg-red-500/5 border border-red-500/10" : "bg-yellow-500/5 border border-yellow-500/10"}`}>
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] mt-0.5">{a.severity === "critical" ? "🔴" : "🟡"}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium truncate">{a.title}</p>
                                  <p className="text-[9px] text-white/30 truncate">{a.message}</p>
                                </div>
                                <button onClick={() => resolveAlert(a.id)} className="rounded bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/50 hover:bg-white/20 hover:text-white transition flex-shrink-0">
                                  ✓ Fix
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-3 text-center mb-3">
                          <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                          <p className="text-[10px] text-green-400 mt-1">Geen open alerts</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <Link href={`/admin/tenants/${t.tenant_id}`} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/40 hover:bg-white/10 hover:text-white transition">
                          📋 Details
                        </Link>
                        <Link href={`/admin/conversations?tenant_id=${t.tenant_id}`} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/40 hover:bg-white/10 hover:text-white transition">
                          💬 Chats
                        </Link>
                        <Link href={`/admin/commander`} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/40 hover:bg-white/10 hover:text-white transition">
                          🖥️ Commander
                        </Link>
                        {t.domain && (
                          <a href={`https://${t.domain}/wp-admin/`} target="_blank" rel="noopener" className="rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-medium text-blue-400 hover:bg-blue-500/20 transition">
                            🔌 WP Admin
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="py-12 text-center text-sm text-white/30">
          Geen resultaten voor &quot;{search}&quot;
        </div>
      )}
    </div>
  );
}

function MiniStat({ emoji, label, value, sub, color, href }: {
  emoji: string; label: string; value: number; sub?: string; color?: string; href?: string;
}) {
  const colorClass = color === "red" ? "text-red-400" : color === "yellow" ? "text-yellow-400" : color === "green" ? "text-green-400" : "";
  const Wrapper = href ? Link : "div";
  const props = href ? { href } : {};
  return (
    <Wrapper {...(props as any)} className={`rounded-xl bg-white/[0.03] p-3 transition ${href ? "hover:bg-white/[0.06] cursor-pointer" : ""}`}>
      <div className="text-[9px] text-white/30 uppercase tracking-wider">{emoji} {label}</div>
      <p className={`text-xl font-bold mt-0.5 ${colorClass}`}>{value}</p>
      {sub && <p className="text-[9px] text-white/20">{sub}</p>}
    </Wrapper>
  );
}
