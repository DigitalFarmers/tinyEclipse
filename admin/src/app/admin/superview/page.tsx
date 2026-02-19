"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Users,
  MessageSquare,
  ShieldAlert,
  Database,
  Briefcase,
  ShoppingCart,
  Gift,
  FileText,
  Mail,
  BookOpen,
  Calendar,
  MessageCircle,
  Puzzle,
  RefreshCw,
  Eye,
  Zap,
  TrendingUp,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface TenantSummary {
  tenant_id: string;
  name: string;
  domain: string;
  plan: string;
  status: string;
  environment?: string;
  whmcs_client_id: number;
  chats_24h: number;
  open_alerts: number;
  modules: string[];
}

interface SuperviewData {
  total_tenants: number;
  total_active: number;
  global_stats: {
    conversations_24h: number;
    conversations_7d: number;
    visitors_24h: number;
    open_alerts: number;
    total_sources: number;
  };
  module_distribution: Record<string, number>;
  tenants: TenantSummary[];
}

const MODULE_ICONS: Record<string, any> = {
  jobs: Briefcase,
  shop: ShoppingCart,
  giftcard: Gift,
  forms: FileText,
  mail: Mail,
  blog: BookOpen,
  booking: Calendar,
  forum: MessageCircle,
  custom: Puzzle,
};

const MODULE_COLORS: Record<string, string> = {
  jobs: "text-blue-400 bg-blue-500/10",
  shop: "text-green-400 bg-green-500/10",
  giftcard: "text-pink-400 bg-pink-500/10",
  forms: "text-purple-400 bg-purple-500/10",
  mail: "text-orange-400 bg-orange-500/10",
  blog: "text-cyan-400 bg-cyan-500/10",
  booking: "text-yellow-400 bg-yellow-500/10",
  forum: "text-indigo-400 bg-indigo-500/10",
};

const PLAN_COLORS: Record<string, string> = {
  tiny: "bg-white/10 text-white/50",
  pro: "bg-brand-500/20 text-brand-400",
  pro_plus: "bg-purple-500/20 text-purple-400",
};

