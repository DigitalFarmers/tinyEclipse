"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  MessageSquare,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Zap,
  TrendingUp,
  Eye,
} from "lucide-react";
import { getTenants, getMonitoringDashboard, getAnalytics, getOverview } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
  domain: string;
  plan: string;
  status: string;
}

interface MonitorData {
  overall_status: string;
  stats: { total_checks: number; ok: number; warning: number; critical: number };
  checks: any[];
  recent_alerts: any[];
}

interface AnalyticsData {
  summary: {
    total_sessions: number;
    total_pageviews: number;
    bounce_rate: number;
    conversion_rate: number;
    chat_engagement_rate: number;
    avg_duration_seconds: number;
    avg_pages_per_session: number;
  };
}

export default function DashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [monitorMap, setMonitorMap] = useState<Record<string, MonitorData>>({});
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, AnalyticsData>>({});
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [tenantList, overviewData] = await Promise.all([
        getTenants().catch(() => []),
        getOverview().catch(() => null),
      ]);
      setTenants(tenantList);
      setOverview(overviewData);

      // Load monitoring + analytics for each tenant
      const monMap: Record<string, MonitorData> = {};
      const anaMap: Record<string, AnalyticsData> = {};
      await Promise.all(
        tenantList.map(async (t: Tenant) => {
          try { monMap[t.id] = await getMonitoringDashboard(t.id); } catch {}
          try { anaMap[t.id] = await getAnalytics(t.id, 24); } catch {}
        })
      );
      setMonitorMap(monMap);
      setAnalyticsMap(anaMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const totalChecks = Object.values(monitorMap).reduce((a, m) => a + m.stats.total_checks, 0);
  const totalOk = Object.values(monitorMap).reduce((a, m) => a + m.stats.ok, 0);
  const totalWarning = Object.values(monitorMap).reduce((a, m) => a + m.stats.warning, 0);
  const totalCritical = Object.values(monitorMap).reduce((a, m) => a + m.stats.critical, 0);
  const totalVisitors = Object.values(analyticsMap).reduce((a, an) => a + (an?.summary?.total_sessions || 0), 0);
  const totalPageviews = Object.values(analyticsMap).reduce((a, an) => a + (an?.summary?.total_pageviews || 0), 0);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
        <h2 className="text-lg font-semibold text-red-400">Connection Error</h2>
        <p className="mt-2 text-sm text-red-300/70">{error}</p>
        <p className="mt-1 text-xs text-white/30">Check API connection at {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-white/40">Alle Digital Farmers websites op één plek</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && !tenants.length ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Loading Eclipse HUB...</span>
        </div>
      ) : (
        <>
          {/* Global Stats */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={Globe} label="Websites" value={tenants.length} color="brand" />
            <StatCard
              icon={totalCritical > 0 ? ShieldAlert : ShieldCheck}
              label="Monitoring"
              value={`${totalOk}/${totalChecks}`}
              sub={totalCritical > 0 ? `${totalCritical} critical` : "All healthy"}
              color={totalCritical > 0 ? "red" : totalWarning > 0 ? "yellow" : "green"}
            />
            <StatCard icon={Eye} label="Bezoekers (24h)" value={totalVisitors} color="purple" />
            <StatCard icon={TrendingUp} label="Pageviews (24h)" value={totalPageviews} color="blue" />
            <StatCard
              icon={MessageSquare}
              label="Gesprekken"
              value={overview?.today?.conversations || 0}
              sub={overview?.today?.escalations ? `${overview.today.escalations} escalated` : undefined}
              color={overview?.today?.escalations > 0 ? "red" : "brand"}
            />
          </div>

          {/* Websites Grid */}
          <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">
            Websites ({tenants.length})
          </h2>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {tenants.map((tenant) => (
              <WebsiteCard
                key={tenant.id}
                tenant={tenant}
                monitor={monitorMap[tenant.id]}
                analytics={analyticsMap[tenant.id]}
              />
            ))}
            {tenants.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-12 text-center">
                <Globe className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-3 text-sm text-white/40">Nog geen websites toegevoegd</p>
                <Link
                  href="/tenants"
                  className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium transition hover:bg-brand-500"
                >
                  <Zap className="h-3 w-3" /> Website Toevoegen
                </Link>
              </div>
            )}
          </div>
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
  color = "brand",
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20",
    green: "from-green-500/10 to-green-600/5 border-green-500/20",
    red: "from-red-500/10 to-red-600/5 border-red-500/20",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
  };
  const iconColors: Record<string, string> = {
    brand: "text-brand-500",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    purple: "text-purple-400",
    blue: "text-blue-400",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColors[color]}`} />
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/35">{sub}</p>}
    </div>
  );
}

function WebsiteCard({
  tenant,
  monitor,
  analytics,
}: {
  tenant: Tenant;
  monitor?: MonitorData;
  analytics?: AnalyticsData;
}) {
  const statusColor =
    monitor?.overall_status === "critical"
      ? "bg-red-500"
      : monitor?.overall_status === "warning"
      ? "bg-yellow-500"
      : monitor?.overall_status === "healthy"
      ? "bg-green-500"
      : "bg-white/20";

  const planBadge: Record<string, string> = {
    tiny: "bg-white/10 text-white/50",
    pro: "bg-brand-500/20 text-brand-400",
    pro_plus: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-white/10 hover:bg-white/[0.04]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <div>
            <h3 className="text-sm font-semibold">{tenant.name}</h3>
            <p className="text-[11px] text-white/30">{tenant.domain || "No domain"}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${planBadge[tenant.plan] || planBadge.tiny}`}>
          {tenant.plan.toUpperCase()}
        </span>
      </div>

      {/* Monitoring Summary */}
      {monitor && (
        <div className="mt-4 flex gap-2">
          {monitor.checks.slice(0, 6).map((check: any) => (
            <div
              key={check.id}
              title={`${check.type}: ${check.status}`}
              className={`h-1.5 flex-1 rounded-full ${
                check.status === "ok"
                  ? "bg-green-500/60"
                  : check.status === "warning"
                  ? "bg-yellow-500/60"
                  : check.status === "critical"
                  ? "bg-red-500/60"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>
      )}

      {/* Stats Row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MiniStat
          label="Bezoekers"
          value={analytics?.summary?.total_sessions || 0}
        />
        <MiniStat
          label="Pageviews"
          value={analytics?.summary?.total_pageviews || 0}
        />
        <MiniStat
          label="Bounce"
          value={`${analytics?.summary?.bounce_rate || 0}%`}
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/tenants/${tenant.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-[11px] font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Activity className="h-3 w-3" /> Details
        </Link>
        <Link
          href={`/monitoring?tenant=${tenant.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-[11px] font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Shield className="h-3 w-3" /> Monitor
        </Link>
        {tenant.domain && (
          <a
            href={`https://${tenant.domain}`}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center rounded-lg bg-white/5 px-3 py-2 text-white/30 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] text-white/25">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
