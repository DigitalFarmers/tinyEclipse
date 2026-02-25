"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldCheck, ShieldAlert, Clock, Globe, Lock, Gauge, Server, Crown } from "lucide-react";
import { ProTeaser, ProBadge } from "@/components/ProTeaser";
import { CheckCardSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PortalMonitoringPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [monitor, setMonitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) { router.replace("/portal/login"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.replace("/portal/login"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/admin/monitoring/dashboard/${session.tenant_id}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then(setMonitor)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const icons: Record<string, any> = { uptime: Globe, ssl: Lock, performance: Gauge, dns: Server };
  const sc = (s: string) => s === "ok" ? "text-green-400" : s === "warning" ? "text-yellow-400" : s === "critical" ? "text-red-400" : "text-white/30";
  const sb = (s: string) => s === "ok" ? "border-green-500/20 bg-green-500/5" : s === "warning" ? "border-yellow-500/20 bg-yellow-500/5" : s === "critical" ? "border-red-500/20 bg-red-500/5" : "border-white/10 bg-white/[0.02]";

  if (!session) return null;
  const plan = session.plan || "tiny";
  const basicChecks = ["uptime"];
  const proChecks = ["ssl", "dns"];
  const proPlusChecks = ["security_headers", "forms", "performance", "content_change", "smtp"];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Website Monitoring</h1>
          <p className="mt-0.5 text-sm text-white/40">24/7 uptime, SSL, performance & DNS checks voor {session.domain}</p>
        </div>
        {plan === "tiny" && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-500/10 border border-brand-500/20 px-3 py-2">
            <Crown className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-[11px] font-semibold text-brand-400">Upgrade voor volledige monitoring</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="animate-pulse flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="h-5 w-5 rounded bg-white/5" />
            <div className="space-y-1 flex-1"><div className="h-3 w-40 rounded bg-white/5" /><div className="h-2 w-56 rounded bg-white/[0.03]" /></div>
          </div>
          <CheckCardSkeleton count={4} />
          <CheckCardSkeleton count={4} />
        </div>
      ) : !monitor ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Shield className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Monitoring is nog niet geconfigureerd voor je site.</p>
          <p className="mt-1 text-xs text-white/25">Neem contact op met Digital Farmers om dit te activeren.</p>
        </div>
      ) : (
        <>
          <div className={`mt-6 flex items-center gap-3 rounded-xl border p-4 ${monitor.overall_status === "healthy" ? "border-green-500/20 bg-green-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
            {monitor.overall_status === "healthy" ? <ShieldCheck className="h-5 w-5 text-green-400" /> : <ShieldAlert className="h-5 w-5 text-yellow-400" />}
            <div>
              <span className={`text-sm font-semibold ${monitor.overall_status === "healthy" ? "text-green-400" : "text-yellow-400"}`}>
                {monitor.overall_status === "healthy" ? "Alles werkt naar behoren" : "Er zijn aandachtspunten"}
              </span>
              <p className="text-xs text-white/40">{monitor.stats.ok} OK · {monitor.stats.warning} Waarschuwing · {monitor.stats.critical} Kritiek</p>
            </div>
          </div>

          {/* Basic checks — visible to all */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {monitor.checks.filter((c: any) => basicChecks.includes(c.type)).map((c: any) => {
              const Icon = icons[c.type] || Shield;
              return (
                <div key={c.id} className={`rounded-xl border p-4 ${sb(c.status)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${sc(c.status)}`} />
                      <span className="text-xs font-semibold uppercase tracking-wider">{c.type}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${sc(c.status)}`}>{c.status}</span>
                  </div>
                  {c.response_time_ms && <p className="mt-2 text-lg font-bold">{c.response_time_ms}ms</p>}
                  {c.last_checked_at && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-white/30">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(c.last_checked_at).toLocaleString("nl-BE")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* PRO checks — SSL, DNS */}
          <ProTeaser plan={plan} requiredPlan="pro" feature="SSL & DNS Monitoring" description="Controleer SSL-certificaten en DNS-configuratie automatisch.">
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {monitor.checks.filter((c: any) => proChecks.includes(c.type)).map((c: any) => {
                const Icon = icons[c.type] || Shield;
                return (
                  <div key={c.id} className={`rounded-xl border p-4 ${sb(c.status)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${sc(c.status)}`} />
                        <span className="text-xs font-semibold uppercase tracking-wider">{c.type}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase ${sc(c.status)}`}>{c.status}</span>
                    </div>
                    {c.response_time_ms && <p className="mt-2 text-lg font-bold">{c.response_time_ms}ms</p>}
                    {c.last_checked_at && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-white/30">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(c.last_checked_at).toLocaleString("nl-BE")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ProTeaser>

          {/* PRO+ checks — Security headers, forms, performance, content change */}
          <ProTeaser plan={plan} requiredPlan="pro_plus" feature="Geavanceerde Monitoring" description="Security headers, formulieren, performance & content change detectie.">
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {monitor.checks.filter((c: any) => proPlusChecks.includes(c.type)).map((c: any) => {
                const Icon = icons[c.type] || Shield;
                return (
                  <div key={c.id} className={`rounded-xl border p-4 ${sb(c.status)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${sc(c.status)}`} />
                        <span className="text-xs font-semibold uppercase tracking-wider">{c.type}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase ${sc(c.status)}`}>{c.status}</span>
                    </div>
                    {c.response_time_ms && <p className="mt-2 text-lg font-bold">{c.response_time_ms}ms</p>}
                    {c.last_checked_at && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-white/30">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(c.last_checked_at).toLocaleString("nl-BE")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ProTeaser>

          {monitor.recent_alerts?.length > 0 && (
            <>
              <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">Recente Meldingen</h2>
              <div className="space-y-2">
                {monitor.recent_alerts.map((a: any) => (
                  <div key={a.id} className={`flex items-center justify-between rounded-lg border p-3 ${a.severity === "critical" ? "border-red-500/20 bg-red-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
                    <div className="flex items-center gap-3">
                      <ShieldAlert className={`h-4 w-4 ${a.severity === "critical" ? "text-red-400" : "text-yellow-400"}`} />
                      <div>
                        <p className="text-xs font-medium">{a.message}</p>
                        <p className="text-[10px] text-white/30">{new Date(a.created_at).toLocaleString("nl-BE")}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.resolved ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {a.resolved ? "Opgelost" : "Actief"}
                    </span>
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
