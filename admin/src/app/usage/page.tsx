"use client";

import { useEffect, useState } from "react";
import { getUsage } from "@/lib/api";

interface UsageData {
  today: { tokens_in: number; tokens_out: number; requests: number };
  month: { tokens_in: number; tokens_out: number; requests: number };
  all_time: { tokens_in: number; tokens_out: number; requests: number };
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsage()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 text-white/50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        Loading usage data...
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Usage & Limits</h1>
      <p className="mt-1 text-sm text-white/50">Token consumption and request counts</p>

      <div className="mt-8 space-y-6">
        <UsageSection title="Today" data={data.today} />
        <UsageSection title="This Month" data={data.month} />
        <UsageSection title="All Time" data={data.all_time} />
      </div>
    </div>
  );
}

function UsageSection({
  title,
  data,
}: {
  title: string;
  data: { tokens_in: number; tokens_out: number; requests: number };
}) {
  return (
    <div className="rounded-xl border border-white/10 p-5">
      <h3 className="text-sm font-semibold text-white/60">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-white/40">Tokens In</p>
          <p className="mt-1 text-2xl font-bold">{formatNumber(data.tokens_in)}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Tokens Out</p>
          <p className="mt-1 text-2xl font-bold">{formatNumber(data.tokens_out)}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Requests</p>
          <p className="mt-1 text-2xl font-bold">{formatNumber(data.requests)}</p>
        </div>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
