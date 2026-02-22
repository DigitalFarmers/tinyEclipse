"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Globe,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  MessageSquare,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Zap,
  TrendingUp,
  Eye,
  Database,
  Send,
  Bot,
  User,
  Copy,
  Check,
  Brain,
  Clock,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { getTenants, getMonitoringDashboard, getAnalytics, getOverview, getConversations, getSources, getWpCapabilities, getContactStats, getLeadStats, getModuleEvents } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Tenant {
  id: string;
  name: string;
  domain: string;
  plan: string;
  status: string;
  environment?: string;
}

interface MonitorData {
  overall_status: string;
  stats: { total_checks: number; ok: number; warning: number; critical: number };
  checks: any[];
  recent_alerts: any[];
}

interface AnalyticsData {
  summary: {
    total_sessions: number;
    total_pageviews: number;
    bounce_rate: number;
    conversion_rate: number;
    chat_engagement_rate: number;
    avg_duration_seconds: number;
    avg_pages_per_session: number;
  };
}

interface ConvSummary {
  id: string;
  tenant_id: string;
  session_id: string;
  status: string;
  created_at: string;
  message_count: number;
}

export default function DashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [monitorMap, setMonitorMap] = useState<Record<string, MonitorData>>({});
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, AnalyticsData>>({});
  const [sourcesMap, setSourcesMap] = useState<Record<string, number>>({});
  const [capsMap, setCapsMap] = useState<Record<string, any>>({});
  const [modulesMap, setModulesMap] = useState<Record<string, any[]>>({});
  const [contactStats, setContactStats] = useState<any>(null);
  const [leadStats, setLeadStats] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [recentConvos, setRecentConvos] = useState<ConvSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatTenant, setChatTenant] = useState<Tenant | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [tenantList, overviewData] = await Promise.all([
        getTenants().catch(() => []),
        getOverview().catch(() => null),
      ]);
      setTenants(tenantList);
      setOverview(overviewData);

      const monMap: Record<string, MonitorData> = {};
      const anaMap: Record<string, AnalyticsData> = {};
      const srcMap: Record<string, number> = {};
      const capMap: Record<string, any> = {};
      const modMap: Record<string, any[]> = {};
      const allConvos: ConvSummary[] = [];

      const [cStats, lStats] = await Promise.all([
        getContactStats().catch(() => null),
        getLeadStats().catch(() => null),
      ]);
      setContactStats(cStats);
      setLeadStats(lStats);

      await Promise.all(
        tenantList.map(async (t: Tenant) => {
          try { monMap[t.id] = await getMonitoringDashboard(t.id); } catch {}
          try { anaMap[t.id] = await getAnalytics(t.id, 24); } catch {}
          try { const s = await getSources(t.id); srcMap[t.id] = s.length; } catch {}
          try { const c = await getConversations(t.id); allConvos.push(...c.slice(0, 3)); } catch {}
          try { capMap[t.id] = await getWpCapabilities(t.id); } catch {}
          try { modMap[t.id] = await getModuleEvents(t.id, 168); } catch {}
        })
      );
      setMonitorMap(monMap);
      setAnalyticsMap(anaMap);
      setSourcesMap(srcMap);
      setCapsMap(capMap);
      setModulesMap(modMap);
      allConvos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentConvos(allConvos.slice(0, 8));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const prodTenants = tenants.filter(t => t.environment !== "staging");
  const totalChecks = Object.values(monitorMap).reduce((a, m) => a + m.stats.total_checks, 0);
  const totalOk = Object.values(monitorMap).reduce((a, m) => a + m.stats.ok, 0);
  const totalWarning = Object.values(monitorMap).reduce((a, m) => a + m.stats.warning, 0);
  const totalCritical = Object.values(monitorMap).reduce((a, m) => a + m.stats.critical, 0);
  const totalVisitors = Object.values(analyticsMap).reduce((a, an) => a + (an?.summary?.total_sessions || 0), 0);
  const totalPageviews = Object.values(analyticsMap).reduce((a, an) => a + (an?.summary?.total_pageviews || 0), 0);
  const totalSources = Object.values(sourcesMap).reduce((a, n) => a + n, 0);

  const tenantName = (id: string) => tenants.find(t => t.id === id)?.name || id.slice(0, 8);

  // Priority sorting: critical first, then warning, then healthy
  const getPriority = (t: Tenant) => {
    const m = monitorMap[t.id];
    if (m?.stats?.critical > 0) return 0; // CRITICAL
    if (m?.stats?.warning > 0) return 1; // WARNING
    const connected = capsMap[t.id] && !capsMap[t.id]?.error && capsMap[t.id]?.wordpress;
    if (!connected) return 2; // NO CONNECTOR
    return 3; // HEALTHY
  };
  const sortedProdTenants = [...prodTenants].sort((a, b) => getPriority(a) - getPriority(b));

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
        <h2 className="text-lg font-semibold text-red-400">Connection Error</h2>
        <p className="mt-2 text-sm text-red-300/70">{error}</p>
        <p className="mt-1 text-xs text-white/30">Check API connection at {API_URL}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-white/40">Eclipse HUB — alle sites op één plek</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && !tenants.length ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Loading Eclipse HUB...</span>
        </div>
      ) : (
        <>
          {/* ─── Stat Cards ─── */}
          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            <StatCard icon={Globe} label="Websites" value={prodTenants.length} color="brand" />
            <StatCard
              icon={totalCritical > 0 ? ShieldAlert : ShieldCheck}
              label="Monitoring"
              value={`${totalOk}/${totalChecks}`}
              sub={totalCritical > 0 ? `${totalCritical} critical` : "Healthy"}
              color={totalCritical > 0 ? "red" : totalWarning > 0 ? "yellow" : "green"}
            />
            <StatCard icon={Eye} label="Bezoekers" value={totalVisitors} sub="24h" color="purple" />
            <StatCard icon={TrendingUp} label="Pageviews" value={totalPageviews} sub="24h" color="blue" />
            <StatCard
              icon={MessageSquare}
              label="Gesprekken"
              value={overview?.today?.conversations || 0}
              sub={overview?.today?.escalations ? `${overview.today.escalations} esc.` : "vandaag"}
              color={overview?.today?.escalations > 0 ? "red" : "brand"}
            />
            <StatCard icon={Database} label="Kennisbronnen" value={totalSources} color="green" />
            <StatCard icon={Users} label="Contacts" value={contactStats?.total || 0} sub={contactStats?.today ? `+${contactStats.today} vandaag` : ""} color="brand" />
            <StatCard icon={Zap} label="Leads" value={leadStats?.total || 0} sub={leadStats?.this_week ? `+${leadStats.this_week} deze week` : ""} color="purple" />
          </div>

          {/* ─── Main Grid: Websites + Activity ─── */}
          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            {/* Websites Column */}
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/25">
                  Websites ({prodTenants.length})
                </h2>
                <Link href="/admin/tenants" className="text-[11px] text-brand-400 hover:text-brand-300 transition">
                  Alle websites →
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedProdTenants.map((tenant) => (
                  <WebsiteCard
                    key={tenant.id}
                    tenant={tenant}
                    monitor={monitorMap[tenant.id]}
                    analytics={analyticsMap[tenant.id]}
                    sources={sourcesMap[tenant.id] || 0}
                    caps={capsMap[tenant.id]}
                    events={modulesMap[tenant.id] || []}
                    onTestChat={() => setChatTenant(tenant)}
                  />
                ))}
                {prodTenants.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-12 text-center">
                    <Globe className="mx-auto h-8 w-8 text-white/20" />
                    <p className="mt-3 text-sm text-white/40">Nog geen websites</p>
                    <Link href="/admin/tenants" className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium transition hover:bg-brand-500">
                      <Zap className="h-3 w-3" /> Toevoegen
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Sidebar */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/25">
                  Recente Activiteit
                </h2>
                <Link href="/admin/conversations" className="text-[11px] text-brand-400 hover:text-brand-300 transition">
                  Alle chats →
                </Link>
              </div>
              <div className="space-y-2">
                {recentConvos.length > 0 ? recentConvos.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/conversations?id=${c.id}`}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      c.status === "escalated" ? "bg-red-500/10" : "bg-brand-500/10"
                    }`}>
                      <MessageSquare className={`h-3.5 w-3.5 ${c.status === "escalated" ? "text-red-400" : "text-brand-400"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold truncate">{tenantName(c.tenant_id)}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          c.status === "escalated" ? "bg-red-500/20 text-red-400" : c.status === "active" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
                        }`}>{c.status}</span>
                      </div>
                      <p className="text-[10px] text-white/30">{c.message_count} berichten · {timeAgo(c.created_at)}</p>
                    </div>
                    <ChevronRight className="h-3 w-3 flex-shrink-0 text-white/15" />
                  </Link>
                )) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                    <MessageSquare className="mx-auto h-6 w-6 text-white/15" />
                    <p className="mt-2 text-[11px] text-white/30">Nog geen gesprekken</p>
                  </div>
                )}
              </div>

              {/* Quick Links */}
              <div className="mt-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/25">
                  ⚡ Snelle Acties
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: "/admin/commander", emoji: "🖥️", label: "Commander", desc: "Site beheer", hover: "hover:border-brand-500/20 hover:bg-brand-500/5 hover:text-brand-400" },
                    { href: "/admin/conversations", emoji: "💬", label: "Gesprekken", desc: "AI chats", hover: "hover:border-green-500/20 hover:bg-green-500/5 hover:text-green-400" },
                    { href: "/admin/sources", emoji: "📚", label: "Kennisbank", desc: "AI bronnen", hover: "hover:border-purple-500/20 hover:bg-purple-500/5 hover:text-purple-400" },
                    { href: "/admin/contacts", emoji: "👥", label: "Contacten", desc: "CRM", hover: "hover:border-blue-500/20 hover:bg-blue-500/5 hover:text-blue-400" },
                    { href: "/admin/site-manager", emoji: "🛒", label: "Site Manager", desc: "Shop & Forms", hover: "hover:border-yellow-500/20 hover:bg-yellow-500/5 hover:text-yellow-400" },
                    { href: "/admin/clients", emoji: "🏢", label: "Klanten", desc: "Accounts", hover: "hover:border-cyan-500/20 hover:bg-cyan-500/5 hover:text-cyan-400" },
                    { href: "/admin/monitoring", emoji: "📡", label: "Monitoring", desc: "Uptime & SSL", hover: "hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-400" },
                    { href: "/admin/insights", emoji: "🧠", label: "AI Insights", desc: "Analyse", hover: "hover:border-pink-500/20 hover:bg-pink-500/5 hover:text-pink-400" },
                  ].map((a) => (
                    <Link key={a.href} href={a.href} className={`flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition ${a.hover}`}>
                      <span className="text-base">{a.emoji}</span>
                      <div>
                        <p className="text-[11px] font-semibold">{a.label}</p>
                        <p className="text-[9px] text-white/25">{a.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── Live Chat Tester Modal ─── */}
      {chatTenant && (
        <ChatTester tenant={chatTenant} onClose={() => setChatTenant(null)} />
      )}
    </div>
  );
}

