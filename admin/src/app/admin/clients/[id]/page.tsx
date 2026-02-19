"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Globe,
  MessageSquare,
  ShieldAlert,
  Database,
  Activity,
  RefreshCw,
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  ShoppingCart,
  Gift,
  FileText,
  Mail,
  BookOpen,
  Calendar,
  MessageCircle,
  Puzzle,
  Shield,
  ShieldCheck,
  Crown,
  Clock,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

const MODULE_ICONS: Record<string, any> = {
  jobs: Briefcase, shop: ShoppingCart, giftcard: Gift, forms: FileText,
  mail: Mail, blog: BookOpen, booking: Calendar, forum: MessageCircle, custom: Puzzle,
};
const MODULE_COLORS: Record<string, string> = {
  jobs: "text-blue-400 bg-blue-500/10", shop: "text-green-400 bg-green-500/10",
  giftcard: "text-pink-400 bg-pink-500/10", forms: "text-purple-400 bg-purple-500/10",
  mail: "text-orange-400 bg-orange-500/10", blog: "text-cyan-400 bg-cyan-500/10",
  booking: "text-yellow-400 bg-yellow-500/10", forum: "text-indigo-400 bg-indigo-500/10",
};
const PLAN_COLORS: Record<string, string> = {
  tiny: "bg-white/10 text-white/50", pro: "bg-brand-500/20 text-brand-400", pro_plus: "bg-purple-500/20 text-purple-400",
};

interface ClientProfile {
  account: {
    id: string | null;
    whmcs_client_id: number;
    name: string;
    email: string | null;
    company: string | null;
    created_at: string | null;
  };
  totals: {
    projects: number; production: number; staging: number;
    chats_24h: number; chats_7d: number; open_alerts: number; total_sources: number;
  };
  projects: Array<{
    tenant_id: string; name: string; domain: string; plan: string; status: string;
    environment: string; created_at: string;
    stats: { chats_24h: number; open_alerts: number; sources: number };
    modules: Array<{ type: string; name: string }>;
  }>;
  recent_events: Array<{
    id: string; project_name: string; module_type: string; event_type: string;
    title: string; severity: string; created_at: string;
  }>;
}

export default function ClientDetailPage() {
  const params = useParams();
  const whmcsId = params.id as string;
  const [data, setData] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [whmcsId]);

  async function loadData() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/clients/${whmcsId}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/40">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
        <span className="ml-3 text-sm">Klantprofiel laden...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center">
        <Users className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-sm text-white/40">Klant niet gevonden</p>
        <Link href="/admin/clients" className="mt-4 inline-flex text-xs text-brand-400">← Terug</Link>
      </div>
    );
  }

  const a = data.account;
  const t = data.totals;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients" className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-purple-500/20">
              <Users className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{a.name}</h1>
              <div className="mt-0.5 flex items-center gap-3 text-sm text-white/40">
                <span>WHMCS #{a.whmcs_client_id}</span>
                {a.email && <span>· {a.email}</span>}
              </div>
            </div>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Globe} label="Projecten" value={t.production} sub={t.staging > 0 ? `+${t.staging} staging` : undefined} color="brand" />
        <StatCard icon={MessageSquare} label="Chats 24u" value={t.chats_24h} sub={`${t.chats_7d} in 7d`} color="blue" />
        <StatCard icon={ShieldAlert} label="Open Alerts" value={t.open_alerts} color={t.open_alerts > 0 ? "red" : "green"} />
        <StatCard icon={Database} label="Kennisbronnen" value={t.total_sources} color="purple" />
      </div>

      {/* Projects */}
      <h2 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/25">
        <Globe className="h-4 w-4" /> Projecten
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.projects.map((p) => {
          const isStaging = p.environment === "staging";
          return (
            <Link
              key={p.tenant_id}
              href={`/admin/tenants/${p.tenant_id}`}
              className={`rounded-xl border p-4 transition hover:border-white/10 ${
                isStaging
                  ? "border-yellow-500/10 bg-yellow-500/[0.02] opacity-70"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${p.status === "active" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <Globe className={`h-4 w-4 ${p.status === "active" ? "text-green-400" : "text-red-400"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{p.name}</h3>
                      {isStaging && <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">staging</span>}
                    </div>
                    <p className="text-[11px] text-white/30">{p.domain}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${PLAN_COLORS[p.plan] || PLAN_COLORS.tiny}`}>
                  {p.plan.replace("_", "+")}
                </span>
              </div>

              {/* Stats */}
              <div className="mt-3 flex items-center gap-4 text-[10px] text-white/30">
                <span className="flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> {p.stats.chats_24h} chats</span>
                {p.stats.open_alerts > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="h-2.5 w-2.5" /> {p.stats.open_alerts}</span>}
                <span className="flex items-center gap-1"><Database className="h-2.5 w-2.5" /> {p.stats.sources} bronnen</span>
              </div>

              {/* Modules */}
              {p.modules.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.modules.map((m) => {
                    const Icon = MODULE_ICONS[m.type] || Puzzle;
                    const colors = MODULE_COLORS[m.type] || "text-white/30 bg-white/5";
                    return (
                      <span key={m.type} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] ${colors}`}>
                        <Icon className="h-2 w-2" /> {m.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Recent Events */}
      {data.recent_events.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/25">
            <Activity className="h-4 w-4" /> Recente Events (7d)
          </h2>
          <div className="space-y-1.5">
            {data.recent_events.map((e) => {
              const Icon = MODULE_ICONS[e.module_type] || Activity;
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2.5">
                  <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                    e.severity === "success" ? "bg-green-500/10" : e.severity === "warning" ? "bg-yellow-500/10" : "bg-brand-500/10"
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${
                      e.severity === "success" ? "text-green-400" : e.severity === "warning" ? "text-yellow-400" : "text-brand-400"
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{e.title}</p>
                    <p className="text-[10px] text-white/30">{e.project_name} · {e.event_type.replace(/_/g, " ")}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-white/20">{timeAgo(e.created_at)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Quick Actions */}
      <h2 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/25">
        Acties
      </h2>
      <div className="flex flex-wrap gap-2">
        {data.projects.filter(p => p.environment === "production").map((p) => (
          <a
            key={p.tenant_id}
            href={`/portal?sso=${p.tenant_id}`}
            target="_blank"
            className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-[11px] text-brand-400 transition hover:bg-brand-500/20"
          >
            Portal: {p.domain} <ArrowUpRight className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    brand: "border-brand-500/20 bg-brand-500/5", blue: "border-blue-500/20 bg-blue-500/5",
    green: "border-green-500/20 bg-green-500/5", red: "border-red-500/20 bg-red-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
  };
  const iconMap: Record<string, string> = {
    brand: "text-brand-400", blue: "text-blue-400", green: "text-green-400",
    red: "text-red-400", purple: "text-purple-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.brand}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconMap[color] || iconMap.brand}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u`;
  return `${Math.floor(hrs / 24)}d`;
}