export default function AdminSuperviewPage() {
  const [data, setData] = useState<SuperviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/projects/admin/superview`, {
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
        <span className="ml-3 text-sm">Superview laden...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-white/40">Kon superview niet laden.</div>;
  }

  const filtered = data.tenants.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.domain?.toLowerCase().includes(search.toLowerCase()) ||
      t.modules.some((m) => m.includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6 text-brand-400" />
            Superview
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Alle klanten, domeinen en modules in één overzicht
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Vernieuwen
        </button>
      </div>

      {/* Global Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Globe} label="Projecten" value={data.total_active} sub={`${data.total_tenants} totaal`} color="brand" />
        <StatCard icon={MessageSquare} label="Chats 24u" value={data.global_stats.conversations_24h} sub={`${data.global_stats.conversations_7d} in 7d`} color="blue" />
        <StatCard icon={Users} label="Bezoekers 24u" value={data.global_stats.visitors_24h} color="green" />
        <StatCard icon={ShieldAlert} label="Open Alerts" value={data.global_stats.open_alerts} color={data.global_stats.open_alerts > 0 ? "red" : "green"} />
        <StatCard icon={Database} label="Kennisbronnen" value={data.global_stats.total_sources} color="purple" />
      </div>

      {/* Module Distribution */}
      {Object.keys(data.module_distribution).length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-widest text-white/25">
            Module Verdeling
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.module_distribution).map(([mod, count]) => {
              const Icon = MODULE_ICONS[mod] || Puzzle;
              const colors = MODULE_COLORS[mod] || "text-white/50 bg-white/5";
              return (
                <div key={mod} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${colors}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{mod}</span>
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Search */}
      <div className="mt-8 mb-4">
        <input
          type="text"
          placeholder="Zoek op naam, domein of module..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/30"
        />
      </div>

      {/* Grouped by Client */}
      {(() => {
        // Group filtered tenants by whmcs_client_id
        const groups: Record<number, { tenants: typeof filtered; totalChats: number; totalAlerts: number }> = {};
        for (const t of filtered) {
          if (!groups[t.whmcs_client_id]) groups[t.whmcs_client_id] = { tenants: [], totalChats: 0, totalAlerts: 0 };
          groups[t.whmcs_client_id].tenants.push(t);
          groups[t.whmcs_client_id].totalChats += t.chats_24h;
          groups[t.whmcs_client_id].totalAlerts += t.open_alerts;
        }

        return Object.entries(groups).map(([whmcsId, group]) => {
          const prod = group.tenants.filter(t => t.environment !== "staging");
          const staging = group.tenants.filter(t => t.environment === "staging");
          const clientName = prod[0]?.name || staging[0]?.name || `Client #${whmcsId}`;

          return (
            <div key={whmcsId} className="mb-6">
              {/* Client header */}
              <div className="mb-3 flex items-center justify-between">
                <a href={`/admin/clients/${whmcsId}`} className="flex items-center gap-3 transition hover:opacity-80">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20">
                    <Users className="h-4 w-4 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{clientName}</h3>
                    <p className="text-[10px] text-white/30">
                      WHMCS #{whmcsId} · {prod.length} project{prod.length !== 1 ? "en" : ""}
                      {staging.length > 0 && ` · ${staging.length} staging`}
                    </p>
                  </div>
                </a>
                <div className="flex items-center gap-3 text-[10px] text-white/30">
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {group.totalChats}</span>
                  {group.totalAlerts > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="h-3 w-3" /> {group.totalAlerts}</span>}
                </div>
              </div>

              {/* Tenant cards */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.tenants.map((t) => {
                  const isStaging = t.environment === "staging";
                  return (
                    <div
                      key={t.tenant_id}
                      className={`rounded-xl border p-4 transition hover:border-white/10 ${
                        isStaging
                          ? "border-yellow-500/10 bg-yellow-500/[0.02] opacity-70"
                          : t.open_alerts > 0
                          ? "border-red-500/20 bg-red-500/[0.02]"
                          : t.status === "active"
                          ? "border-white/5 bg-white/[0.02]"
                          : "border-white/5 bg-white/[0.01] opacity-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold">{t.name}</h3>
                            {isStaging && <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">staging</span>}
                          </div>
                          <p className="text-[11px] text-white/30">{t.domain}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${PLAN_COLORS[t.plan] || PLAN_COLORS.tiny}`}>
                          {t.plan}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-[10px] text-white/40">
                        <span className="flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> {t.chats_24h} chats</span>
                        {t.open_alerts > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="h-2.5 w-2.5" /> {t.open_alerts}</span>}
                      </div>

                      {t.modules.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.modules.map((mod) => {
                            const Icon = MODULE_ICONS[mod] || Puzzle;
                            return (
                              <span key={mod} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] ${MODULE_COLORS[mod] || "text-white/30 bg-white/5"}`}>
                                <Icon className="h-2 w-2" /> {mod}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        <a href={`/admin/tenants/${t.tenant_id}`} className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-white/40 transition hover:bg-white/10 hover:text-white/60">Details →</a>
                        {!isStaging && <a href={`/portal?sso=${t.tenant_id}`} target="_blank" className="rounded-lg bg-brand-500/10 px-2.5 py-1 text-[10px] text-brand-400 transition hover:bg-brand-500/20">Portal →</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-white/30">
          Geen resultaten voor &quot;{search}&quot;
        </div>
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
  value: number;
  sub?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    brand: "border-brand-500/20 bg-brand-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    green: "border-green-500/20 bg-green-500/5",
    red: "border-red-500/20 bg-red-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
  };
  const iconColorMap: Record<string, string> = {
    brand: "text-brand-400",
    blue: "text-blue-400",
    green: "text-green-400",
    red: "text-red-400",
    purple: "text-purple-400",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.brand}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColorMap[color] || iconColorMap.brand}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}
