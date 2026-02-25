"use client";

import { useEffect, useState } from "react";
import {
  Link2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Save,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BrokenLink {
  url: string;
  source_page: string;
  source_url: string;
  status_code: number;
  anchor_text: string;
}

interface Redirect {
  id: number;
  from_url: string;
  to_url: string;
  type: number;
  hits: number;
}

export default function LinkManagerPage() {
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([]);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"broken" | "redirects">("broken");
  const [creating, setCreating] = useState(false);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchData(s.tenant_id);
  }, []);

  async function fetchData(tid: string) {
    setLoading(true);
    try {
      const [bRes, lRes] = await Promise.all([
        fetch(`${API}/api/portal/data/${tid}/seo/links/broken`),
        fetch(`${API}/api/portal/data/${tid}/seo/links`),
      ]);
      if (bRes.ok) {
        const d = await bRes.json();
        setBrokenLinks(d.broken_links || d.items || []);
      }
      if (lRes.ok) {
        const d = await lRes.json();
        setRedirects(d.redirects || []);
      }
    } catch {}
    setLoading(false);
  }

  async function createRedirect(from: string, to: string) {
    await fetch(`${API}/api/portal/data/${tenantId}/seo/links/redirect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_url: from, to_url: to, type: 301 }),
    });
    fetchData(tenantId);
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Link Manager</h1>
          <p className="mt-1 text-sm text-white/40">Broken links detecteren en redirects beheren</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" /> Redirect
          </button>
          <button
            onClick={() => fetchData(tenantId)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-red-500/10 to-red-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-red-400/60">Broken Links</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{brokenLinks.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-blue-400/60">Redirects</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{redirects.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
        <button
          onClick={() => setActiveTab("broken")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === "broken" ? "bg-red-500/10 text-red-400" : "text-white/40 hover:text-white"}`}
        >
          Broken Links ({brokenLinks.length})
        </button>
        <button
          onClick={() => setActiveTab("redirects")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === "redirects" ? "bg-blue-500/10 text-blue-400" : "text-white/40 hover:text-white"}`}
        >
          Redirects ({redirects.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : activeTab === "broken" ? (
        brokenLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
            <CheckCircle2 className="mb-3 h-10 w-10 text-green-400/30" />
            <p className="text-sm text-white/30">Geen broken links gevonden!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {brokenLinks.map((bl, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-red-500/10 bg-red-500/5 p-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{bl.url}</p>
                  <p className="mt-0.5 text-xs text-white/30">
                    Gevonden op: {bl.source_page} · Status: {bl.status_code} · Anchor: "{bl.anchor_text}"
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCreating(true);
                  }}
                  className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  Fix →
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        redirects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
            <Link2 className="mb-3 h-10 w-10 text-white/15" />
            <p className="text-sm text-white/30">Nog geen redirects ingesteld</p>
          </div>
        ) : (
          <div className="space-y-2">
            {redirects.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate text-white/60">{r.from_url}</span>
                    <ArrowRight className="h-3 w-3 flex-shrink-0 text-brand-400" />
                    <span className="truncate text-white">{r.to_url}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-white/25">
                    <span className="rounded bg-white/5 px-1.5 py-0.5">{r.type}</span>
                    <span>{r.hits} hits</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create Redirect Modal */}
      {creating && (
        <RedirectModal onSave={createRedirect} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function RedirectModal({
  onSave,
  onClose,
}: {
  onSave: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Nieuwe Redirect</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Van URL</label>
            <input type="text" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/oude-pagina" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
          </div>
          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Naar URL</label>
            <input type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder="/nieuwe-pagina" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/40 hover:text-white">Annuleren</button>
          <button
            onClick={() => { if (from && to) onSave(from, to); }}
            disabled={!from || !to}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Aanmaken
          </button>
        </div>
      </div>
    </div>
  );
}
