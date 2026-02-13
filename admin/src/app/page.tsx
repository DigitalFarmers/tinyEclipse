"use client";

import { useEffect, useState } from "react";
import { getOverview } from "@/lib/api";

interface OverviewData {
  tenants: { active: number; total: number };
  today: {
    conversations: number;
    escalations: number;
    tokens_in: number;
    tokens_out: number;
  };
  month: { tokens_in: number; tokens_out: number };
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
        <h2 className="text-lg font-semibold text-red-400">Connection Error</h2>
        <p className="mt-2 text-sm text-red-300">{error}</p>
        <p className="mt-1 text-xs text-red-300/60">
          Make sure the backend is running on the configured API URL.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 text-white/50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        Loading overview...
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-white/50">Situational awareness at a glance</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Tenants"
          value={data.tenants.active}
          sub={`${data.tenants.total} total`}
        />
        <StatCard
          label="Conversations Today"
          value={data.today.conversations}
          sub={`${data.today.escalations} escalated`}
          alert={data.today.escalations > 0}
        />
        <StatCard
          label="Tokens Today"
          value={formatNumber(data.today.tokens_in + data.today.tokens_out)}
          sub={`${formatNumber(data.today.tokens_in)} in / ${formatNumber(data.today.tokens_out)} out`}
        />
        <StatCard
          label="Tokens This Month"
          value={formatNumber(data.month.tokens_in + data.month.tokens_out)}
          sub={`${formatNumber(data.month.tokens_in)} in / ${formatNumber(data.month.tokens_out)} out`}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        alert
          ? "border-red-500/30 bg-red-500/5"
          : "border-white/10 bg-white/5"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
