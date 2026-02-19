"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  Users,
  Bot,
  Database,
  Zap,
  Activity,
  Globe,
  ShoppingCart,
  Briefcase,
  FileText,
  FileEdit,
  BookOpen,
  Calendar,
  Gift,
  Mail,
  MessageCircle,
  Puzzle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Shield,
  Crown,
} from "lucide-react";
import { usePortalSession } from "@/lib/usePortalSession";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

interface UnifiedData {
  client: { name: string; email: string | null; company: string | null };
  totals: {
    projects: number; chats_24h: number; chats_7d: number; visitors_24h: number;
    open_alerts: number; knowledge_sources: number; orders_24h: number; forms_24h: number; jobs_24h: number;
  };
  projects: Array<{
    tenant_id: string; name: string; domain: string; plan: string; status: string;
    monitoring_status: string;
    stats: { chats_24h: number; open_alerts: number; knowledge_sources: number };
    modules: Array<{ type: string; name: string; status: string }>;
    recent_events: Array<{ id: string; event_type: string; title: string; module_type: string; severity: string; created_at: string }>;
  }>;
}

export default function PortalDashboard() {
  const { session, features } = usePortalSession();
  const [data, setData] = useState<UnifiedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    loadData();
  }, [session]);

  async function loadData() {
    if (!session) return;
    setLoading(true);
    try {
      // First get whmcs_client_id from sibling projects endpoint
      const sibRes = await fetch(`${API_URL}/api/portal/projects/by-tenant/${session.tenant_id}`, { cache: "no-store" });
      if (!sibRes.ok) { setLoading(false); return; }
      const sibData = await sibRes.json();
      const whmcsId = sibData.whmcs_client_id;

      // Fetch unified dashboard
      const res = await fetch(`${API_URL}/api/portal/unified/${whmcsId}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  if (!session) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/40">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
        <span className="mt-3 text-sm">Command Center laden...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-white/40">Kon dashboard niet laden.</div>;
  }

  const t = data.totals;
  const allEvents = data.projects.flatMap(p =>
    p.recent_events.map(e => ({ ...e, project_name: p.name, project_domain: p.domain }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

  return (
    <div>
      {/* Hero Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{data.client.name}</h1>
          <p className="mt-0.5 text-sm text-white/40">
            {t.projects} project{t.projects !== 1 ? "en" : ""} actief
          </p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/40 transition hover:bg-white/10">
          <RefreshCw className="h-3.5 w-3.5" /> Vernieuwen
        </button>
      </div>

      {/* ── Totals Row ── */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatMini icon={MessageSquare} label="Chats 24u" value={t.chats_24h} color="brand" />
        <StatMini icon={Users} label="Bezoekers" value={t.visitors_24h} color="blue" />
        <StatMini icon={ShoppingCart} label="Orders" value={t.orders_24h} color="green" />
        <StatMini icon={FileText} label="Formulieren" value={t.forms_24h} color="purple" />
        <StatMini icon={Briefcase} label="Sollicitaties" value={t.jobs_24h} color="cyan" />
        <StatMini icon={ShieldAlert} label="Alerts" value={t.open_alerts} color={t.open_alerts > 0 ? "red" : "green"} />
      </div>

      {/* ── Project Cards ── */}
      <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">
        Mijn Projecten
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.projects.map((p) => {
          const monColor = p.monitoring_status === "healthy" ? "text-green-400" : p.monitoring_status === "critical" ? "text-red-400" : p.monitoring_status === "warning" ? "text-yellow-400" : "text-white/20";
          const MonIcon = p.monitoring_status === "healthy" ? ShieldCheck : p.monitoring_status === "unconfigured" ? Shield : ShieldAlert;
          return (
            <div key={p.tenant_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10">
              {/* Project header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${p.status === "active" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <Globe className={`h-4 w-4 ${p.status === "active" ? "text-green-400" : "text-red-400"}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{p.name}</h3>
                    <p className="text-[11px] text-white/30">{p.domain}</p>
                  </div>
                </div>
                <MonIcon className={`h-4 w-4 ${monColor}`} />
              </div>

              {/* Quick stats */}
              <div className="mt-3 flex items-center gap-4 text-[10px] text-white/40">
                <span className="flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> {p.stats.chats_24h} chats</span>
                {p.stats.open_alerts > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="h-2.5 w-2.5" /> {p.stats.open_alerts}</span>}
                <span className="flex items-center gap-1"><Database className="h-2.5 w-2.5" /> {p.stats.knowledge_sources} bronnen</span>
              </div>

              {/* Modules */}
              {p.modules.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {p.modules.map((m) => {
                    const Icon = MODULE_ICONS[m.type] || Puzzle;
                    const colors = MODULE_COLORS[m.type] || "text-white/30 bg-white/5";
                    return (
                      <span key={m.type} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${colors}`}>
                        <Icon className="h-2 w-2" /> {m.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Recent Activity ── */}
      {allEvents.length > 0 && (
        <>
          <div className="mt-8 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/25">Recente Activiteit</h2>
            <Link href="/portal/events" className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300">
              Alles bekijken <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
          <div className="space-y-1.5">
            {allEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2.5 transition hover:bg-white/[0.03]">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                  e.severity === "success" ? "bg-green-500/10" : e.severity === "warning" ? "bg-yellow-500/10" : "bg-brand-500/10"
                }`}>
                  {(() => {
                    const Icon = MODULE_ICONS[e.module_type] || Activity;
                    return <Icon className={`h-3.5 w-3.5 ${
                      e.severity === "success" ? "text-green-400" : e.severity === "warning" ? "text-yellow-400" : "text-brand-400"
                    }`} />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{e.title}</p>
                  <p className="text-[10px] text-white/30">{e.project_name}</p>
                </div>
                <span className="flex-shrink-0 text-[10px] text-white/20">{timeAgo(e.created_at)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Quick Actions ── */}
      <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">
        Snel Toegang
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickAction href="/portal/requests" icon={FileEdit} label="Wijzigingen" color="orange" />
        <QuickAction href="/portal/ai" icon={Bot} label="AI Assistent" color="brand" />
        <QuickAction href="/portal/monitoring" icon={Shield} label="Monitoring" color="green" />
        <QuickAction href="/portal/conversations" icon={MessageSquare} label="Gesprekken" color="purple" />
      </div>
    </div>
  );
}

function StatMini({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    brand: "border-brand-500/20 bg-brand-500/5", blue: "border-blue-500/20 bg-blue-500/5",
    green: "border-green-500/20 bg-green-500/5", red: "border-red-500/20 bg-red-500/5",
    purple: "border-purple-500/20 bg-purple-500/5", cyan: "border-cyan-500/20 bg-cyan-500/5",
  };
  const iconMap: Record<string, string> = {
    brand: "text-brand-400", blue: "text-blue-400", green: "text-green-400",
    red: "text-red-400", purple: "text-purple-400", cyan: "text-cyan-400",
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.brand}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${iconMap[color] || iconMap.brand}`} />
        <span className="text-[9px] font-medium uppercase tracking-wider text-white/30">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, color }: { href: string; icon: any; label: string; color: string }) {
  const hoverMap: Record<string, string> = {
    orange: "hover:border-orange-500/20 hover:bg-orange-500/5", brand: "hover:border-brand-500/20 hover:bg-brand-500/5",
    green: "hover:border-green-500/20 hover:bg-green-500/5", purple: "hover:border-purple-500/20 hover:bg-purple-500/5",
  };
  const iconMap: Record<string, string> = {
    orange: "text-orange-400", brand: "text-brand-400", green: "text-green-400", purple: "text-purple-400",
  };
  return (
    <Link href={href} className={`flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition ${hoverMap[color] || ""}`}>
      <Icon className={`h-5 w-5 ${iconMap[color] || "text-white/40"}`} />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
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
