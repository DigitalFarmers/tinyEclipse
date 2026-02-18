"use client";

import { useEffect, useState } from "react";
import { Users, Eye, TrendingUp, Clock, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getTenants, getAnalytics } from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; }

export default function AnalyticsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getTenants().then((t) => { setTenants(t); if (t.length > 0) setSelectedTenant(t[0].id); }); }, []);
  useEffect(() => { if (selectedTenant) loadData(); }, [selectedTenant, hours]);

  async function loadData() {
    setLoading(true);
    try { setData(await getAnalytics(selectedTenant, hours)); } catch { setData(null); } finally { setLoading(false); }
  }

  const s = data?.summary;
  const fmt = (sec: number) => { if (!sec) return "0s"; const m = Math.floor(sec / 60); const ss = Math.round(sec % 60); return m > 0 ? `${m}m ${ss}s` : `${ss}s`; };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Visitor Analytics</h1><p className="mt-0.5 text-sm text-white/40">Bezoekers, pageviews & engagement</p></div>
        <div className="flex items-center gap-3">
          <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            {tenants.map((t) => <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>)}
          </select>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            <option value={1} className="bg-brand-950">Laatste uur</option>
            <option value={24} className="bg-brand-950">24 uur</option>
            <option value={168} className="bg-brand-950">7 dagen</option>
            <option value={720} className="bg-brand-950">30 dagen</option>
          </select>
          <button onClick={loadData} disabled={loading} className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      {!s ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center"><Users className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 text-sm text-white/40">Geen analytics data</p></div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SC icon={Users} label="Sessies" value={s.total_sessions} color="brand" />
            <SC icon={Eye} label="Pageviews" value={s.total_pageviews} color="purple" />
            <SC icon={Clock} label="Gem. duur" value={fmt(s.avg_duration_seconds)} color="blue" />
            <SC icon={TrendingUp} label="Pagina's/sessie" value={s.avg_pages_per_session?.toFixed(1) || "0"} color="green" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <EC label="Bounce Rate" value={`${s.bounce_rate?.toFixed(1) || 0}%`} good={s.bounce_rate < 50} />
            <EC label="Chat Engagement" value={`${s.chat_engagement_rate?.toFixed(1) || 0}%`} good={s.chat_engagement_rate > 5} />
            <EC label="Conversie" value={`${s.conversion_rate?.toFixed(1) || 0}%`} good={s.conversion_rate > 2} />
          </div>
          {data?.top_pages?.length > 0 && (
            <><h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">Top Pagina&apos;s</h2>
            <div className="rounded-xl border border-white/5 bg-white/[0.02]">{data.top_pages.map((p: any, i: number) => (
              <div key={p.path} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-white/5" : ""}`}><span className="text-xs text-white/70">{p.path}</span><span className="text-xs font-semibold">{p.views}</span></div>
            ))}</div></>
          )}
        </>
      )}
    </div>
  );
}

function SC({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const c: Record<string, string> = { brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20", green: "from-green-500/10 to-green-600/5 border-green-500/20", purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20", blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20" };
  const ic: Record<string, string> = { brand: "text-brand-500", green: "text-green-400", purple: "text-purple-400", blue: "text-blue-400" };
  return <div className={`rounded-xl border bg-gradient-to-br p-4 ${c[color]}`}><div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${ic[color]}`} /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</span></div><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

function EC({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4"><div><p className="text-[10px] font-medium uppercase tracking-wider text-white/30">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div><div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${good ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{good ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{good ? "Goed" : "Aandacht"}</div></div>;
}
