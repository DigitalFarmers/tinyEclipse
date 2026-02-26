"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Shield, ShieldCheck, ShieldAlert, RefreshCw, Play, Clock, Globe, Lock, Gauge, Server, Bell } from "lucide-react";
import { getTenants, getMonitoringDashboard, runMonitoringChecks, setupMonitoring } from "@/lib/api";

const DFGuardContent = dynamic(() => import("../dfguard/page"), { ssr: false });
const AlertsContent = dynamic(() => import("../alerts/page"), { ssr: false });

interface Tenant { id: string; name: string; domain: string; plan: string; }
interface Check { id: string; type: string; status: string; last_checked_at: string | null; response_time_ms: number | null; }
interface Alert { id: string; check_type: string; severity: string; message: string; created_at: string; resolved: boolean; }
interface MonitorData { overall_status: string; stats: { total_checks: number; ok: number; warning: number; critical: number }; checks: Check[]; recent_alerts: Alert[]; }

const CHECK_ICONS: Record<string, any> = { uptime: Globe, ssl: Lock, performance: Gauge, dns: Server };

const monitorTabs = [
  { id: "uptime" as const, label: "Uptime & SSL", icon: Shield },
  { id: "dfguard" as const, label: "DFGuard", icon: Shield },
  { id: "alerts" as const, label: "Alerts", icon: Bell },
];

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<"uptime" | "dfguard" | "alerts">("uptime");
  const searchParams = useSearchParams();
  const preselected = searchParams.get("tenant");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>(preselected || "");
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => { getTenants().then((t) => { setTenants(t); if (!selectedTenant && t.length > 0) setSelectedTenant(t[0].id); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selectedTenant) loadMonitor(); }, [selectedTenant]);

  async function loadMonitor() {
    if (!selectedTenant) return;
    try { setMonitor(await getMonitoringDashboard(selectedTenant)); } catch {
      try { await setupMonitoring(selectedTenant); setMonitor(await getMonitoringDashboard(selectedTenant)); } catch { setMonitor(null); }
    }
  }

  async function handleRunAll() {
    setRunning(true);
    try { await runMonitoringChecks(selectedTenant); await new Promise((r) => setTimeout(r, 2000)); await loadMonitor(); } finally { setRunning(false); }
  }

  const sc = (s: string) => s === "ok" ? "text-green-400" : s === "warning" ? "text-yellow-400" : s === "critical" ? "text-red-400" : "text-white/30";
  const sb = (s: string) => s === "ok" ? "bg-green-500/10 border-green-500/20" : s === "warning" ? "bg-yellow-500/10 border-yellow-500/20" : s === "critical" ? "bg-red-500/10 border-red-500/20" : "bg-white/5 border-white/10";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Monitoring</h1><p className="mt-0.5 text-sm text-white/40">Uptime, beveiliging, alerts & DFGuard</p></div>
      </div>

      <div className="mt-4 mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
        {monitorTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.id ? "bg-brand-500/20 text-white" : "text-white/40 hover:text-white/70"}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dfguard" ? <DFGuardContent /> : activeTab === "alerts" ? <AlertsContent /> : <>
      <div className="flex items-center justify-end gap-3 mb-4">
        <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
          {tenants.map((t) => <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>)}
        </select>
        <button onClick={handleRunAll} disabled={running || !selectedTenant} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium transition hover:bg-brand-500 disabled:opacity-50">
          {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run All
        </button>
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" /><span className="text-sm">Loading...</span></div>
      ) : !monitor ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Shield className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 text-sm text-white/40">Geen monitoring data</p>
          <button onClick={async () => { await setupMonitoring(selectedTenant); await loadMonitor(); }} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium transition hover:bg-brand-500">Setup Monitoring</button>
        </div>
      ) : (
        <>
          <div className={`mt-6 flex items-center gap-3 rounded-xl border p-4 ${sb(monitor.overall_status === "healthy" ? "ok" : monitor.overall_status)}`}>
            {monitor.overall_status === "healthy" ? <ShieldCheck className="h-5 w-5 text-green-400" /> : <ShieldAlert className="h-5 w-5 text-red-400" />}
            <div>
              <span className={`text-sm font-semibold ${sc(monitor.overall_status === "healthy" ? "ok" : monitor.overall_status)}`}>{monitor.overall_status === "healthy" ? "All Systems Operational" : `Status: ${monitor.overall_status.toUpperCase()}`}</span>
              <p className="text-xs text-white/40">{monitor.stats.ok} OK · {monitor.stats.warning} Warning · {monitor.stats.critical} Critical</p>
            </div>
          </div>

          <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">Checks ({monitor.checks.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {monitor.checks.map((check) => {
              const Icon = CHECK_ICONS[check.type] || Shield;
              return (
                <div key={check.id} className={`rounded-xl border p-4 ${sb(check.status)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${sc(check.status)}`} /><span className="text-xs font-semibold uppercase tracking-wider">{check.type}</span></div>
                    <span className={`text-[10px] font-bold uppercase ${sc(check.status)}`}>{check.status}</span>
                  </div>
                  {check.response_time_ms && <p className="mt-2 text-lg font-bold">{check.response_time_ms}ms</p>}
                  {check.last_checked_at && <p className="mt-1 flex items-center gap-1 text-[10px] text-white/30"><Clock className="h-2.5 w-2.5" />{new Date(check.last_checked_at).toLocaleString("nl-BE")}</p>}
                </div>
              );
            })}
          </div>

          {monitor.recent_alerts.length > 0 && (
            <>
              <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">Alerts ({monitor.recent_alerts.length})</h2>
              <div className="space-y-2">
                {monitor.recent_alerts.map((a) => (
                  <div key={a.id} className={`flex items-center justify-between rounded-lg border p-3 ${a.severity === "critical" ? "border-red-500/20 bg-red-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
                    <div className="flex items-center gap-3">
                      <ShieldAlert className={`h-4 w-4 ${a.severity === "critical" ? "text-red-400" : "text-yellow-400"}`} />
                      <div><p className="text-xs font-medium">{a.message}</p><p className="text-[10px] text-white/30">{a.check_type} · {new Date(a.created_at).toLocaleString("nl-BE")}</p></div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.resolved ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{a.resolved ? "Resolved" : "Active"}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      </>}
    </div>
  );
}
