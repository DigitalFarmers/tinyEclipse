"use client";

import { useEffect, useState } from "react";
import { Bell, ShieldAlert, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { getTenants, getAlerts, acknowledgeAlert, resolveAlert } from "@/lib/api";

interface Tenant { id: string; name: string; }
interface Alert { id: string; tenant_id: string; check_type: string; severity: string; message: string; created_at: string; acknowledged: boolean; resolved: boolean; }

export default function AlertsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [showResolved]);

  async function loadAll() {
    setLoading(true);
    try {
      const ts = await getTenants().catch(() => []);
      setTenants(ts);
      const all: Alert[] = [];
      await Promise.all(ts.map(async (t: Tenant) => { try { const a = await getAlerts(t.id, showResolved); all.push(...a.map((al: any) => ({ ...al, tenant_id: t.id }))); } catch {} }));
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAlerts(all);
    } finally { setLoading(false); }
  }

  const tn = (id: string) => tenants.find((t) => t.id === id)?.name || id.slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Alerts</h1><p className="mt-0.5 text-sm text-white/40">Monitoring alerts voor alle websites</p></div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-white/50"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="rounded border-white/20" />Toon opgeloste</label>
          <button onClick={loadAll} disabled={loading} className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" /><span className="text-sm">Loading...</span></div>
      ) : alerts.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center"><CheckCircle className="mx-auto h-8 w-8 text-green-500/40" /><p className="mt-3 text-sm text-white/40">{showResolved ? "Geen alerts" : "Geen actieve alerts — alles draait soepel!"}</p></div>
      ) : (
        <div className="mt-6 space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={`flex items-center justify-between rounded-xl border p-4 ${a.resolved ? "border-white/5 bg-white/[0.02]" : a.severity === "critical" ? "border-red-500/20 bg-red-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
              <div className="flex items-center gap-3">
                {a.resolved ? <CheckCircle className="h-4 w-4 text-green-400" /> : a.severity === "critical" ? <ShieldAlert className="h-4 w-4 text-red-400" /> : <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                <div><p className="text-xs font-medium">{a.message}</p><p className="text-[10px] text-white/30">{tn(a.tenant_id)} · {a.check_type} · {new Date(a.created_at).toLocaleString("nl-BE")}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {!a.resolved && (<>
                  {!a.acknowledged && <button onClick={async () => { await acknowledgeAlert(a.id); await loadAll(); }} className="rounded-lg bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white/50 transition hover:bg-white/10">Ack</button>}
                  <button onClick={async () => { await resolveAlert(a.id); await loadAll(); }} className="rounded-lg bg-green-500/10 px-3 py-1.5 text-[10px] font-medium text-green-400 transition hover:bg-green-500/20">Resolve</button>
                </>)}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${a.resolved ? "bg-green-500/20 text-green-400" : a.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{a.resolved ? "Resolved" : a.severity}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
