"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Globe,
  MessageSquare,
  Users,
  ShieldAlert,
  Zap,
  DollarSign,
  ArrowRight,
  Crown,
  Target,
  Wrench,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { getTenants } from "@/lib/api";
import { ListRowSkeleton, StatSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface Tenant {
  id: string;
  name: string;
  domain: string;
  whmcs_client_id?: number;
}

interface ClientOption {
  whmcs_client_id: number;
  name: string;
  tenant_count: number;
}

export default function InsightsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [period, setPeriod] = useState("week");
  const [mode, setMode] = useState<"global" | "client" | "site">("global");
  const [globalData, setGlobalData] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [siteData, setSiteData] = useState<any>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    getTenants().then((t) => {
      setTenants(t);
      if (t.length > 0) setSelectedTenant(t[0].id);
      // Build unique client list
      const clientMap: Record<number, { name: string; count: number }> = {};
      t.forEach((tenant: any) => {
        const cid = tenant.whmcs_client_id;
        if (cid) {
          if (!clientMap[cid]) clientMap[cid] = { name: tenant.name, count: 0 };
          clientMap[cid].count++;
        }
      });
      const cl = Object.entries(clientMap).map(([id, v]) => ({ whmcs_client_id: Number(id), name: v.name, tenant_count: v.count }));
      setClients(cl);
      if (cl.length > 0) setSelectedClient(cl[0].whmcs_client_id);
    });
  }, []);

  useEffect(() => {
    if (mode === "global") loadGlobal();
    else if (mode === "client" && selectedClient) loadClient();
    else if (mode === "site" && selectedTenant) loadSite();
  }, [mode, period, selectedTenant, selectedClient]);

  async function loadGlobal() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/insights/global?period=${period}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setGlobalData(await r.json());
    } catch {}
    setLoading(false);
  }

  async function loadClient() {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/insights/client/${selectedClient}?period=${period}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setClientData(await r.json());
    } catch {}
    setLoading(false);
  }

  async function loadSite() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/insights/${selectedTenant}/summary?period=${period}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setSiteData(await r.json());
    } catch {}
    setLoading(false);
  }

  async function loadSuggestions() {
    if (!selectedTenant) return;
    setLoadingSuggestions(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/insights/${selectedTenant}/suggestions`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setSuggestions(await r.json());
    } catch {}
    setLoadingSuggestions(false);
  }

  const PERIOD_LABELS: Record<string, string> = { day: "Vandaag", week: "Deze week", month: "Deze maand", year: "Dit jaar" };
  const IMPACT_COLORS: Record<string, string> = { high: "border-red-500/20 bg-red-500/5 text-red-400", medium: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400", low: "border-green-500/20 bg-green-500/5 text-green-400" };
  const CAT_ICONS: Record<string, any> = { seo: Target, content: Lightbulb, performance: Zap, security: ShieldAlert, conversion: DollarSign, ai: Brain, monitoring: ShieldAlert };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Brain className="h-6 w-6 text-brand-400" /> AI Insights
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Intelligente analyse & verbetervoorstellen</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-white/5">
            <button onClick={() => setMode("global")} className={`px-3 py-1.5 text-xs font-medium transition ${mode === "global" ? "bg-brand-600 text-white rounded-lg" : "text-white/50 hover:text-white"}`}>Globaal</button>
            <button onClick={() => setMode("client")} className={`px-3 py-1.5 text-xs font-medium transition ${mode === "client" ? "bg-brand-600 text-white rounded-lg" : "text-white/50 hover:text-white"}`}>Per Klant</button>
            <button onClick={() => setMode("site")} className={`px-3 py-1.5 text-xs font-medium transition ${mode === "site" ? "bg-brand-600 text-white rounded-lg" : "text-white/50 hover:text-white"}`}>Per Site</button>
          </div>
          {mode === "client" && (
            <select value={selectedClient} onChange={(e) => setSelectedClient(Number(e.target.value))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
              {clients.map((c) => <option key={c.whmcs_client_id} value={c.whmcs_client_id} className="bg-brand-950">{c.name} ({c.tenant_count} sites)</option>)}
            </select>
          )}
          {mode === "site" && (
            <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
              {tenants.map((t) => <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>)}
            </select>
          )}
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            <option value="day" className="bg-brand-950">Vandaag</option>
            <option value="week" className="bg-brand-950">Week</option>
            <option value="month" className="bg-brand-950">Maand</option>
            <option value="year" className="bg-brand-950">Jaar</option>
          </select>
          <button onClick={() => mode === "global" ? loadGlobal() : mode === "client" ? loadClient() : loadSite()} disabled={loading} className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="animate-pulse rounded-xl border border-brand-500/10 bg-brand-500/5 p-5"><div className="h-4 w-64 rounded bg-white/5" /><div className="mt-2 h-3 w-96 rounded bg-white/[0.03]" /></div>
          <StatSkeleton count={6} />
        </div>
      ) : mode === "global" && globalData ? (
        <GlobalView data={globalData} period={PERIOD_LABELS[period]} />
      ) : mode === "client" && clientData ? (
        <ClientView data={clientData} period={PERIOD_LABELS[period]} />
      ) : mode === "site" && siteData ? (
        <>
          <SiteView data={siteData} period={PERIOD_LABELS[period]} />
          {/* Suggestions */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/25">
                <Wrench className="h-3.5 w-3.5" /> Verbetervoorstellen voor Windsurf
              </h2>
              <button onClick={loadSuggestions} disabled={loadingSuggestions} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium transition hover:bg-brand-500 disabled:opacity-50">
                {loadingSuggestions ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Genereer Suggesties
              </button>
            </div>
            {suggestions?.suggestions?.length > 0 && (
              <div className="mt-4 space-y-3">
                {suggestions.suggestions.map((s: any, i: number) => {
                  const CatIcon = CAT_ICONS[s.category] || Lightbulb;
                  return (
                    <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                          <CatIcon className="h-4 w-4 text-brand-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">{s.title}</h3>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${IMPACT_COLORS[s.impact] || IMPACT_COLORS.medium}`}>{s.impact}</span>
                            {s.effort && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-white/30">{s.effort}</span>}
                          </div>
                          <p className="mt-1 text-xs text-white/50">{s.description}</p>
                          {s.how && <p className="mt-2 rounded-lg bg-white/5 p-2 text-[11px] text-white/40"><strong className="text-white/60">Hoe:</strong> {s.how}</p>}
                          {s.sellable && s.sell_description && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-2">
                              <DollarSign className="h-3.5 w-3.5 text-green-400" />
                              <div>
                                <span className="text-[10px] font-semibold text-green-400">{s.sell_price_suggestion || "Verkoopbaar"}</span>
                                <p className="text-[10px] text-green-400/60">{s.sell_description}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-16 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Brain className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Geen data beschikbaar</p>
        </div>
      )}
    </div>
  );
}

