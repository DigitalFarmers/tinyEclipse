"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users, Eye, TrendingUp, Clock, RefreshCw, ArrowUpRight, ArrowDownRight,
  Globe, Smartphone, Monitor, Tablet, Languages, MapPin, Link2, BarChart3,
  MousePointer, ChevronDown, ExternalLink,
} from "lucide-react";
import { getTenants, getDeepAnalytics } from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; }

const PRESETS = [
  { label: "Vandaag", value: "today" },
  { label: "7 dagen", value: "7d" },
  { label: "30 dagen", value: "30d" },
  { label: "90 dagen", value: "90d" },
  { label: "Dit jaar", value: "ytd" },
];

const COUNTRY_FLAGS: Record<string, string> = {
  BE: "🇧🇪", NL: "🇳🇱", FR: "🇫🇷", DE: "🇩🇪", GB: "🇬🇧", US: "🇺🇸",
  ES: "🇪🇸", IT: "🇮🇹", PT: "🇵🇹", TR: "🇹🇷", MA: "🇲🇦", unknown: "🌍",
};

const LANG_NAMES: Record<string, string> = {
  nl: "Nederlands", fr: "Frans", en: "Engels", de: "Duits", es: "Spaans",
  it: "Italiaans", pt: "Portugees", ar: "Arabisch", tr: "Turks", unknown: "Onbekend",
};

