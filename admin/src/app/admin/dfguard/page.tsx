"use client";

import { useEffect, useState } from "react";
import {
  Shield, RefreshCw, Server, HardDrive, Users, AlertTriangle,
  CheckCircle, XCircle, Mail, Activity, Database, Clock,
  Cpu, MemoryStick, Globe, Lock, Flame, Archive,
} from "lucide-react";
import { StatSkeleton, ListRowSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

export default function DFGuardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "backups" | "security" | "mail">("overview");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/server/dfguard`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-48 animate-pulse rounded bg-white/5" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/[0.03]" />
          </div>
        </div>
        <StatSkeleton count={6} />
        <ListRowSkeleton count={5} />
      </div>
    );
  }

  if (!data || data.status === "not_configured") {
    return (
      <div className="py-20 text-center">
        <Shield className="mx-auto h-12 w-12 text-white/10" />
        <h2 className="mt-4 text-lg font-bold">DFGuard niet geconfigureerd</h2>
        <p className="mt-2 text-sm text-white/40">
          Stel <code className="rounded bg-white/5 px-1.5 py-0.5 text-brand-400">DIRECTADMIN_URL</code>,{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-brand-400">DIRECTADMIN_USER</code> en{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-brand-400">DIRECTADMIN_LOGIN_KEY</code> in om DFGuard te activeren.
        </p>
      </div>
    );
  }

  const health = data.summary?.health || "unknown";
  const alerts = data.alerts || [];
  const server = data.server || {};
  const backups = data.backups || {};
  const security = data.security || {};
  const mail = data.mail || {};
  const accounts = data.accounts || {};

  const healthConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    healthy: { label: "Server Gezond", color: "text-green-400", bg: "border-green-500/20 bg-green-500/5", icon: CheckCircle },
    warning: { label: "Aandacht Nodig", color: "text-yellow-400", bg: "border-yellow-500/20 bg-yellow-500/5", icon: AlertTriangle },
    critical: { label: "Kritiek!", color: "text-red-400", bg: "border-red-500/20 bg-red-500/5", icon: XCircle },
    unknown: { label: "Onbekend", color: "text-white/40", bg: "border-white/10 bg-white/5", icon: Activity },
  };

  const hc = healthConfig[health] || healthConfig.unknown;
  const HealthIcon = hc.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${hc.bg}`}>
            <Shield className={`h-6 w-6 ${hc.color}`} />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              DFGuard
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${hc.bg} ${hc.color}`}>
                <HealthIcon className="mr-1 inline h-3 w-3" />
                {hc.label}
              </span>
            </h1>
            <p className="mt-0.5 text-sm text-white/40">
              Server health · Backups · Security · {server.hostname || "server.dfgrounds.com"}
            </p>
          </div>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Vernieuwen
        </button>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any, i: number) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                alert.severity === "critical"
                  ? "border-red-500/20 bg-red-500/5"
                  : "border-yellow-500/20 bg-yellow-500/5"
              }`}
            >
              {alert.severity === "critical" ? (
                <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    alert.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-white/20">{alert.source}</span>
                </div>
                <p className="mt-1 text-sm text-white/70">{typeof alert.message === "string" ? alert.message : JSON.stringify(alert.message)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={AlertTriangle} label="Alerts" value={data.summary?.total_alerts || 0} color={data.summary?.critical > 0 ? "red" : data.summary?.warnings > 0 ? "yellow" : "green"} />
        <StatCard icon={Users} label="Accounts" value={accounts.total || 0} color="brand" />
        <StatCard icon={Archive} label="Backups" value={backups.available ? "Actief" : "Inactief"} color={backups.available ? "green" : "red"} />
        <StatCard icon={Lock} label="Brute Force" value={security.brute_force?.total || 0} color={security.brute_force?.total > 10 ? "yellow" : "green"} />
        <StatCard icon={Mail} label="Mail Queue" value={mail.queue?.queue_size || 0} color={mail.queue?.queue_size > 50 ? "yellow" : "green"} />
        <StatCard icon={Cpu} label="Load" value={server.load?.["1min"] || "—"} color="brand" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-white/5 pb-0">
        {(["overview", "backups", "security", "mail"] as const).map((tab) => {
          const labels: Record<string, string> = { overview: "Overzicht", backups: "Backups", security: "Security", mail: "Mail" };
          const icons: Record<string, any> = { overview: Server, backups: Archive, security: Lock, mail: Mail };
          const TabIcon = icons[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-medium transition ${
                activeTab === tab
                  ? "bg-white/5 text-white border-b-2 border-brand-500"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" /> {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Server Info */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-brand-400" /> Server Info
            </h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Hostname" value={server.hostname} />
              <InfoRow label="OS" value={server.os} />
              <InfoRow label="Kernel" value={server.kernel} />
              <InfoRow label="Uptime" value={server.uptime} />
              <InfoRow label="CPU Cores" value={server.cpu_cores} />
              <InfoRow label="Load (1/5/15)" value={`${server.load?.["1min"] || "—"} / ${server.load?.["5min"] || "—"} / ${server.load?.["15min"] || "—"}`} />
            </div>
          </div>

          {/* Accounts */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-purple-400" /> Accounts ({accounts.total})
            </h3>
            {accounts.list?.length > 0 ? (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {accounts.list.map((acc: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-xs">
                    <Globe className="h-3 w-3 text-white/20" />
                    <span className="text-white/60">{acc.username || acc}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/30">Geen accounts gevonden</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "backups" && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-5 ${backups.available ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
            <div className="flex items-center gap-3">
              {backups.available ? (
                <CheckCircle className="h-6 w-6 text-green-400" />
              ) : (
                <XCircle className="h-6 w-6 text-red-400" />
              )}
              <div>
                <h3 className={`text-sm font-semibold ${backups.available ? "text-green-400" : "text-red-400"}`}>
                  JetBackup {backups.available ? "Actief" : "Niet Beschikbaar"}
                </h3>
                <p className="text-xs text-white/40">
                  {backups.stats?.source === "directadmin_native" ? "DirectAdmin native backup" : "JetBackup plugin"}
                </p>
              </div>
            </div>
          </div>

          {/* Backup Jobs */}
          {backups.jobs?.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="mb-3 text-sm font-semibold">Backup Jobs ({backups.jobs.length})</h3>
              <div className="space-y-2">
                {backups.jobs.map((job: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-3">
                      <Archive className="h-4 w-4 text-white/30" />
                      <div>
                        <p className="text-xs font-medium">{job.name || job.title || `Job ${i + 1}`}</p>
                        <p className="text-[10px] text-white/25">{job.type || job.destination || ""}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      job.status === "success" || job.status === "active"
                        ? "bg-green-500/10 text-green-400"
                        : job.status === "failed" || job.status === "error"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-white/10 text-white/40"
                    }`}>
                      {job.status || "onbekend"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Backup Alerts */}
          {backups.alerts?.length > 0 && (
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-yellow-400">
                <AlertTriangle className="h-4 w-4" /> Backup Alerts ({backups.alerts.length})
              </h3>
              <div className="space-y-2">
                {backups.alerts.map((alert: any, i: number) => (
                  <div key={i} className="rounded-lg bg-yellow-500/5 p-3 text-xs text-white/60">
                    {typeof alert === "string" ? alert : alert.message || JSON.stringify(alert)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storage */}
          {backups.storage && Object.keys(backups.storage).length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <HardDrive className="h-4 w-4 text-brand-400" /> Backup Storage
              </h3>
              <pre className="overflow-x-auto rounded-lg bg-black/20 p-3 text-[11px] text-white/40">
                {JSON.stringify(backups.storage, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === "security" && (
        <div className="space-y-4">
          {/* Brute Force */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Flame className="h-4 w-4 text-orange-400" /> Brute Force Monitor
            </h3>
            {security.brute_force?.blocked_ips?.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-white/40">
                  {security.brute_force.blocked_ips.length} geblokkeerde IP-adressen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {security.brute_force.blocked_ips.slice(0, 20).map((ip: string, i: number) => (
                    <span key={i} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-mono text-red-400">
                      {ip}
                    </span>
                  ))}
                  {security.brute_force.blocked_ips.length > 20 && (
                    <span className="text-[10px] text-white/20">+{security.brute_force.blocked_ips.length - 20} meer</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-green-400">Geen geblokkeerde IP-adressen — alles veilig</p>
            )}
          </div>

          {/* Brute Force Entries */}
          {security.brute_force?.entries?.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="mb-3 text-sm font-semibold">Recente Pogingen ({security.brute_force.entries.length})</h3>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {security.brute_force.entries.slice(0, 30).map((entry: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-[11px]">
                    <span className="font-mono text-white/40">{entry.ip || JSON.stringify(entry)}</span>
                    {entry.count && <span className="text-red-400">{entry.count}×</span>}
                    {entry.blocked && <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400">blocked</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "mail" && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-5 ${
            (mail.queue?.queue_size || 0) > 50
              ? "border-yellow-500/20 bg-yellow-500/5"
              : "border-green-500/20 bg-green-500/5"
          }`}>
            <div className="flex items-center gap-3">
              <Mail className={`h-6 w-6 ${(mail.queue?.queue_size || 0) > 50 ? "text-yellow-400" : "text-green-400"}`} />
              <div>
                <h3 className="text-sm font-semibold">
                  Mail Queue: {mail.queue?.queue_size || 0} berichten
                </h3>
                <p className="text-xs text-white/40">
                  {(mail.queue?.queue_size || 0) === 0 ? "Queue is leeg — alles verstuurd" :
                   (mail.queue?.queue_size || 0) > 50 ? "Hoge queue — mogelijke problemen" :
                   "Normale queue grootte"}
                </p>
              </div>
            </div>
          </div>

          {mail.queue?.entries?.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="mb-3 text-sm font-semibold">Queue Items</h3>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {mail.queue.entries.slice(0, 30).map((entry: any, i: number) => (
                  <div key={i} className="rounded-lg bg-white/[0.02] px-3 py-2 text-[11px] text-white/40">
                    {typeof entry === "string" ? entry : JSON.stringify(entry)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-white/15">
        DFGuard · Laatste check: {data.checked_at ? new Date(data.checked_at).toLocaleString("nl-BE") : "—"} · DirectAdmin API
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    brand: "border-brand-500/20 bg-brand-500/5", green: "border-green-500/20 bg-green-500/5",
    yellow: "border-yellow-500/20 bg-yellow-500/5", red: "border-red-500/20 bg-red-500/5",
    blue: "border-blue-500/20 bg-blue-500/5", purple: "border-purple-500/20 bg-purple-500/5",
  };
  const iconMap: Record<string, string> = {
    brand: "text-brand-400", green: "text-green-400", yellow: "text-yellow-400",
    red: "text-red-400", blue: "text-blue-400", purple: "text-purple-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.brand}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconMap[color] || iconMap.brand}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between">
      <span className="text-white/30">{label}</span>
      <span className="text-right text-white/60">{String(value)}</span>
    </div>
  );
}
