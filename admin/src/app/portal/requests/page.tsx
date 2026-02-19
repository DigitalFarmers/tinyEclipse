"use client";

import { useEffect, useState } from "react";
import {
  FileEdit, Send, CheckCircle, Clock, Loader2, XCircle, ArrowUp,
  FileText, ShoppingCart, Globe, Paintbrush, Bug, Sparkles, Languages, Search,
} from "lucide-react";
import { usePortalSession } from "@/lib/usePortalSession";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TYPE_OPTIONS = [
  { value: "page_edit", label: "Pagina aanpassen", icon: FileText, color: "text-blue-400" },
  { value: "product_edit", label: "Product aanpassen", icon: ShoppingCart, color: "text-green-400" },
  { value: "form_edit", label: "Formulier aanpassen", icon: FileEdit, color: "text-purple-400" },
  { value: "content_add", label: "Content toevoegen", icon: Globe, color: "text-cyan-400" },
  { value: "seo_update", label: "SEO verbeteren", icon: Search, color: "text-orange-400" },
  { value: "translation", label: "Vertaling", icon: Languages, color: "text-pink-400" },
  { value: "design_change", label: "Design wijziging", icon: Paintbrush, color: "text-yellow-400" },
  { value: "bug_report", label: "Bug melden", icon: Bug, color: "text-red-400" },
  { value: "feature_request", label: "Nieuwe functie", icon: Sparkles, color: "text-brand-400" },
  { value: "other", label: "Overig", icon: FileEdit, color: "text-white/40" },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "In wachtrij", color: "bg-yellow-500/15 text-yellow-400", icon: Clock },
  in_progress: { label: "In behandeling", color: "bg-blue-500/15 text-blue-400", icon: Loader2 },
  completed: { label: "Afgerond", color: "bg-green-500/15 text-green-400", icon: CheckCircle },
  rejected: { label: "Afgewezen", color: "bg-red-500/15 text-red-400", icon: XCircle },
};

export default function RequestsPage() {
  const { session, features } = usePortalSession();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ request_type: "page_edit", title: "", description: "", page_url: "", priority: "normal" });

  useEffect(() => {
    if (session) loadRequests();
  }, [session]);

  async function loadRequests() {
    if (!session) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/requests/by-tenant/${session.tenant_id}`);
      if (r.ok) setRequests(await r.json());
    } catch {}
    setLoading(false);
  }

  async function submitRequest() {
    if (!session || !form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/requests/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenant_id: session.tenant_id }),
      });
      if (r.ok) {
        setSuccess("Wijzigingsverzoek ingediend! We gaan ermee aan de slag.");
        setForm({ request_type: "page_edit", title: "", description: "", page_url: "", priority: "normal" });
        setShowForm(false);
        await loadRequests();
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch {}
    setSubmitting(false);
  }

  const isPro = features?.plan === "pro" || features?.plan === "pro_plus";
  const isProPlus = features?.plan === "pro_plus";

  if (!session) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <FileEdit className="h-5 w-5 text-brand-400" /> Wijzigingen
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Vraag aanpassingen aan voor je website</p>
        </div>
        {isPro && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500">
            <Send className="h-4 w-4" /> Nieuw verzoek
          </button>
        )}
      </div>

      {success && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-400">
          <CheckCircle className="h-4 w-4 flex-shrink-0" /> {success}
        </div>
      )}

      {!isPro && (
        <div className="mt-6 rounded-xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-brand-400" />
          <h2 className="mt-3 text-lg font-bold">Upgrade naar PRO</h2>
          <p className="mt-1 text-sm text-white/40">Met een PRO pakket kun je wijzigingsverzoeken indienen voor je website.</p>
        </div>
      )}

      {/* New Request Form */}
      {showForm && isPro && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-bold mb-4">Nieuw wijzigingsverzoek</h2>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TYPE_OPTIONS.map((t) => (
              <button key={t.value} onClick={() => setForm(f => ({ ...f, request_type: t.value }))}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
                  form.request_type === t.value ? "border-brand-500/30 bg-brand-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}>
                <t.icon className={`h-4 w-4 ${t.color}`} />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-white/40">Titel *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Bijv: Openingstijden aanpassen op contactpagina"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500/30 placeholder-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40">Beschrijving *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Beschrijf zo duidelijk mogelijk wat je wilt laten aanpassen..."
                rows={4}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500/30 placeholder-white/20 resize-none" />
            </div>
            <div>
              <label className="text-xs text-white/40">Pagina URL (optioneel)</label>
              <input type="text" value={form.page_url} onChange={e => setForm(f => ({ ...f, page_url: e.target.value }))}
                placeholder="https://mijnsite.be/contact"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500/30 placeholder-white/20" />
            </div>

            {isProPlus && (
              <div>
                <label className="text-xs text-white/40">Prioriteit</label>
                <div className="mt-1 flex gap-2">
                  {[
                    { v: "normal", l: "Normaal", c: "border-white/10" },
                    { v: "high", l: "Hoog", c: "border-orange-500/30 text-orange-400" },
                    { v: "urgent", l: "Urgent", c: "border-red-500/30 text-red-400" },
                  ].map((p) => (
                    <button key={p.v} onClick={() => setForm(f => ({ ...f, priority: p.v }))}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        form.priority === p.v ? `${p.c} bg-white/5` : "border-white/5 text-white/30"
                      }`}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={submitRequest} disabled={submitting || !form.title.trim() || !form.description.trim()}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-40">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Indienen
              </button>
              <button onClick={() => setShowForm(false)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 transition hover:bg-white/5">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Requests */}
      {isPro && (
        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/30">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : requests.length > 0 ? (
            requests.map((r) => {
              const typeInfo = TYPE_OPTIONS.find(t => t.value === r.request_type) || TYPE_OPTIONS[TYPE_OPTIONS.length - 1];
              const statusInfo = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
              const StatusIcon = statusInfo.icon;
              return (
                <div key={r.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5`}>
                        <typeInfo.icon className={`h-4 w-4 ${typeInfo.color}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">{r.title}</h3>
                        <p className="mt-0.5 text-xs text-white/40 line-clamp-2">{r.description}</p>
                        {r.page_url && <p className="mt-1 text-[10px] text-brand-400 truncate">{r.page_url}</p>}
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusInfo.color}`}>
                      <StatusIcon className={`h-3 w-3 ${r.status === "in_progress" ? "animate-spin" : ""}`} />
                      {statusInfo.label}
                    </span>
                  </div>
                  {r.admin_notes && (
                    <div className="mt-3 rounded-lg bg-brand-500/5 border border-brand-500/10 px-3 py-2">
                      <p className="text-[10px] font-semibold text-brand-400 mb-0.5">Reactie van het team:</p>
                      <p className="text-xs text-white/60">{r.admin_notes}</p>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-white/20">
                    <span>{typeInfo.label}</span>
                    {r.priority !== "normal" && (
                      <span className={r.priority === "urgent" ? "text-red-400" : "text-orange-400"}>
                        {r.priority === "urgent" ? "⚡ Urgent" : "↑ Hoog"}
                      </span>
                    )}
                    <span>{new Date(r.created_at).toLocaleDateString("nl-BE")}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
              <FileEdit className="mx-auto h-8 w-8 text-white/15" />
              <p className="mt-3 text-sm text-white/30">Nog geen wijzigingsverzoeken</p>
              <p className="mt-1 text-xs text-white/20">Klik op "Nieuw verzoek" om je eerste aanvraag in te dienen</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