function GlobalView({ data, period }: { data: any; period: string }) {
  const ai = data.ai || {};
  const t = data.totals || {};
  return (
    <>
      {/* AI Headline */}
      {ai.headline && (
        <div className="mt-6 rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-500/10 to-purple-500/10 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400" />
            <div>
              <h2 className="text-sm font-bold">{ai.headline}</h2>
              <p className="mt-1 text-xs text-white/50">{ai.summary}</p>
            </div>
          </div>
          {ai.platform_health !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${ai.platform_health}%` }} />
              </div>
              <span className="text-xs font-bold text-brand-400">{ai.platform_health}/100</span>
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Globe} label="Sites" value={t.sites} color="brand" />
        <Stat icon={Users} label="Bezoekers" value={t.sessions} color="blue" />
        <Stat icon={MessageSquare} label="Gesprekken" value={t.conversations} color="purple" />
        <Stat icon={Brain} label="Escalaties" value={t.escalations} color="orange" />
        <Stat icon={ShieldAlert} label="Alerts" value={t.alerts} color={t.unresolved_alerts > 0 ? "red" : "green"} />
        <Stat icon={AlertTriangle} label="Onopgelost" value={t.unresolved_alerts} color={t.unresolved_alerts > 0 ? "red" : "green"} />
      </div>

      {/* Rankings */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <RankingCard title="Drukste Sites" items={data.rankings?.by_sessions?.map((s: any) => ({ label: s.name, value: `${s.sessions} bezoekers` })) || []} icon={Users} color="blue" />
        <RankingCard title="Snelst Groeiend" items={data.rankings?.by_growth?.map((s: any) => ({ label: s.name, value: `${s.change > 0 ? "+" : ""}${s.change}%` })) || []} icon={TrendingUp} color="green" />
        <RankingCard title="Aandacht Nodig" items={data.rankings?.needs_attention?.map((s: any) => ({ label: s.name, value: `${s.alerts} alerts` })) || []} icon={AlertTriangle} color="red" empty="Alles draait soepel!" />
      </div>

      {/* AI Insights */}
      {(ai.top_performers?.length > 0 || ai.opportunities?.length > 0) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {ai.top_performers?.length > 0 && (
            <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-4">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green-400"><Crown className="h-3.5 w-3.5" /> Top Performers</h3>
              <ul className="mt-3 space-y-2">{ai.top_performers.map((t: string, i: number) => <li key={i} className="text-xs text-white/50">• {t}</li>)}</ul>
            </div>
          )}
          {ai.opportunities?.length > 0 && (
            <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-4">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-yellow-400"><DollarSign className="h-3.5 w-3.5" /> Verkoopkansen</h3>
              <ul className="mt-3 space-y-2">{ai.opportunities.map((o: string, i: number) => <li key={i} className="text-xs text-white/50">• {o}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Per-site breakdown */}
      {data.sites?.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Alle Sites ({data.sites.length})</h2>
          <div className="space-y-2">
            {data.sites.map((s: any) => (
              <Link key={s.tenant_id} href={`/admin/tenants/${s.tenant_id}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10 hover:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-white/30" />
                  <div>
                    <span className="text-xs font-semibold">{s.name}</span>
                    <span className="ml-2 text-[10px] text-white/30">{s.domain}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-white/40">
                  <span>{s.sessions} bezoekers</span>
                  <span>{s.conversations} chats</span>
                  <span className={s.sessions_change >= 0 ? "text-green-400" : "text-red-400"}>{s.sessions_change > 0 ? "+" : ""}{s.sessions_change}%</span>
                  {s.unresolved_alerts > 0 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-400">{s.unresolved_alerts} alerts</span>}
                  <ArrowRight className="h-3 w-3 text-white/20" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ClientView({ data, period }: { data: any; period: string }) {
  const ai = data.ai || {};
  const t = data.totals || {};
  return (
    <>
      {/* Client AI Headline */}
      {ai.headline && (
        <div className="mt-6 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-brand-500/10 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-400" />
            <div>
              <h2 className="text-sm font-bold">{data.client_name} — {ai.headline}</h2>
              <p className="mt-1 text-xs text-white/50">{ai.summary}</p>
            </div>
          </div>
          {ai.client_health !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${ai.client_health}%` }} />
              </div>
              <span className="text-xs font-bold text-purple-400">{ai.client_health}/100</span>
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Globe} label="Sites" value={t.sites} color="purple" />
        <Stat icon={Users} label="Bezoekers" value={t.sessions} color="blue" />
        <Stat icon={MessageSquare} label="Gesprekken" value={t.conversations} color="brand" />
        <Stat icon={Brain} label="Escalaties" value={t.escalations} color="orange" />
        <Stat icon={ShieldAlert} label="Alerts" value={t.alerts} color={t.unresolved_alerts > 0 ? "red" : "green"} />
        <Stat icon={AlertTriangle} label="Onopgelost" value={t.unresolved_alerts} color={t.unresolved_alerts > 0 ? "red" : "green"} />
      </div>

      {/* AI Insights */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {ai.highlights?.length > 0 && (
          <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Positief</h3>
            <ul className="mt-3 space-y-2">{ai.highlights.map((h: string, i: number) => <li key={i} className="text-xs text-white/50">• {h}</li>)}</ul>
          </div>
        )}
        {ai.concerns?.length > 0 && (
          <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> Aandachtspunten</h3>
            <ul className="mt-3 space-y-2">{ai.concerns.map((c: string, i: number) => <li key={i} className="text-xs text-white/50">• {c}</li>)}</ul>
          </div>
        )}
      </div>

      {ai.opportunities?.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-yellow-400"><DollarSign className="h-3.5 w-3.5" /> Verkoopkansen</h3>
          <ul className="mt-3 space-y-2">{ai.opportunities.map((o: string, i: number) => <li key={i} className="text-xs text-white/50">• {o}</li>)}</ul>
        </div>
      )}

      {/* Per-site breakdown */}
      {data.sites?.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Sites van {data.client_name} ({data.sites.length})</h2>
          <div className="space-y-2">
            {data.sites.map((s: any) => (
              <Link key={s.tenant_id} href={`/admin/tenants/${s.tenant_id}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10 hover:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-white/30" />
                  <div>
                    <span className="text-xs font-semibold">{s.name}</span>
                    <span className="ml-2 text-[10px] text-white/30">{s.domain}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-white/40">
                  <span>{s.sessions} bezoekers</span>
                  <span>{s.conversations} chats</span>
                  <span className={s.sessions_change >= 0 ? "text-green-400" : "text-red-400"}>{s.sessions_change > 0 ? "+" : ""}{s.sessions_change}%</span>
                  {s.unresolved_alerts > 0 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-400">{s.unresolved_alerts} alerts</span>}
                  <ArrowRight className="h-3 w-3 text-white/20" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function SiteView({ data, period }: { data: any; period: string }) {
  const ai = data.ai || {};
  const s = data.stats || {};
  return (
    <>
      {/* AI Summary */}
      {ai.headline && (
        <div className="mt-6 rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-500/10 to-purple-500/10 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400" />
            <div>
              <h2 className="text-sm font-bold">{ai.headline}</h2>
              <p className="mt-1 text-xs text-white/50">{ai.summary}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4">
            {ai.growth_score !== undefined && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs text-white/40">Groei:</span>
                <span className="text-xs font-bold text-green-400">{ai.growth_score}/100</span>
              </div>
            )}
            {ai.health_score !== undefined && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" />
                <span className="text-xs text-white/40">Gezondheid:</span>
                <span className="text-xs font-bold text-brand-400">{ai.health_score}/100</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Bezoekers" value={s.sessions} sub={`${s.sessions_change > 0 ? "+" : ""}${s.sessions_change}%`} subColor={s.sessions_change >= 0 ? "text-green-400" : "text-red-400"} color="blue" />
        <Stat icon={MessageSquare} label="Gesprekken" value={s.conversations} sub={`${s.conversations_change > 0 ? "+" : ""}${s.conversations_change}%`} subColor={s.conversations_change >= 0 ? "text-green-400" : "text-red-400"} color="purple" />
        <Stat icon={ShieldAlert} label="Alerts" value={s.alerts} sub={`${s.unresolved_alerts} open`} color={s.unresolved_alerts > 0 ? "red" : "green"} />
        <Stat icon={BarChart3} label="Uptime" value={s.uptime_pct ? `${s.uptime_pct}%` : "N/A"} color="brand" />
      </div>

      {/* Highlights & Concerns */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {ai.highlights?.length > 0 && (
          <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Positief</h3>
            <ul className="mt-3 space-y-2">{ai.highlights.map((h: string, i: number) => <li key={i} className="text-xs text-white/50">• {h}</li>)}</ul>
          </div>
        )}
        {ai.concerns?.length > 0 && (
          <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> Aandachtspunten</h3>
            <ul className="mt-3 space-y-2">{ai.concerns.map((c: string, i: number) => <li key={i} className="text-xs text-white/50">• {c}</li>)}</ul>
          </div>
        )}
      </div>

      {/* AI Suggestions */}
      {ai.suggestions?.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">AI Suggesties</h2>
          <div className="space-y-2">
            {ai.suggestions.map((sg: any, i: number) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <Lightbulb className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                <div className="flex-1">
                  <span className="text-xs font-semibold">{sg.title}</span>
                  <p className="text-[10px] text-white/40">{sg.description}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${sg.impact === "high" ? "border-red-500/20 text-red-400" : sg.impact === "medium" ? "border-yellow-500/20 text-yellow-400" : "border-green-500/20 text-green-400"}`}>{sg.impact}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, sub, subColor, color }: { icon: any; label: string; value: any; sub?: string; subColor?: string; color: string }) {
  const cm: Record<string, string> = { brand: "border-brand-500/20 bg-brand-500/5", blue: "border-blue-500/20 bg-blue-500/5", purple: "border-purple-500/20 bg-purple-500/5", green: "border-green-500/20 bg-green-500/5", red: "border-red-500/20 bg-red-500/5", orange: "border-orange-500/20 bg-orange-500/5" };
  const im: Record<string, string> = { brand: "text-brand-400", blue: "text-blue-400", purple: "text-purple-400", green: "text-green-400", red: "text-red-400", orange: "text-orange-400" };
  return (
    <div className={`rounded-xl border p-3 ${cm[color]}`}>
      <div className="flex items-center gap-1.5"><Icon className={`h-3 w-3 ${im[color]}`} /><span className="text-[9px] font-medium uppercase tracking-wider text-white/30">{label}</span></div>
      <p className="mt-1 text-lg font-bold">{value ?? 0}</p>
      {sub && <p className={`text-[10px] ${subColor || "text-white/30"}`}>{sub}</p>}
    </div>
  );
}

function RankingCard({ title, items, icon: Icon, color, empty }: { title: string; items: { label: string; value: string }[]; icon: any; color: string; empty?: string }) {
  const cm: Record<string, string> = { blue: "text-blue-400", green: "text-green-400", red: "text-red-400" };
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/30"><Icon className={`h-3.5 w-3.5 ${cm[color] || "text-white/30"}`} /> {title}</h3>
      {items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-white/60">{i + 1}. {item.label}</span>
              <span className={`text-xs font-semibold ${cm[color] || "text-white/50"}`}>{item.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-white/30">{empty || "Geen data"}</p>
      )}
    </div>
  );
}
