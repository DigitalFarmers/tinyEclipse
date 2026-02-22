"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { usePortalSession } from "@/lib/usePortalSession";
import { ProTeaser } from "@/components/ProTeaser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PortalReportsPage() {
  const { session } = usePortalSession();
  const [period, setPeriod] = useState("week");
  const [summary, setSummary] = useState<any>(null);
  const [growth, setGrowth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    loadSummary();
  }, [session, period]);

  useEffect(() => {
    if (!session) return;
    loadGrowth();
  }, [session]);

  async function loadSummary() {
    if (!session) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/insights/${session.tenant_id}/summary?period=${period}`, { cache: "no-store" });
      if (r.ok) setSummary(await r.json());
    } catch {}
    setLoading(false);
  }

  async function loadGrowth() {
    if (!session) return;
    try {
      const r = await fetch(`${API_URL}/api/portal/insights/${session.tenant_id}/growth`, { cache: "no-store" });
      if (r.ok) setGrowth(await r.json());
    } catch {}
  }

  if (!session) return null;

  const PERIOD_LABELS: Record<string, string> = { day: "Vandaag", week: "Deze week", month: "Deze maand", year: "Dit jaar" };

  const plan = session.plan || "tiny";

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <BarChart3 className="h-5 w-5 text-brand-400" /> Rapporten
          </h1>
          <p className="mt-0.5 text-sm text-white/40">AI-analyse van {session.domain}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            <option value="day" className="bg-brand-950">Vandaag</option>
            <option value="week" className="bg-brand-950">Week</option>
            <option value="month" className="bg-brand-950">Maand</option>
            <option value="year" className="bg-brand-950">Jaar</option>
          </select>
          <button onClick={loadSummary} disabled={loading} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/40 transition hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-white/40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Rapport genereren...</span>
        </div>
      ) : summary ? (
        <>
          {/* AI Summary Card */}
          {summary.ai?.headline && (
            <div className="mt-6 rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-500/10 to-purple-500/10 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400" />
                <div>
                  <h2 className="text-sm font-bold">{summary.ai.headline}</h2>
                  <p className="mt-1 text-xs text-white/50">{summary.ai.summary}</p>
                </div>
              </div>
              {/* Scores */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {summary.ai.growth_score !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40">Groei Score</span>
                      <span className="font-bold text-green-400">{summary.ai.growth_score}/100</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${summary.ai.growth_score}%` }} />
                    </div>
                  </div>
                )}
                {summary.ai.health_score !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40">Gezondheid Score</span>
                      <span className="font-bold text-brand-400">{summary.ai.health_score}/100</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${summary.ai.health_score}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Users} label="Bezoekers" value={summary.stats?.sessions || 0} change={summary.stats?.sessions_change} />
            <StatCard icon={MessageSquare} label="Gesprekken" value={summary.stats?.conversations || 0} change={summary.stats?.conversations_change} />
            <StatCard icon={BarChart3} label="Pageviews" value={summary.stats?.pageviews || 0} />
            <StatCard icon={CheckCircle2} label="Uptime" value={summary.stats?.uptime_pct ? `${summary.stats.uptime_pct}%` : "N/A"} />
          </div>

          {/* Highlights & Concerns */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {summary.ai?.highlights?.length > 0 && (
              <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Goed nieuws
                </h3>
                <ul className="mt-3 space-y-2">
                  {summary.ai.highlights.map((h: string, i: number) => (
                    <li key={i} className="text-xs text-white/50">• {h}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.ai?.concerns?.length > 0 && (
              <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-yellow-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Aandachtspunten
                </h3>
                <ul className="mt-3 space-y-2">
                  {summary.ai.concerns.map((c: string, i: number) => (
                    <li key={i} className="text-xs text-white/50">• {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* AI Suggestions — PRO feature */}
          <ProTeaser plan={plan} requiredPlan="pro" feature="AI Aanbevelingen" description="Ontvang slimme verbetervoorstellen op basis van je data.">
            {summary.ai?.suggestions?.length > 0 && (
              <>
                <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Aanbevelingen</h2>
                <div className="space-y-2">
                  {summary.ai.suggestions.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <Lightbulb className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                      <div className="flex-1">
                        <span className="text-xs font-semibold">{s.title}</span>
                        <p className="text-[10px] text-white/40">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ProTeaser>

          {/* Top Pages */}
          {summary.stats?.top_pages?.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Populairste Pagina&apos;s</h2>
              <div className="rounded-xl border border-white/5 bg-white/[0.02]">
                {summary.stats.top_pages.map((p: any, i: number) => (
                  <div key={p.path} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-white/5" : ""}`}>
                    <span className="text-xs text-white/60">{p.path}</span>
                    <span className="text-xs font-semibold">{p.views} views</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="mt-16 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Nog geen rapportdata beschikbaar.</p>
        </div>
      )}

      {/* Growth Tracker — PRO+ feature */}
      <ProTeaser plan={plan} requiredPlan="pro_plus" feature="Groei Tracker" description="Bekijk hoe je site groeit over tijd met maandelijkse trends.">
      {growth && (
        <>
          <h2 className="mt-10 mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/25">
            <TrendingUp className="h-3.5 w-3.5" /> Groei Overzicht
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["day", "week", "month", "year"] as const).map((p) => {
              const d = growth.periods?.[p];
              if (!d) return null;
              const labels: Record<string, string> = { day: "Vandaag", week: "Week", month: "Maand", year: "Jaar" };
              return (
                <div key={p} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">{labels[p]}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-bold">{d.sessions}</span>
                    <span className="text-[10px] text-white/30">bezoekers</span>
                  </div>
                  <div className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${d.sessions_change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {d.sessions_change >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {d.sessions_change > 0 ? "+" : ""}{d.sessions_change}% vs vorige
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monthly Trend */}
          {growth.monthly_trend?.length > 0 && (
            <>
              <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Maandelijks Verloop</h3>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-end gap-2" style={{ height: 120 }}>
                  {growth.monthly_trend.map((m: any) => {
                    const max = Math.max(...growth.monthly_trend.map((t: any) => t.sessions), 1);
                    const h = Math.max((m.sessions / max) * 100, 4);
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[9px] font-bold text-white/50">{m.sessions}</span>
                        <div className="w-full rounded-t-md bg-brand-500/30 transition-all" style={{ height: `${h}%` }} />
                        <span className="text-[8px] text-white/25">{m.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
      </ProTeaser>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change }: { icon: any; label: string; value: any; change?: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-brand-400" />
        <span className="text-[9px] font-medium uppercase tracking-wider text-white/30">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {change !== undefined && (
        <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
          {change > 0 ? "+" : ""}{change}%
        </div>
      )}
    </div>
  );
}