/* ─── Live Chat Tester ─── */
function ChatTester({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string; confidence?: number; escalated?: boolean }>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/consent/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id, session_id: sessionId, accepted: true }),
    }).catch(() => {});
  }, [tenant.id, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant.id, session_id: sessionId, message: msg }),
      });
      if (r.ok) {
        const d = await r.json();
        setMessages(prev => [...prev, { role: "assistant", content: d.message, confidence: d.confidence, escalated: d.escalated }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: kon geen antwoord ophalen." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: verbinding mislukt." }]);
    } finally {
      setSending(false);
    }
  }

  const confColor = (c: number) => c >= 0.7 ? "text-green-400" : c >= 0.4 ? "text-yellow-400" : "text-red-400";
  const confBg = (c: number) => c >= 0.7 ? "bg-green-500" : c >= 0.4 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[600px] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-brand-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Live AI Tester</h3>
              <p className="text-[10px] text-white/40">{tenant.name} · {tenant.domain}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Sparkles className="mx-auto h-8 w-8 text-brand-500/30" />
                <p className="mt-3 text-sm text-white/30">Test de AI-assistent van {tenant.name}</p>
                <p className="mt-1 text-[11px] text-white/20">Stel een vraag zoals een bezoeker dat zou doen</p>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role !== "user" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                  <Bot className="h-3.5 w-3.5 text-brand-400" />
                </div>
              )}
              <div className={`max-w-[80%] ${m.role === "user" ? "order-first" : ""}`}>
                <div className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-brand-600 text-white"
                    : m.escalated
                    ? "border border-red-500/20 bg-red-500/5 text-white/80"
                    : "border border-white/5 bg-white/[0.03] text-white/80"
                }`}>
                  {m.content}
                </div>
                {m.confidence !== undefined && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 w-16 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${confBg(m.confidence)} transition-all`} style={{ width: `${m.confidence * 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-semibold ${confColor(m.confidence)}`}>
                      {Math.round(m.confidence * 100)}%
                    </span>
                    {m.escalated && <span className="text-[10px] font-semibold text-red-400">ESCALATED</span>}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <User className="h-3.5 w-3.5 text-white/50" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                <Bot className="h-3.5 w-3.5 text-brand-400" />
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/5 p-3">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Stel een vraag..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/30"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-white transition hover:bg-brand-500 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({
  icon: Icon, label, value, sub, color = "brand",
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20",
    green: "from-green-500/10 to-green-600/5 border-green-500/20",
    red: "from-red-500/10 to-red-600/5 border-red-500/20",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
  };
  const iconColors: Record<string, string> = {
    brand: "text-brand-500", green: "text-green-400", red: "text-red-400",
    yellow: "text-yellow-400", purple: "text-purple-400", blue: "text-blue-400",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 sm:p-4 ${colors[color]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColors[color]}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

/* ─── Website Card ─── */
function WebsiteCard({
  tenant, monitor, analytics, sources, caps, events, onTestChat,
}: {
  tenant: Tenant; monitor?: MonitorData; analytics?: AnalyticsData; sources: number; caps?: any; events?: any[]; onTestChat: () => void;
}) {
  const connected = caps && !caps.error && caps.wordpress;
  const connectorVersion = caps?.woocommerce ? 'v5 WC' : caps?.wordpress ? 'v5' : null;
  const recentEvents = (events || []).slice(0, 3);
  const statusColor =
    monitor?.overall_status === "critical" ? "bg-red-500"
    : monitor?.overall_status === "warning" ? "bg-yellow-500"
    : monitor?.overall_status === "healthy" ? "bg-green-500"
    : "bg-white/20";

  const planBadge: Record<string, string> = {
    tiny: "bg-white/10 text-white/50",
    pro: "bg-brand-500/20 text-brand-400",
    pro_plus: "bg-purple-500/20 text-purple-400",
  };

  // Priority level
  const isCritical = (monitor?.stats?.critical ?? 0) > 0;
  const isWarning = (monitor?.stats?.warning ?? 0) > 0;
  const borderColor = isCritical
    ? "border-red-500/30 bg-red-500/[0.02]"
    : isWarning
    ? "border-yellow-500/20 bg-yellow-500/[0.02]"
    : !connected
    ? "border-orange-500/15 bg-orange-500/[0.01]"
    : "border-white/5 bg-white/[0.02]";

  return (
    <div className={`group rounded-2xl border p-4 transition hover:border-white/10 hover:bg-white/[0.04] ${borderColor}`}>
      {/* Priority Badge — clickable with specific action */}
      {isCritical && (
        <Link href={`/admin/alerts?tenant=${tenant.id}`} className="mb-2 flex items-center justify-between rounded-lg bg-red-500/10 px-2.5 py-1.5 transition hover:bg-red-500/15">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400">
            <ShieldAlert className="h-3 w-3" /> {monitor?.stats?.critical} critical check{(monitor?.stats?.critical ?? 0) > 1 ? 's' : ''} failing
          </div>
          <span className="text-[9px] text-red-400/60">Bekijk alerts →</span>
        </Link>
      )}
      {!isCritical && isWarning && (
        <Link href={`/admin/monitoring?tenant=${tenant.id}`} className="mb-2 flex items-center justify-between rounded-lg bg-yellow-500/10 px-2.5 py-1.5 transition hover:bg-yellow-500/15">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-400">
            <Shield className="h-3 w-3" /> {monitor?.stats?.warning} warning{(monitor?.stats?.warning ?? 0) > 1 ? 's' : ''} — aandacht nodig
          </div>
          <span className="text-[9px] text-yellow-400/60">Bekijk checks →</span>
        </Link>
      )}
      {!isCritical && !isWarning && !connected && (
        <Link href={`/admin/tenants/${tenant.id}`} className="mb-2 flex items-center justify-between rounded-lg bg-orange-500/10 px-2.5 py-1.5 transition hover:bg-orange-500/15">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-400">
            <Zap className="h-3 w-3" /> Connector niet bereikbaar
          </div>
          <span className="text-[9px] text-orange-400/60">Configureer →</span>
        </Link>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <Link href={`/admin/tenants/${tenant.id}`} className="flex items-center gap-3 hover:opacity-80">
          <div className="relative">
            <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
            {statusColor === "bg-green-500" && (
              <div className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-green-500/40" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">{tenant.name}</h3>
            <p className="text-[11px] text-white/30">{tenant.domain || "Geen domein"}</p>
          </div>
        </Link>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${planBadge[tenant.plan] || planBadge.tiny}`}>
          {tenant.plan.replace("_", "+").toUpperCase()}
        </span>
      </div>

      {/* Health Bar */}
      {monitor && (
        <div className="mt-3 flex gap-1">
          {monitor.checks.slice(0, 6).map((check: any) => (
            <div
              key={check.id}
              title={`${check.type}: ${check.status}${check.response_time_ms ? ` (${check.response_time_ms}ms)` : ""}`}
              className="group/check relative flex-1"
            >
              <div className={`h-1.5 rounded-full transition ${
                check.status === "ok" ? "bg-green-500/60 group-hover/check:bg-green-500"
                : check.status === "warning" ? "bg-yellow-500/60 group-hover/check:bg-yellow-500"
                : check.status === "critical" ? "bg-red-500/60 group-hover/check:bg-red-500"
                : "bg-white/10"
              }`} />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover/check:block rounded bg-black/80 px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap z-10">
                {check.type}{check.response_time_ms ? `: ${check.response_time_ms}ms` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Connector Status */}
      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${connected ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-white/25'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-white/20'}`} />
          {connected ? connectorVersion : 'No connector'}
        </span>
        {caps?.woocommerce && <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">Shop</span>}
        {caps?.wpml && <span className="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">WPML</span>}
        {caps?.fluent_forms && <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">Forms</span>}
      </div>

      {/* Stats Row */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <MiniStat icon={Eye} label="Bezoekers" value={analytics?.summary?.total_sessions || 0} />
        <MiniStat icon={TrendingUp} label="Views" value={analytics?.summary?.total_pageviews || 0} />
        <MiniStat icon={Database} label="Bronnen" value={sources} />
        <MiniStat icon={MessageSquare} label="Events" value={recentEvents.length} />
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-1.5">
        <Link
          href={`/admin/tenants/${tenant.id}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 py-1.5 text-[10px] font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Activity className="h-3 w-3" /> Details
        </Link>
        <Link
          href={`/admin/monitoring?tenant=${tenant.id}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 py-1.5 text-[10px] font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Shield className="h-3 w-3" /> Monitor
        </Link>
        <button
          onClick={onTestChat}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-500/10 py-1.5 text-[10px] font-medium text-brand-400 transition hover:bg-brand-500/20"
        >
          <Bot className="h-3 w-3" /> Test AI
        </button>
        {tenant.domain && (
          <a
            href={`https://${tenant.domain}`}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center rounded-lg bg-white/5 px-2.5 py-1.5 text-white/30 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <Icon className="h-2.5 w-2.5 text-white/20" />
        <p className="text-[9px] text-white/25">{label}</p>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m geleden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u geleden`;
  return `${Math.floor(hrs / 24)}d geleden`;
}
