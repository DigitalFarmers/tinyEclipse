"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  Users,
  Bot,
  ArrowUpRight,
  Database,
  Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PortalSession {
  tenant_id: string;
  tenant_name: string;
  domain: string;
  plan: string;
}

function usePortalSession(): PortalSession | null {
  const [session, setSession] = useState<PortalSession | null>(null);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) {
      router.replace("/portal/login");
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      router.replace("/portal/login");
    }
  }, [router]);

  return session;
}

export default function PortalDashboard() {
  const session = usePortalSession();
  const [monitoring, setMonitoring] = useState<any>(null);
  const [sources, setSources] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    loadData();
  }, [session]);

  async function loadData() {
    if (!session) return;
    setLoading(true);
    try {
      // Fetch monitoring dashboard (public-ish, uses tenant_id)
      const [monRes, srcRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/admin/monitoring/dashboard/${session.tenant_id}`, {
          headers: { "X-Admin-Key": "" },
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/admin/sources/?tenant_id=${session.tenant_id}`, {
          headers: { "X-Admin-Key": "" },
          cache: "no-store",
        }),
      ]);

      if (monRes.status === "fulfilled" && monRes.value.ok) {
        setMonitoring(await monRes.value.json());
      }
      if (srcRes.status === "fulfilled" && srcRes.value.ok) {
        const data = await srcRes.value.json();
        setSources(Array.isArray(data) ? data.length : 0);
      }
    } catch {}
    setLoading(false);
  }

  if (!session) return null;

  const planLabel: Record<string, string> = {
    tiny: "Tiny",
    pro: "Pro",
    pro_plus: "Pro+",
  };

  const planColor: Record<string, string> = {
    tiny: "bg-white/10 text-white/60",
    pro: "bg-brand-500/20 text-brand-400",
    pro_plus: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{session.tenant_name}</h1>
          <p className="mt-0.5 text-sm text-white/40">{session.domain}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${planColor[session.plan] || planColor.tiny}`}>
          {planLabel[session.plan] || session.plan}
        </span>
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Dashboard laden...</span>
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Monitoring Status */}
            <div className={`rounded-xl border p-4 ${
              monitoring?.overall_status === "healthy"
                ? "border-green-500/20 bg-green-500/5"
                : monitoring
                ? "border-yellow-500/20 bg-yellow-500/5"
                : "border-white/10 bg-white/[0.02]"
            }`}>
              <div className="flex items-center gap-2">
                {monitoring?.overall_status === "healthy" ? (
                  <ShieldCheck className="h-4 w-4 text-green-400" />
                ) : monitoring ? (
                  <ShieldAlert className="h-4 w-4 text-yellow-400" />
                ) : (
                  <Shield className="h-4 w-4 text-white/30" />
                )}
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Website Status
                </span>
              </div>
              <p className="mt-2 text-lg font-bold">
                {monitoring?.overall_status === "healthy"
                  ? "Online"
                  : monitoring
                  ? "Aandacht nodig"
                  : "Niet geconfigureerd"}
              </p>
            </div>

            {/* AI Sources */}
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-400" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  AI Kennisbank
                </span>
              </div>
              <p className="mt-2 text-lg font-bold">{sources} bronnen</p>
            </div>

            {/* Monitoring Checks */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-400" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Checks
                </span>
              </div>
              <p className="mt-2 text-lg font-bold">
                {monitoring?.stats?.total_checks || 0} actief
              </p>
              {monitoring?.stats && (
                <p className="mt-0.5 text-[10px] text-white/30">
                  {monitoring.stats.ok} OK · {monitoring.stats.warning} Warn · {monitoring.stats.critical} Crit
                </p>
              )}
            </div>

            {/* Plan Info */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-white/40" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Plan
                </span>
              </div>
              <p className="mt-2 text-lg font-bold">{planLabel[session.plan] || session.plan}</p>
              {session.plan === "tiny" && (
                <a href="https://my.digitalfarmers.be/clientarea.php" className="mt-1 flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300">
                  Upgrade naar Pro <ArrowUpRight className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">
            Snel Toegang
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <a href="/portal/ai" className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-brand-500/20 hover:bg-brand-500/5">
              <Bot className="h-5 w-5 text-brand-400" />
              <h3 className="mt-3 text-sm font-semibold">AI Assistent</h3>
              <p className="mt-1 text-xs text-white/40">Test je AI chatbot en bekijk wat bezoekers vragen.</p>
            </a>
            <a href="/portal/monitoring" className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-green-500/20 hover:bg-green-500/5">
              <Shield className="h-5 w-5 text-green-400" />
              <h3 className="mt-3 text-sm font-semibold">Monitoring</h3>
              <p className="mt-1 text-xs text-white/40">Uptime, SSL, DNS en performance van je site.</p>
            </a>
            <a href="/portal/analytics" className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-purple-500/20 hover:bg-purple-500/5">
              <Users className="h-5 w-5 text-purple-400" />
              <h3 className="mt-3 text-sm font-semibold">Bezoekers</h3>
              <p className="mt-1 text-xs text-white/40">Bekijk wie je site bezoekt en wat ze doen.</p>
            </a>
          </div>

          {/* Monitoring Checks Detail */}
          {monitoring?.checks?.length > 0 && (
            <>
              <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">
                Monitoring Checks
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {monitoring.checks.map((c: any) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-4 ${
                      c.status === "ok"
                        ? "border-green-500/20 bg-green-500/5"
                        : c.status === "warning"
                        ? "border-yellow-500/20 bg-yellow-500/5"
                        : c.status === "critical"
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider">{c.type}</span>
                      <span className={`text-[10px] font-bold uppercase ${
                        c.status === "ok" ? "text-green-400" : c.status === "warning" ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    {c.response_time_ms && (
                      <p className="mt-2 text-lg font-bold">{c.response_time_ms}ms</p>
                    )}
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
