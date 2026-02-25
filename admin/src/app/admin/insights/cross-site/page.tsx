"use client";

import { useEffect, useState } from "react";
import {
  Brain, RefreshCw, TrendingUp, Globe, Shield, Zap, Languages,
  ShoppingCart, Smartphone, ArrowUpRight, ChevronDown, Sparkles,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

async function apiFetch(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "X-Admin-Key": ADMIN_KEY },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  traffic: { icon: TrendingUp, color: "brand", label: "Verkeer" },
  conversion: { icon: ShoppingCart, color: "green", label: "Conversie" },
  translation: { icon: Languages, color: "purple", label: "Vertaling" },
  security: { icon: Shield, color: "red", label: "Beveiliging" },
  performance: { icon: Zap, color: "yellow", label: "Performance" },
  ux: { icon: Smartphone, color: "blue", label: "UX" },
  mobile: { icon: Smartphone, color: "blue", label: "Mobiel" },
};

function ImpactBadge({ score }: { score: number }) {
  const cls = score >= 70
    ? "bg-red-500/15 text-red-400 border-red-500/20"
    : score >= 40
    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
    : "bg-white/5 text-white/40 border-white/10";
  const label = score >= 70 ? "Hoog" : score >= 40 ? "Medium" : "Laag";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {label} ({score})
    </span>
  );
}

export default function CrossSiteInsightsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedInsights, setExpandedInsights] = useState<Record<number, boolean>>({});
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => {
    apiFetch("/api/admin/clients/").then((c) => {
      const list = c.clients || c || [];
      setClients(list);
      if (list.length > 0) setSelectedClient(list[0].whmcs_client_id || list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (selectedClient) loadData(); }, [selectedClient]);

  async function loadData() {
    setLoading(true);
    try { setData(await apiFetch(`/api/admin/intelligence/cross-site/${selectedClient}`)); }
    catch { setData(null); }
    finally { setLoading(false); }
  }

  const toggleInsight = (i: number) => setExpandedInsights(p => ({ ...p, [i]: !p[i] }));

  const filteredInsights = data?.insights?.filter((ins: any) =>
    filterCategory === "all" || ins.category === filterCategory
  ) || [];

  const categories: string[] = Array.from(new Set((data?.insights || []).map((i: any) => i.category as string)));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Brain className="h-6 w-6 text-brand-400" /> Cross-Site Intelligence
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            AI-gestuurde inzichten over je hele digitale ecosysteem
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            {clients.map((c: any) => (
              <option key={c.whmcs_client_id || c.id} value={c.whmcs_client_id || c.id} className="bg-brand-950">
                {c.company_name || c.name || `Client #${c.whmcs_client_id}`}
              </option>
            ))}
          </select>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-brand-500/15 px-4 py-2 text-xs font-medium text-brand-400 transition hover:bg-brand-500/25 disabled:opacity-50">
            <Sparkles className={`h-3.5 w-3.5 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Analyseren..." : "Analyseer"}
          </button>
        </div>
      </div>

      {/* Sites */}
      {data?.tenants && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.tenants.map((t: any) => (
            <div key={t.id} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px]">
              <Globe className="h-3 w-3 text-brand-400" />
              <span className="text-white/60 font-medium">{t.name}</span>
              <span className="text-white/20">{t.domain}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {data?.summary && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
            <p className="text-[10px] text-white/30 uppercase">Totaal Inzichten</p>
            <p className="text-2xl font-bold mt-1">{data.summary.total_insights}</p>
          </div>
          <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4 text-center">
            <p className="text-[10px] text-red-400/50 uppercase">Hoge Impact</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{data.summary.high_impact}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] p-4 text-center">
            <p className="text-[10px] text-yellow-400/50 uppercase">Medium Impact</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{data.summary.medium_impact}</p>
          </div>
        </div>
      )}

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button onClick={() => setFilterCategory("all")}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition ${filterCategory === "all" ? "bg-brand-500/20 text-brand-400" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
            Alle ({data?.insights?.length || 0})
          </button>
          {categories.map((cat: string) => {
            const cfg = CATEGORY_CONFIG[cat] || { icon: Globe, color: "white", label: cat };
            const count = data?.insights?.filter((i: any) => i.category === cat).length || 0;
            return (
              <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium transition ${filterCategory === cat ? "bg-brand-500/20 text-brand-400" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Insights */}
      {filteredInsights.length > 0 ? (
        <div className="mt-6 space-y-3">
          {filteredInsights.map((ins: any, i: number) => {
            const cfg = CATEGORY_CONFIG[ins.category] || { icon: Globe, color: "white", label: ins.category };
            const Icon = cfg.icon;
            return (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleInsight(i)}>
                  <div className="mt-0.5 flex-shrink-0">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{ins.title}</span>
                      <ImpactBadge score={ins.impact_score} />
                    </div>
                    <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{ins.description}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-white/20 flex-shrink-0 transition-transform ${expandedInsights[i] ? "rotate-180" : ""}`} />
                </div>

                {expandedInsights[i] && (
                  <div className="border-t border-white/5 px-4 py-3 bg-white/[0.01]">
                    <p className="text-xs text-white/50">{ins.description}</p>
                    {ins.action && (
                      <div className="mt-3 flex items-center gap-2">
                        <ArrowUpRight className="h-3.5 w-3.5 text-brand-400" />
                        <span className="text-xs font-medium text-brand-400">{ins.action}</span>
                      </div>
                    )}
                    {ins.affected_sites && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ins.affected_sites.map((s: string) => (
                          <span key={s} className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !loading && (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Brain className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">
            {data ? "Geen inzichten gevonden — alles ziet er goed uit!" : "Selecteer een klant om te analyseren"}
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-[10px] text-white/15">
        Cross-Site Intelligence — patronen detecteren over je hele ecosysteem
      </p>
    </div>
  );
}
