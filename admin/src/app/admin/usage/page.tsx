"use client";

import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, MessageSquare, Zap, Clock } from "lucide-react";
import { getTenants, getUsage } from "@/lib/api";

interface Tenant { id: string; name: string; plan: string; }

export default function UsagePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getTenants().then((t) => { setTenants(t); if (t.length > 0) setSelectedTenant(t[0].id); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selectedTenant) loadUsage(); }, [selectedTenant]);

  async function loadUsage() {
    try { const u = await getUsage(selectedTenant); setUsage(u); } catch { setUsage(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage & Billing</h1>
          <p className="mt-0.5 text-sm text-white/40">Token verbruik en limieten per tenant</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            {tenants.map((t) => <option key={t.id} value={t.id} className="bg-brand-950">{t.name} ({t.plan})</option>)}
          </select>
          <button onClick={loadUsage} disabled={loading} className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      {!usage ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Geen usage data beschikbaar</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 to-brand-600/5 p-4">
            <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-brand-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Berichten</span></div>
            <p className="mt-2 text-2xl font-bold">{usage.total_messages || 0}</p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4">
            <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Tokens In</span></div>
            <p className="mt-2 text-2xl font-bold">{(usage.total_tokens_in || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
            <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-blue-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Tokens Out</span></div>
            <p className="mt-2 text-2xl font-bold">{(usage.total_tokens_out || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-green-400" /><span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Gesprekken</span></div>
            <p className="mt-2 text-2xl font-bold">{usage.total_conversations || 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}