export default function AnalyticsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [preset, setPreset] = useState("30d");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    chart: true, geo: true, languages: true, devices: false, referrers: false, pages: true, sessions: false,
  });

  useEffect(() => { getTenants().then((t) => { setTenants(t); if (t.length > 0) setSelectedTenant(t[0].id); }); }, []);
  useEffect(() => { if (selectedTenant) loadData(); }, [selectedTenant, preset]);

  async function loadData() {
    setLoading(true);
    try { setData(await getDeepAnalytics(selectedTenant, preset)); } catch { setData(null); } finally { setLoading(false); }
  }

  const s = data?.summary;
  const fmt = (sec: number) => { if (!sec) return "0s"; const m = Math.floor(sec / 60); const ss = Math.round(sec % 60); return m > 0 ? `${m}m ${ss}s` : `${ss}s`; };
  const toggle = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const tn = (id: string) => tenants.find(t => t.id === id)?.name || id.slice(0, 8);

  // Chart max for bar scaling
  const chartMax = useMemo(() => {
    if (!data?.chart) return 1;
    return Math.max(1, ...data.chart.map((d: any) => Math.max(d.sessions || 0, d.pageviews || 0)));
  }, [data?.chart]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-brand-400" /> Deep Analytics
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            {tn(selectedTenant)} — {data?.period?.days || 30} dagen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            {tenants.map((t) => <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {PRESETS.map(p => (
              <button key={p.value} onClick={() => setPreset(p.value)}
                className={`px-3 py-2 text-[10px] font-medium transition ${preset === p.value ? "bg-brand-500/20 text-brand-400" : "text-white/40 hover:bg-white/5"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={loadData} disabled={loading} className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!s ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">{loading ? "Laden..." : "Geen analytics data"}</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Sessies" value={s.sessions} change={s.sessions_change} color="brand" />
            <StatCard icon={Eye} label="Pageviews" value={s.pageviews} color="purple" />
            <StatCard icon={Clock} label="Gem. duur" value={fmt(s.avg_duration)} color="blue" />
            <StatCard icon={TrendingUp} label="Pag/sessie" value={s.avg_pages?.toFixed(1) || "0"} color="green" />
          </div>
          <div className="mt-3 grid gap-3 grid-cols-3">
            <MetricCard label="Bounce Rate" value={`${s.bounce_rate?.toFixed(1)}%`} good={s.bounce_rate < 50} />
            <MetricCard label="Conversie" value={`${s.conversion_rate?.toFixed(1)}%`} good={s.conversion_rate > 2} />
            <MetricCard label="Sessie trend" value={`${s.sessions_change > 0 ? "+" : ""}${s.sessions_change}%`} good={s.sessions_change >= 0} />
          </div>

          {/* Traffic Chart */}
          {data?.chart?.length > 0 && (
            <Section title="📈 Verkeer" sectionKey="chart" expanded={expandedSections.chart} toggle={toggle}>
              <div className="flex items-end gap-[2px] h-32 px-2">
                {data.chart.map((d: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-[1px] group relative">
                    <div className="w-full rounded-t bg-brand-500/40 transition-all group-hover:bg-brand-500/70"
                      style={{ height: `${Math.max(2, (d.sessions / chartMax) * 100)}%` }} />
                    <div className="absolute -top-8 hidden group-hover:block rounded bg-white/10 px-2 py-1 text-[9px] text-white whitespace-nowrap z-10">
                      {d.label}: {d.sessions}s / {d.pageviews}pv
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-2 mt-1">
                <span className="text-[9px] text-white/20">{data.chart[0]?.label}</span>
                <span className="text-[9px] text-white/20">{data.chart[data.chart.length - 1]?.label}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 px-2">
                <span className="flex items-center gap-1 text-[10px] text-white/30"><span className="w-2 h-2 rounded-sm bg-brand-500/40" /> Sessies</span>
              </div>
            </Section>
          )}

          {/* Geo & Languages side by side */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* Geo */}
            {data?.geo?.countries && Object.keys(data.geo.countries).length > 0 && (
              <Section title="🌍 Landen" sectionKey="geo" expanded={expandedSections.geo} toggle={toggle}>
                <div className="space-y-1">
                  {Object.entries(data.geo.countries).slice(0, 10).map(([code, count]: [string, any]) => {
                    const pct = Math.round((count / s.sessions) * 100);
                    return (
                      <div key={code} className="flex items-center gap-2">
                        <span className="text-sm w-6">{COUNTRY_FLAGS[code] || COUNTRY_FLAGS.unknown}</span>
                        <span className="text-xs text-white/60 w-6 uppercase">{code}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-white/40 w-10 text-right">{count}</span>
                        <span className="text-[10px] text-white/25 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Languages */}
            {data?.languages && Object.keys(data.languages).length > 0 && (
              <Section title="🌐 Talen" sectionKey="languages" expanded={expandedSections.languages} toggle={toggle}>
                <div className="space-y-1">
                  {Object.entries(data.languages).slice(0, 8).map(([code, count]: [string, any]) => {
                    const pct = Math.round((count / s.sessions) * 100);
                    return (
                      <div key={code} className="flex items-center gap-2">
                        <span className="text-xs text-white/60 w-12">{LANG_NAMES[code] || code}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-white/40 w-10 text-right">{count}</span>
                        <span className="text-[10px] text-white/25 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>

          {/* Devices & Referrers side by side */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {/* Devices */}
            {data?.devices && (
              <Section title="📱 Apparaten" sectionKey="devices" expanded={expandedSections.devices} toggle={toggle}>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(data.devices).map(([type, count]: [string, any]) => {
                    const Icon = type === "mobile" ? Smartphone : type === "tablet" ? Tablet : Monitor;
                    const pct = Math.round((count / s.sessions) * 100);
                    return (
                      <div key={type} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
                        <Icon className="mx-auto h-5 w-5 text-white/30" />
                        <p className="mt-1 text-lg font-bold">{pct}%</p>
                        <p className="text-[10px] text-white/30 capitalize">{type}</p>
                        <p className="text-[10px] text-white/20">{count} sessies</p>
                      </div>
                    );
                  })}
                </div>
                {data?.browsers && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Browsers</p>
                    {Object.entries(data.browsers).slice(0, 5).map(([name, count]: [string, any]) => (
                      <div key={name} className="flex items-center justify-between text-[11px]">
                        <span className="text-white/50">{name}</span>
                        <span className="text-white/30">{count as number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Referrers */}
            {data?.referrers && Object.keys(data.referrers).length > 0 && (
              <Section title="🔗 Bronnen" sectionKey="referrers" expanded={expandedSections.referrers} toggle={toggle}>
                <div className="space-y-1">
                  {Object.entries(data.referrers).slice(0, 10).map(([source, count]: [string, any]) => {
                    const pct = Math.round((count / s.sessions) * 100);
                    return (
                      <div key={source} className="flex items-center gap-2">
                        <Link2 className="h-3 w-3 text-white/20 flex-shrink-0" />
                        <span className="text-xs text-white/60 truncate flex-1">{source}</span>
                        <span className="text-[10px] text-white/40 w-8 text-right">{count}</span>
                        <span className="text-[10px] text-white/25 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                {data?.utm_campaigns && Object.keys(data.utm_campaigns).length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Campagnes</p>
                    {Object.entries(data.utm_campaigns).slice(0, 5).map(([name, count]: [string, any]) => (
                      <div key={name} className="flex items-center justify-between text-[11px]">
                        <span className="text-white/50">{name}</span>
                        <span className="text-white/30">{count as number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>

          {/* Top Pages */}
          {data?.top_pages?.length > 0 && (
            <Section title="📄 Top Pagina's (WPML gebundeld)" sectionKey="pages" expanded={expandedSections.pages} toggle={toggle}>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 px-4 py-2 bg-white/[0.03] text-[9px] text-white/30 uppercase tracking-wider">
                  <span>Pagina</span><span className="text-right">Views</span><span className="text-right">Tijd</span><span className="text-right">Scroll</span><span className="text-right">Talen</span>
                </div>
                {data.top_pages.map((p: any, i: number) => (
                  <div key={p.path} className={`grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 px-4 py-2.5 text-xs ${i > 0 ? "border-t border-white/5" : ""} hover:bg-white/[0.02] transition`}>
                    <div className="truncate">
                      <span className="text-white/70 font-medium">{p.path}</span>
                      {p.title && <span className="text-white/25 ml-1 text-[10px]">— {p.title}</span>}
                    </div>
                    <span className="text-right font-semibold">{p.views}</span>
                    <span className="text-right text-white/40">{p.avg_time}s</span>
                    <span className="text-right text-white/40">{p.avg_scroll}%</span>
                    <div className="flex justify-end gap-0.5">
                      {p.languages?.length > 0 ? p.languages.map((l: string) => (
                        <span key={l} className="rounded bg-purple-500/15 px-1 py-0.5 text-[8px] font-bold text-purple-400 uppercase">{l}</span>
                      )) : <span className="text-[9px] text-white/20">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recent Sessions */}
          {data?.recent_sessions?.length > 0 && (
            <Section title="🕐 Recente Sessies" sectionKey="sessions" expanded={expandedSections.sessions} toggle={toggle}>
              <div className="space-y-1">
                {data.recent_sessions.map((sess: any) => (
                  <div key={sess.session_id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
                    <span className="text-white/20">{COUNTRY_FLAGS[sess.country] || "🌍"}</span>
                    <span className="text-white/50 w-16">{sess.device || "?"}</span>
                    <span className="text-white/40 truncate flex-1">{sess.landing_page || "/"}</span>
                    <span className="text-white/30">{sess.page_count}p</span>
                    <span className="text-white/30">{fmt(sess.duration)}</span>
                    {sess.is_bounce && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400">bounce</span>}
                    {sess.has_conversion && <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] text-green-400">conv</span>}
                    <span className="text-white/15 text-[10px]">{new Date(sess.created_at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <p className="mt-8 text-center text-[10px] text-white/15">
        Deep Analytics — privacy-first, no cookies, WPML-aware bundling
      </p>
    </div>
  );
}

function Section({ title, sectionKey, expanded, toggle, children }: {
  title: string; sectionKey: string; expanded: boolean; toggle: (k: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <button onClick={() => toggle(sectionKey)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition">
        <span className="text-xs font-semibold text-white/60">{title}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/20 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change, color }: { icon: any; label: string; value: string | number; change?: number; color: string }) {
  const c: Record<string, string> = { brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20", green: "from-green-500/10 to-green-600/5 border-green-500/20", purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20", blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20" };
  const ic: Record<string, string> = { brand: "text-brand-500", green: "text-green-400", purple: "text-purple-400", blue: "text-blue-400" };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${c[color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${ic[color]}`} />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
        </div>
        {change !== undefined && (
          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
            {change >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
            {change > 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MetricCard({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </div>
      <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${good ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
        {good ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {good ? "Goed" : "Aandacht"}
      </div>
    </div>
  );
}
