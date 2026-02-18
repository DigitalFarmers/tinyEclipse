"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Inbox,
  Forward,
  Reply,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MailAccount {
  email: string;
  username: string;
  quota_mb: number;
  usage_mb: number;
}

interface Forwarder {
  from: string;
  to: string;
}

interface MailSummary {
  domain: string;
  accounts: MailAccount[];
  account_count: number;
  forwarders: Forwarder[];
  forwarder_count: number;
  autoresponder_count: number;
  total_usage_mb: number;
  total_quota_mb: number;
  has_mail_module: boolean;
}

interface MailHealth {
  domain: string;
  mx_records: string[];
  smtp_reachable: boolean;
  issues: string[];
}

export default function PortalMailPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [mail, setMail] = useState<MailSummary | null>(null);
  const [health, setHealth] = useState<MailHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) { router.replace("/portal/login"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.replace("/portal/login"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    loadMail();
  }, [session]);

  async function loadMail() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/mail/${session.tenant_id}`, { cache: "no-store" });
      if (r.ok) setMail(await r.json());
    } catch {}
    setLoading(false);
  }

  async function checkHealth() {
    setHealthLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/mail/${session.tenant_id}/health`, { cache: "no-store" });
      if (r.ok) setHealth(await r.json());
    } catch {}
    setHealthLoading(false);
  }

  async function activateMailModule() {
    setActivating(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/mail/${session.tenant_id}/activate`, { method: "POST" });
      if (r.ok) await loadMail();
    } catch {}
    setActivating(false);
  }

  if (!session) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-400" />
            E-mail
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Mailboxen &amp; e-mail overzicht voor {session.domain}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkHealth}
            disabled={healthLoading}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 disabled:opacity-50"
          >
            {healthLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Health Check
          </button>
          <button
            onClick={loadMail}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`mt-4 rounded-xl border p-4 ${
          health.issues.length === 0 && health.smtp_reachable
            ? "border-green-500/20 bg-green-500/5"
            : health.issues.length > 0
            ? "border-red-500/20 bg-red-500/5"
            : "border-yellow-500/20 bg-yellow-500/5"
        }`}>
          <div className="flex items-center gap-2">
            {health.issues.length === 0 && health.smtp_reachable ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : health.issues.length > 0 ? (
              <XCircle className="h-4 w-4 text-red-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            )}
            <span className="text-xs font-semibold">
              {health.issues.length === 0 && health.smtp_reachable
                ? "Mail is gezond"
                : `${health.issues.length} probleem${health.issues.length !== 1 ? "en" : ""} gevonden`}
            </span>
          </div>
          {health.mx_records.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {health.mx_records.map((mx) => (
                <span key={mx} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                  MX: {mx}
                </span>
              ))}
            </div>
          )}
          {health.issues.map((issue, i) => (
            <p key={i} className="mt-1 text-[11px] text-red-300">{issue}</p>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
          <span className="text-sm">Mail laden...</span>
        </div>
      ) : !mail || mail.account_count === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Mail className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">
            {mail ? "Geen mailboxen gevonden voor dit domein." : "Kon mail niet laden."}
          </p>
          <p className="mt-1 text-xs text-white/25">
            {mail
              ? "Controleer of er e-mail accounts zijn aangemaakt in DirectAdmin."
              : "DirectAdmin is mogelijk niet geconfigureerd. Neem contact op met support."}
          </p>
          {mail && !mail.has_mail_module && (
            <button
              onClick={activateMailModule}
              disabled={activating}
              className="mt-4 rounded-lg bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-400 transition hover:bg-orange-500/20 disabled:opacity-50"
            >
              {activating ? "Activeren..." : "Mail Module Activeren"}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Inbox} label="Mailboxen" value={mail.account_count} color="orange" />
            <StatCard icon={Forward} label="Forwarders" value={mail.forwarder_count} color="blue" />
            <StatCard icon={Reply} label="Autoresponders" value={mail.autoresponder_count} color="purple" />
            <StatCard
              icon={HardDrive}
              label="Opslag"
              value={`${mail.total_usage_mb}MB`}
              sub={mail.total_quota_mb > 0 ? `van ${mail.total_quota_mb}MB` : undefined}
              color="green"
            />
          </div>

          {/* Activate module if not yet */}
          {!mail.has_mail_module && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-white/60">Mail module is nog niet geactiveerd</span>
              </div>
              <button
                onClick={activateMailModule}
                disabled={activating}
                className="rounded-lg bg-orange-500/10 px-3 py-1.5 text-[10px] font-medium text-orange-400 transition hover:bg-orange-500/20 disabled:opacity-50"
              >
                {activating ? "..." : "Activeren"}
              </button>
            </div>
          )}

          {/* Mailboxes */}
          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-widest text-white/25">
            Mailboxen
          </h2>
          <div className="space-y-2">
            {mail.accounts.map((a) => {
              const usagePercent = a.quota_mb > 0 ? Math.round((a.usage_mb / a.quota_mb) * 100) : 0;
              const isHigh = usagePercent > 80;
              return (
                <div
                  key={a.email}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                      <Mail className="h-4 w-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.email}</p>
                      <p className="text-[10px] text-white/30">
                        {a.usage_mb}MB gebruikt
                        {a.quota_mb > 0 && ` van ${a.quota_mb}MB`}
                      </p>
                    </div>
                  </div>
                  {a.quota_mb > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24">
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isHigh ? "bg-red-500" : "bg-orange-500"
                            }`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium ${isHigh ? "text-red-400" : "text-white/40"}`}>
                        {usagePercent}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Forwarders */}
          {mail.forwarders.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-widest text-white/25">
                Forwarders
              </h2>
              <div className="space-y-1.5">
                {mail.forwarders.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5">
                    <span className="text-xs text-white/60">{f.from}</span>
                    <Forward className="h-3 w-3 text-white/20" />
                    <span className="text-xs text-white/40">{f.to}</span>
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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    orange: "border-orange-500/20 bg-orange-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
    green: "border-green-500/20 bg-green-500/5",
  };
  const iconColorMap: Record<string, string> = {
    orange: "text-orange-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    green: "text-green-400",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.orange}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${iconColorMap[color]}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}
