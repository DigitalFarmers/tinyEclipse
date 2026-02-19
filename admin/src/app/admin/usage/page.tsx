"use client";

import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, MessageSquare, Zap, Clock, TrendingUp, ArrowUpRight, DollarSign } from "lucide-react";
import { getTenants, getUsage } from "@/lib/api";

interface Tenant { id: string; name: string; plan: string; domain: string; environment?: string; }

export default function UsagePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [globalUsage, setGlobalUsage] = useState<any>(null);
  const [tenantUsage, setTenantUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTenants().catch(() => []),
      getUsage().catch(() => null),
    ]).then(([ts, gu]) => {
      setTenants(ts);
      setGlobalUsage(gu);
      if (ts.length > 0) setSelectedTenant(ts[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedTenant) loadTenantUsage();
  }, [selectedTenant]);

  async function loadTenantUsage() {
    try { setTenantUsage(await getUsage(selectedTenant)); } catch { setTenantUsage(null); }
  }

  async function refresh() {
    setLoading(true);
    try {
      const [gu, tu] = await Promise.all([
        getUsage().catch(() => null),
        selectedTenant ? getUsage(selectedTenant).catch(() => null) : null,
      ]);
      setGlobalUsage(gu);
      if (tu) setTenantUsage(tu);
    } finally { setLoading(false); }
  }

  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  const prodTenants = tenants.filter(t => t.environment !== "staging");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-brand-400" /> Usage & Billing
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Token verbruik, API requests en kosten</p>
        </div>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Global Usage */}
      {globalUsage && (
        <>
          <h2 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Platform Totaal</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <UC icon={Zap} label="Tokens In" today={globalUsage.today?.tokens_in} month={globalUsage.month?.tokens_in} total={globalUsage.all_time?.tokens_in} color="brand" />
            <UC icon={Zap} label="Tokens Out" today={globalUsage.today?.tokens_out} month={globalUsage.month?.tokens_out} total={globalUsage.all_time?.tokens_out} color="purple" />
            <UC icon={MessageSquare} label="Requests" today={globalUsage.today?.requests} month={globalUsage.month?.requests} total={globalUsage.all_time?.requests} color="blue" />
            <UC icon={DollarSign} label="Kosten (est.)" today={estCost(globalUsage.today)} month={estCost(globalUsage.month)} total={estCost(globalUsage.all_time)} color="green" isCost />
            <UC icon={TrendingUp} label="Gem/dag" today={null} month={avgPerDay(globalUsage.month?.requests, 30)} total={null} color="yellow" />
            <UC icon={Clock} label="Totaal tokens" today={null} month={null} total={(globalUsage.all_time?.tokens_in || 0) + (globalUsage.all_time?.tokens_out || 0)} color="red" />
          </div>
        </>
      )}

      {/* Per-Tenant Usage */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/25">Per Website</h2>
          <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            {prodTenants.map(t => <option key={t.id} value={t.id} className="bg-brand-950">{t.name} ({t.plan})</option>)}
          </select>
        </div>

        {tenantUsage ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <div className="rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 to-brand-600/5 p-4">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-brand-400" /><span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Tokens In (vandaag)</span></div>
              <p className="mt-2 text-xl font-bold">{fmt(tenantUsage.today?.tokens_in || 0)}</p>
              <p className="mt-0.5 text-[10px] text-white/30">Maand: {fmt(tenantUsage.month?.tokens_in || 0)}</p>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-400" /><span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Tokens Out (vandaag)</span></div>
              <p className="mt-2 text-xl font-bold">{fmt(tenantUsage.today?.tokens_out || 0)}</p>
              <p className="mt-0.5 text-[10px] text-white/30">Maand: {fmt(tenantUsage.month?.tokens_out || 0)}</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
              <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-400" /><span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Requests (vandaag)</span></div>
              <p className="mt-2 text-xl font-bold">{tenantUsage.today?.requests || 0}</p>
              <p className="mt-0.5 text-[10px] text-white/30">Maand: {tenantUsage.month?.requests || 0}</p>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
              <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-400" /><span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Kosten (est.)</span></div>
              <p className="mt-2 text-xl font-bold">€{estCost(tenantUsage.month)}</p>
              <p className="mt-0.5 text-[10px] text-white/30">Totaal: €{estCost(tenantUsage.all_time)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <BarChart3 className="mx-auto h-6 w-6 text-white/15" />
            <p className="mt-2 text-xs text-white/30">Geen usage data voor deze tenant</p>
          </div>
        )}
      </div>

      {/* All Tenants Overview */}
      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Alle Sites Vergelijking</h2>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-left text-white/30">
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5 text-right">Requests/maand</th>
                <th className="px-4 py-2.5 text-right">Tokens/maand</th>
              </tr>
            </thead>
            <tbody>
              {prodTenants.map(t => {
                const planColors: Record<string, string> = { tiny: "bg-white/10 text-white/50", pro: "bg-brand-500/20 text-brand-400", pro_plus: "bg-purple-500/20 text-purple-400" };
                return (
                  <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-medium">{t.name}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${planColors[t.plan] || planColors.tiny}`}>{t.plan.replace("_", "+")}</span></td>
                    <td className="px-4 py-2.5 text-right text-white/50">—</td>
                    <td className="px-4 py-2.5 text-right text-white/50">—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UC({ icon: Icon, label, today, month, total, color, isCost }: any) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
    green: "from-green-500/10 to-green-600/5 border-green-500/20",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20",
    red: "from-red-500/10 to-red-600/5 border-red-500/20",
  };
  const ic: Record<string, string> = { brand: "text-brand-400", purple: "text-purple-400", blue: "text-blue-400", green: "text-green-400", yellow: "text-yellow-400", red: "text-red-400" };
  const fmt = (n: number | null) => {
    if (n === null || n === undefined) return "—";
    if (isCost) return `€${n}`;
    return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${ic[color]}`} />
        <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{fmt(month ?? total)}</p>
      {today !== null && today !== undefined && <p className="text-[10px] text-white/30">Vandaag: {fmt(today)}</p>}
      {total !== null && total !== undefined && month !== null && <p className="text-[10px] text-white/25">Totaal: {fmt(total)}</p>}
    </div>
  );
}

function estCost(period: any): string {
  if (!period) return "0.00";
  const tokensIn = period.tokens_in || 0;
  const tokensOut = period.tokens_out || 0;
  const cost = (tokensIn * 0.00000015) + (tokensOut * 0.0000006);
  return cost.toFixed(2);
}

function avgPerDay(value: number | undefined, days: number): number | null {
  if (!value) return null;
  return Math.round(value / days);
}
