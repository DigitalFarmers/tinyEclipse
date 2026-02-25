"use client";

import { useEffect, useState } from "react";
import {
  Package, RefreshCw, Rocket, CheckCircle, XCircle,
  AlertTriangle, Globe, ArrowUpCircle, Clock, Shield,
} from "lucide-react";
import { StatSkeleton, ListRowSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface SiteVersion {
  tenant_id: string;
  name: string;
  domain: string;
  connector_version: string | null;
  status: "current" | "outdated" | "unknown";
}

export default function UpdaterPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "outdated" | "current" | "unknown">("all");

  useEffect(() => {
    loadVersions();
  }, []);

  async function loadVersions() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/server/plugin/versions`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }

  async function pushUpdate() {
    setPushing(true);
    setPushResult(null);
    try {
      const r = await fetch(`${API_URL}/api/admin/server/plugin/push-update`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) setPushResult(await r.json());
    } catch {}
    setPushing(false);
  }

  const sites: SiteVersion[] = data?.sites || [];
  const filtered = sites.filter(s => filter === "all" || s.status === filter);

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    current: { label: "Up-to-date", color: "text-green-400 bg-green-500/10", icon: CheckCircle },
    outdated: { label: "Verouderd", color: "text-yellow-400 bg-yellow-500/10", icon: AlertTriangle },
    unknown: { label: "Onbekend", color: "text-white/30 bg-white/5", icon: Clock },
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6 text-brand-400" /> Plugin Updater
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Push nieuwe connector versie naar alle sites in één keer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadVersions}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Scan
          </button>
          <button
            onClick={pushUpdate}
            disabled={pushing || !data || data.outdated === 0}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            <Rocket className={`h-3.5 w-3.5 ${pushing ? "animate-bounce" : ""}`} />
            {pushing ? "Pushen..." : `Push Update (${data?.outdated || 0} sites)`}
          </button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mt-6"><StatSkeleton count={4} /></div>
      ) : data ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
            <div className="text-[10px] text-brand-400/60 uppercase tracking-wider">Huidige Versie</div>
            <p className="mt-1 text-2xl font-bold text-brand-400">v{data.current_version}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Totaal Sites</div>
            <p className="mt-1 text-2xl font-bold">{data.total_sites}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="text-[10px] text-green-400/60 uppercase tracking-wider">Up-to-date</div>
            <p className="mt-1 text-2xl font-bold text-green-400">{data.up_to_date}</p>
          </div>
          <div className={`rounded-xl border p-4 ${data.outdated > 0 ? "border-yellow-500/20 bg-yellow-500/5" : "border-white/5 bg-white/[0.02]"}`}>
            <div className={`text-[10px] uppercase tracking-wider ${data.outdated > 0 ? "text-yellow-400/60" : "text-white/30"}`}>Verouderd</div>
            <p className={`mt-1 text-2xl font-bold ${data.outdated > 0 ? "text-yellow-400" : ""}`}>{data.outdated}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Onbekend</div>
            <p className="mt-1 text-2xl font-bold text-white/30">{data.unknown}</p>
          </div>
        </div>
      ) : null}

      {/* Push Result */}
      {pushResult && (
        <div className={`mt-4 rounded-xl border p-4 ${pushResult.pushed > 0 ? "border-green-500/20 bg-green-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
          <div className="flex items-center gap-3">
            {pushResult.pushed > 0 ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {pushResult.pushed} sites bijgewerkt, {pushResult.failed} mislukt
              </p>
              {pushResult.results?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pushResult.results.map((r: any, i: number) => (
                    <span
                      key={i}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        r.status === "pushed"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {r.domain}: {r.status}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && data && (
        <div className="mt-6 flex gap-1.5">
          {(["all", "outdated", "current", "unknown"] as const).map((f) => {
            const labels: Record<string, string> = { all: "Alles", outdated: "Verouderd", current: "Up-to-date", unknown: "Onbekend" };
            const counts: Record<string, number> = { all: data.total_sites, outdated: data.outdated, current: data.up_to_date, unknown: data.unknown };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                  filter === f
                    ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                    : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"
                }`}
              >
                {labels[f]} ({counts[f]})
              </button>
            );
          })}
        </div>
      )}

      {/* Sites List */}
      {loading ? (
        <div className="mt-6"><ListRowSkeleton count={8} /></div>
      ) : (
        <div className="mt-4 space-y-1.5">
          {filtered.map((site) => {
            const cfg = statusConfig[site.status] || statusConfig.unknown;
            const Icon = cfg.icon;
            return (
              <div
                key={site.tenant_id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">{site.name}</span>
                  <p className="text-[10px] text-white/25 truncate">{site.domain}</p>
                </div>
                <div className="flex items-center gap-3">
                  <code className="rounded bg-black/20 px-2 py-0.5 font-mono text-[11px] text-white/40">
                    {site.connector_version || "—"}
                  </code>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-sm text-white/30">Geen sites in deze categorie</p>
        </div>
      )}
    </div>
  );
}
