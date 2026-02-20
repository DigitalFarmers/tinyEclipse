"use client";

import { useEffect, useState } from "react";
import {
  FileEdit, CheckCircle, Clock, Loader2, XCircle, MessageSquare,
  FileText, ShoppingCart, Globe, Paintbrush, Bug, Sparkles, Languages, Search,
  RefreshCw, Filter,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  page_edit: { label: "Pagina", icon: FileText, color: "text-blue-400" },
  product_edit: { label: "Product", icon: ShoppingCart, color: "text-green-400" },
  form_edit: { label: "Formulier", icon: FileEdit, color: "text-purple-400" },
  content_add: { label: "Content", icon: Globe, color: "text-cyan-400" },
  seo_update: { label: "SEO", icon: Search, color: "text-orange-400" },
  translation: { label: "Vertaling", icon: Languages, color: "text-pink-400" },
  design_change: { label: "Design", icon: Paintbrush, color: "text-yellow-400" },
  bug_report: { label: "Bug", icon: Bug, color: "text-red-400" },
  feature_request: { label: "Feature", icon: Sparkles, color: "text-brand-400" },
  other: { label: "Overig", icon: FileEdit, color: "text-white/40" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Open", color: "text-yellow-400", bg: "bg-yellow-500/15", icon: Clock },
  in_progress: { label: "In behandeling", color: "text-blue-400", bg: "bg-blue-500/15", icon: Loader2 },
  completed: { label: "Afgerond", color: "text-green-400", bg: "bg-green-500/15", icon: CheckCircle },
  rejected: { label: "Afgewezen", color: "text-red-400", bg: "bg-red-500/15", icon: XCircle },
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const [r, s] = await Promise.all([
        apiFetch(`/api/admin/requests/${params}`),
        apiFetch("/api/admin/requests/stats"),
      ]);
      setRequests(r);
      setStats(s);
    } catch {}
    setLoading(false);
  }

  async function updateRequest(id: string, status: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_notes: notes || undefined }),
      });
      await load();
      setSelected(null);
      setNotes("");
    } catch {}
    setSaving(false);
  }

  async function addNotes(id: string) {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: notes }),
      });
      await load();
      setNotes("");
    } catch {}
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileEdit className="h-6 w-6 text-brand-400" /> Wijzigingsverzoeken
          </h1>
          <p className="mt-1 text-sm text-white/40">Beheer alle klantverzoeken</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/40 hover:bg-white/10">
          <RefreshCw className="h-3.5 w-3.5" /> Vernieuwen
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Totaal", value: stats.total, color: "border-white/10 bg-white/5" },
            { label: "Open", value: stats.pending, color: "border-yellow-500/20 bg-yellow-500/5" },
            { label: "In behandeling", value: stats.in_progress, color: "border-blue-500/20 bg-blue-500/5" },
            { label: "Afgerond", value: stats.completed, color: "border-green-500/20 bg-green-500/5" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.color}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{s.label}</p>
              <p className="mt-1 text-xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1">
        {[
          { v: "all", l: "Alles" },
          { v: "pending", l: "Open" },
          { v: "in_progress", l: "In behandeling" },
          { v: "completed", l: "Afgerond" },
          { v: "rejected", l: "Afgewezen" },
        ].map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f.v ? "bg-brand-500/20 text-brand-400" : "text-white/30 hover:bg-white/5"
            }`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-white/30">
          <FileEdit className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-sm">Geen verzoeken gevonden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const tm = TYPE_META[r.request_type] || TYPE_META.other;
            const sm = STATUS_META[r.status] || STATUS_META.pending;
            const SI = sm.icon;
            const isOpen = selected?.id === r.id;
            return (
              <div key={r.id} className={`rounded-xl border transition ${isOpen ? "border-brand-500/30 bg-brand-500/5" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
                <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => { setSelected(isOpen ? null : r); setNotes(r.admin_notes || ""); }}>
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5">
                    <tm.icon className={`h-4 w-4 ${tm.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{r.title}</h3>
                      {r.priority !== "normal" && (
                        <span className={`text-[9px] font-bold ${r.priority === "urgent" ? "text-red-400" : "text-orange-400"}`}>
                          {r.priority === "urgent" ? "⚡ URGENT" : "↑ HOOG"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/40 line-clamp-1">{r.description}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/25">
                      <span className="font-medium text-white/40">{r.tenant_name}</span>
                      <span>{r.tenant_domain}</span>
                      <span>{tm.label}</span>
                      <span>{r.created_at ? new Date(r.created_at).toLocaleDateString("nl-BE") : ""}</span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${sm.bg} ${sm.color}`}>
                    <SI className={`h-3 w-3 ${r.status === "in_progress" ? "animate-spin" : ""}`} />
                    {sm.label}
                  </span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-white/5 p-4 space-y-3">
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <p className="text-xs text-white/60">{r.description}</p>
                      {r.page_url && <a href={r.page_url} target="_blank" rel="noopener" className="mt-1 block text-[11px] text-brand-400 hover:underline">{r.page_url}</a>}
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-white/30 uppercase">Admin notities</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                        rows={3} placeholder="Notities voor de klant..."
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-brand-500/30 placeholder-white/20 resize-none" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <button onClick={() => updateRequest(r.id, "in_progress")} disabled={saving}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/30 disabled:opacity-40">
                          <Loader2 className="h-3 w-3" /> Start behandeling
                        </button>
                      )}
                      {(r.status === "pending" || r.status === "in_progress") && (
                        <button onClick={() => updateRequest(r.id, "completed")} disabled={saving}
                          className="flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-40">
                          <CheckCircle className="h-3 w-3" /> Markeer als afgerond
                        </button>
                      )}
                      {r.status === "pending" && (
                        <button onClick={() => updateRequest(r.id, "rejected")} disabled={saving}
                          className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-40">
                          <XCircle className="h-3 w-3" /> Afwijzen
                        </button>
                      )}
                      {notes.trim() && notes !== r.admin_notes && (
                        <button onClick={() => addNotes(r.id)} disabled={saving}
                          className="flex items-center gap-1.5 rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/30 disabled:opacity-40">
                          <MessageSquare className="h-3 w-3" /> Notitie opslaan
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
