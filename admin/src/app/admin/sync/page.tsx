"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw, Link2, Package, ArrowLeftRight, CheckCircle, AlertTriangle,
  XCircle, Plus, Trash2, ToggleLeft, ToggleRight, Clock, ChevronDown,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

interface SyncMember {
  id: string; tenant_id: string; remote_id: string;
  sku: string | null; title: string | null; status: string;
  last_synced_at: string | null;
}

interface SyncGroup {
  id: string; name: string; entity_type: string;
  direction: string; enabled: boolean; member_count: number;
  members: SyncMember[]; created_at: string;
}

interface SyncLog {
  action: string; entity_type: string; status: string;
  changes: any; created_at: string;
}

interface DashboardData {
  stats: { total_groups: number; total_members: number; synced: number; conflicts: number; errors: number };
  groups: SyncGroup[];
  recent_logs: SyncLog[];
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function SyncPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
    try {
      setData(await apiFetch(`/api/admin/sync/dashboard/${selectedClient}`));
    } catch { setData(null); }
    finally { setLoading(false); }
  }

  async function toggleGroup(groupId: string) {
    await apiFetch(`/api/admin/sync/groups/${groupId}/toggle`, { method: "PATCH" });
    await loadData();
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("Sync groep verwijderen?")) return;
    await apiFetch(`/api/admin/sync/groups/${groupId}`, { method: "DELETE" });
    await loadData();
  }

  const toggleExpand = (id: string) => setExpandedGroups(p => ({ ...p, [id]: !p[id] }));

  const st = data?.stats;
  const statusIcon = (s: string) => {
    if (s === "synced") return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
    if (s === "conflict") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />;
    if (s === "error") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    return <Clock className="h-3.5 w-3.5 text-white/30" />;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ArrowLeftRight className="h-6 w-6 text-brand-400" /> Cross-Site Sync
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Product, voorraad & klant synchronisatie</p>
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
            className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {st && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
            <p className="text-[10px] text-white/30 uppercase">Groepen</p>
            <p className="text-2xl font-bold mt-1">{st.total_groups}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
            <p className="text-[10px] text-white/30 uppercase">Leden</p>
            <p className="text-2xl font-bold mt-1">{st.total_members}</p>
          </div>
          <div className="rounded-xl border border-green-500/10 bg-green-500/[0.03] p-4 text-center">
            <p className="text-[10px] text-green-400/50 uppercase">Gesynchroniseerd</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{st.synced}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] p-4 text-center">
            <p className="text-[10px] text-yellow-400/50 uppercase">Conflicten</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{st.conflicts}</p>
          </div>
          <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4 text-center">
            <p className="text-[10px] text-red-400/50 uppercase">Fouten</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{st.errors}</p>
          </div>
        </div>
      )}

      {/* Sync Groups */}
      {data?.groups && data.groups.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/25">Sync Groepen</h2>
          {data.groups.map((g) => (
            <div key={g.id} className={`rounded-xl border overflow-hidden ${g.enabled ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-60"}`}>
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggleExpand(g.id)}>
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-brand-400" />
                  <div>
                    <p className="text-sm font-semibold">{g.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-400 uppercase">{g.entity_type}</span>
                      <span className="text-[10px] text-white/30">{g.direction === "bidirectional" ? "↔ Bidirectioneel" : "→ Master-slave"}</span>
                      <span className="text-[10px] text-white/20">{g.members?.length || 0} sites</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleGroup(g.id)} className="p-1 rounded hover:bg-white/10 transition" title={g.enabled ? "Uitschakelen" : "Inschakelen"}>
                    {g.enabled ? <ToggleRight className="h-5 w-5 text-green-400" /> : <ToggleLeft className="h-5 w-5 text-white/20" />}
                  </button>
                  <button onClick={() => deleteGroup(g.id)} className="p-1 rounded hover:bg-red-500/10 transition" title="Verwijderen">
                    <Trash2 className="h-3.5 w-3.5 text-white/20 hover:text-red-400" />
                  </button>
                  <ChevronDown className={`h-3.5 w-3.5 text-white/20 transition-transform ${expandedGroups[g.id] ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedGroups[g.id] && g.members && (
                <div className="border-t border-white/5 px-4 py-3 space-y-2">
                  {g.members.map((m) => (
                    <div key={m.id || m.remote_id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-[11px]">
                      {statusIcon(m.status)}
                      <span className="text-white/50 w-24 truncate">{m.tenant_id?.slice(0, 8)}</span>
                      <span className="text-white/40">#{m.remote_id}</span>
                      {m.sku && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/30 font-mono">{m.sku}</span>}
                      <span className="text-white/60 truncate flex-1">{m.title || "—"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                        m.status === "synced" ? "bg-green-500/15 text-green-400" :
                        m.status === "conflict" ? "bg-yellow-500/15 text-yellow-400" :
                        m.status === "error" ? "bg-red-500/15 text-red-400" :
                        "bg-white/5 text-white/30"
                      }`}>{m.status}</span>
                      {m.last_synced_at && <span className="text-[9px] text-white/15">{timeAgo(m.last_synced_at)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !loading && (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Link2 className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Geen sync groepen geconfigureerd</p>
          <p className="mt-1 text-xs text-white/20">Maak een sync groep aan om producten en voorraad te synchroniseren tussen sites</p>
        </div>
      )}

      {/* Recent Sync Logs */}
      {data?.recent_logs && data.recent_logs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3">Recente Sync Activiteit</h2>
          <div className="space-y-1">
            {data.recent_logs.map((l, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
                {statusIcon(l.status)}
                <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[9px] text-brand-400 font-medium">{l.action}</span>
                <span className="text-white/40">{l.entity_type}</span>
                <span className="text-white/25 flex-1 truncate">{JSON.stringify(l.changes).slice(0, 80)}</span>
                <span className="text-[9px] text-white/15">{timeAgo(l.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-[10px] text-white/15">
        Cross-Site Sync Engine — real-time product & voorraad synchronisatie
      </p>
    </div>
  );
}
