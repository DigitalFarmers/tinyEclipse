"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe, Users, MessageSquare, Eye, Database, UserPlus,
  Activity, ChevronRight, Heart, AlertTriangle, CheckCircle,
  TrendingUp, Zap, Building2, Search, ArrowUpDown,
} from "lucide-react";
import { getAgencyOverview } from "@/lib/api";

function HealthBadge({ score }: { score: number }) {
  const grade =
    score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" :
    score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const color =
    score >= 80 ? "text-green-400 bg-green-500/10" :
    score >= 60 ? "text-yellow-400 bg-yellow-500/10" :
    score >= 40 ? "text-orange-400 bg-orange-500/10" :
    "text-red-400 bg-red-500/10";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>
      <Heart className="h-3 w-3" /> {grade}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "up" ? "bg-green-400" : status === "down" ? "bg-red-500" : "bg-yellow-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export default function PortfolioPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"health" | "traffic" | "name">("health");

  useEffect(() => {
    getAgencyOverview()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-white/50">Fout bij het laden van portfolio data.</p>;
  }

  const { totals, clients } = data;

  // Filter & sort
  const filtered = (clients || []).filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.domains.some((d: any) => d.domain?.toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === "health") return a.avg_health_score - b.avg_health_score;
    if (sortBy === "traffic") return b.total_sessions_30d - a.total_sessions_30d;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            Portfolio Command Center
          </span>
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Eén laag boven alle sites — dieper dan DirectAdmin ⚡
        </p>
      </div>

      {/* Agency totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Klanten", value: totals.clients, icon: Users, color: "text-brand-400" },
          { label: "Domeinen", value: totals.production_domains, icon: Globe, color: "text-purple-400" },
          { label: "Sessies 30d", value: totals.sessions_30d.toLocaleString(), icon: Eye, color: "text-blue-400" },
          { label: "Gesprekken 30d", value: totals.conversations_30d, icon: MessageSquare, color: "text-green-400" },
          { label: "Bronnen", value: totals.sources, icon: Database, color: "text-yellow-400" },
          { label: "Leads", value: totals.leads, icon: UserPlus, color: "text-pink-400" },
          { label: "Events vandaag", value: totals.events_today, icon: Activity, color: "text-orange-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">{stat.label}</span>
            </div>
            <p className="mt-1 text-xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search & sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Zoek klant of domein..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(["health", "traffic", "name"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sortBy === s ? "bg-brand-500/20 text-brand-400" : "bg-white/5 text-white/40 hover:text-white"
              }`}
            >
              {s === "health" ? "⚠ Health" : s === "traffic" ? "📊 Traffic" : "🔤 Naam"}
            </button>
          ))}
        </div>
      </div>

      {/* Client cards */}
      <div className="space-y-4">
        {sorted.map((client: any) => (
          <div key={client.account_id} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
            {/* Client header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20">
                  <Building2 className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{client.name}</h3>
                  <p className="text-xs text-white/40">
                    {client.production_domains} domein{client.production_domains !== 1 ? "en" : ""}
                    {client.staging_domains > 0 && ` + ${client.staging_domains} staging`}
                    {client.company && ` · ${client.company}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <HealthBadge score={client.avg_health_score} />
                <Link
                  href={`/admin/portfolio/${client.account_id}`}
                  className="flex items-center gap-1 rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-400 transition hover:bg-brand-500/20"
                >
                  Portfolio <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Domains grid */}
            <div className="grid gap-0 divide-y divide-white/5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3 xl:grid-cols-4">
              {client.domains.map((domain: any) => (
                <div key={domain.tenant_id} className="p-4 transition hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={domain.uptime_status} />
                      <span className="text-sm font-medium">{domain.domain || domain.name}</span>
                    </div>
                    <HealthBadge score={domain.health_score} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase text-white/25">Sessies</p>
                      <p className="text-sm font-semibold">{domain.sessions_30d.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-white/25">Gesprekken</p>
                      <p className="text-sm font-semibold">{domain.conversations_30d}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-white/25">Bronnen</p>
                      <p className="text-sm font-semibold">{domain.sources}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-white/25">Leads</p>
                      <p className="text-sm font-semibold">{domain.leads}</p>
                    </div>
                  </div>

                  {domain.open_gaps > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400/70">
                      <AlertTriangle className="h-3 w-3" />
                      {domain.open_gaps} open gap{domain.open_gaps !== 1 ? "s" : ""}
                    </div>
                  )}

                  {domain.response_ms && (
                    <div className="mt-1 text-[10px] text-white/25">
                      {domain.response_ms}ms responstijd
                      {domain.site_rating && ` · ${domain.site_rating}`}
                    </div>
                  )}

                  <div className="mt-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      domain.plan === "pro_plus" ? "bg-purple-500/10 text-purple-400" :
                      domain.plan === "pro" ? "bg-brand-500/10 text-brand-400" :
                      "bg-white/5 text-white/40"
                    }`}>
                      {domain.plan.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Client summary bar */}
            <div className="flex items-center gap-6 border-t border-white/5 bg-white/[0.01] px-5 py-2 text-[11px] text-white/30">
              <span>📊 {client.total_sessions_30d.toLocaleString()} sessies</span>
              <span>💬 {client.total_conversations_30d} gesprekken</span>
              <span>📚 {client.total_sources} bronnen</span>
              <span>🎯 {client.total_leads} leads</span>
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
          <Globe className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">
            {search ? "Geen klanten gevonden voor deze zoekopdracht." : "Nog geen klanten geregistreerd."}
          </p>
        </div>
      )}
    </div>
  );
}
