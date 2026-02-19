"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Globe,
  MessageSquare,
  ShieldAlert,
  Database,
  Activity,
  RefreshCw,
  ChevronRight,
  Briefcase,
  ShoppingCart,
  Gift,
  FileText,
  Mail,
  BookOpen,
  Calendar,
  MessageCircle,
  Puzzle,
  Crown,
  Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

const MODULE_ICONS: Record<string, any> = {
  jobs: Briefcase, shop: ShoppingCart, giftcard: Gift, forms: FileText,
  mail: Mail, blog: BookOpen, booking: Calendar, forum: MessageCircle, custom: Puzzle,
};

const PLAN_COLORS: Record<string, string> = {
  tiny: "bg-white/10 text-white/50",
  pro: "bg-brand-500/20 text-brand-400",
  pro_plus: "bg-purple-500/20 text-purple-400",
};

interface ClientAccount {
  id: string;
  whmcs_client_id: number;
  name: string;
  email: string | null;
  company: string | null;
  project_count: number;
  production_count: number;
  staging_count: number;
  stats: {
    chats_24h: number;
    open_alerts: number;
    total_sources: number;
    module_events_24h: number;
  };
  plans: string[];
  tenants: Array<{
    id: string;
    name: string;
    domain: string;
    plan: string;
    status: string;
    environment: string;
  }>;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/clients/`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        cache: "no-store",
      });
      if (r.ok) setClients(await r.json());
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/40">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
        <span className="ml-3 text-sm">Klanten laden...</span>
      </div>
    );
  }

  const totalProjects = clients.reduce((s, c) => s + c.project_count, 0);
  const totalAlerts = clients.reduce((s, c) => s + c.stats.open_alerts, 0);
  const totalChats = clients.reduce((s, c) => s + c.stats.chats_24h, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-400" />
            Klanten
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            {clients.length} klant{clients.length !== 1 ? "en" : ""} · {totalProjects} projecten
          </p>
        </div>
        <button onClick={loadClients} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10">
          <RefreshCw className="h-3.5 w-3.5" /> Vernieuwen
        </button>
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Klanten</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{clients.length}</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Chats 24u</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{totalChats}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Open Alerts</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{totalAlerts}</p>
        </div>
      </div>

      {/* Client Cards */}
      <div className="mt-8 space-y-3">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.whmcs_client_id}`}
            className="block rounded-xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-white/10 hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-purple-500/20">
                  <Users className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{c.name}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/30">
                    <span>WHMCS #{c.whmcs_client_id}</span>
                    {c.email && <span>· {c.email}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.plans.map((plan) => (
                  <span key={plan} className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${PLAN_COLORS[plan] || PLAN_COLORS.tiny}`}>
                    {plan.replace("_", "+")}
                  </span>
                ))}
                <ChevronRight className="h-4 w-4 text-white/20" />
              </div>
            </div>

            {/* Projects row */}
            <div className="mt-3 flex flex-wrap gap-2">
              {c.tenants.filter(t => t.environment === "production").map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
                  <Globe className={`h-3 w-3 ${t.status === "active" ? "text-green-400" : "text-red-400"}`} />
                  <span className="text-[11px] font-medium">{t.domain || t.name}</span>
                </div>
              ))}
              {c.staging_count > 0 && (
                <div className="flex items-center gap-1 rounded-lg border border-yellow-500/10 bg-yellow-500/5 px-2 py-1.5">
                  <span className="text-[10px] text-yellow-400">+{c.staging_count} staging</span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-3 flex items-center gap-5 text-[10px] text-white/30">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-2.5 w-2.5" /> {c.stats.chats_24h} chats
              </span>
              {c.stats.open_alerts > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <ShieldAlert className="h-2.5 w-2.5" /> {c.stats.open_alerts} alerts
                </span>
              )}
              <span className="flex items-center gap-1">
                <Database className="h-2.5 w-2.5" /> {c.stats.total_sources} bronnen
              </span>
              {c.stats.module_events_24h > 0 && (
                <span className="flex items-center gap-1">
                  <Activity className="h-2.5 w-2.5" /> {c.stats.module_events_24h} events
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {clients.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Nog geen klanten.</p>
        </div>
      )}
    </div>
  );
}
