"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Eye, Clock, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PortalAnalyticsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) { router.replace("/portal/login"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.replace("/portal/login"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${API_URL}/api/track/analytics/${session.tenant_id}?hours=${hours}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, hours]);

  if (!session) return null;
  const s = data?.summary;
  const fmt = (sec: number) => { if (!sec) return "0s"; const m = Math.floor(sec / 60); const ss = Math.round(sec % 60); return m > 0 ? `${m}m ${ss}s` : `${ss}s`; };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bezoekers</h1>
          <p className="mt-0.5 text-sm text-white/40">Wie bezoekt {session.domain} en wat doen ze?</p>
        </div>
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
          <option value={1} className="bg-brand-950">Laatste uur</option>
          <option value={24} className="bg-brand-950">24 uur</option>
          <option value={168} className="bg-brand-950">7 dagen</option>
          <option value={720} className="bg-brand-950">30 dagen</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Laden...</span>
        </div>
      ) : !s ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Nog geen bezoekersdata beschikbaar.</p>
          <p className="mt-1 text-xs text-white/25">Data verschijnt zodra bezoekers je site bezoeken met de widget actief.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Sessies</span></div>
              <p className="mt-2 text-2xl font-bold">{s.total_sessions}</p>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-purple-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Pageviews</span></div>
              <p className="mt-2 text-2xl font-bold">{s.total_pageviews}</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Gem. duur</span></div>
              <p className="mt-2 text-2xl font-bold">{fmt(s.avg_duration_seconds)}</p>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Pagina&apos;s/sessie</span></div>
              <p className="mt-2 text-2xl font-bold">{s.avg_pages_per_session?.toFixed(1) || "0"}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Bounce Rate" value={`${s.bounce_rate?.toFixed(1) || 0}%`} good={s.bounce_rate < 50} />
            <Metric label="Chat Engagement" value={`${s.chat_engagement_rate?.toFixed(1) || 0}%`} good={s.chat_engagement_rate > 5} />
            <Metric label="Conversie" value={`${s.conversion_rate?.toFixed(1) || 0}%`} good={s.conversion_rate > 2} />
          </div>

          {data?.top_pages?.length > 0 && (
            <>
              <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">Populairste Pagina&apos;s</h2>
              <div className="rounded-xl border border-white/5 bg-white/[0.02]">
                {data.top_pages.map((p: any, i: number) => (
                  <div key={p.path} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-white/5" : ""}`}>
                    <span className="text-xs text-white/70">{p.path}</span>
                    <span className="text-xs font-semibold">{p.views} views</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
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
