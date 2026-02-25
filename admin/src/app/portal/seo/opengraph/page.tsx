"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Save,
  RefreshCw,
  ExternalLink,
  Image,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OgPage {
  id: number;
  title: string;
  url: string;
  type: string;
  og_title: string;
  og_description: string;
  og_image: string;
  og_type: string;
  has_og: boolean;
}

export default function OpenGraphPage() {
  const [pages, setPages] = useState<OgPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OgPage | null>(null);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchOg(s.tenant_id);
  }, []);

  async function fetchOg(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/seo/opengraph`);
      if (r.ok) {
        const d = await r.json();
        setPages(d.pages || d.items || []);
      }
    } catch {}
    setLoading(false);
  }

  async function saveOg(pageId: number, data: Record<string, string>) {
    await fetch(`${API}/api/portal/data/${tenantId}/seo/opengraph/${pageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchOg(tenantId);
    setEditing(null);
  }

  const withOg = pages.filter((p) => p.has_og).length;
  const withoutOg = pages.filter((p) => !p.has_og).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">OpenGraph Manager</h1>
          <p className="mt-1 text-sm text-white/40">Beheer hoe je pagina's eruitzien op social media</p>
        </div>
        <button
          onClick={() => fetchOg(tenantId)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" /> Vernieuwen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-brand-400/60">Totaal pagina's</p>
          <p className="mt-1 text-2xl font-bold text-brand-400">{pages.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-green-400/60">Met OG tags</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{withOg}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-red-500/10 to-red-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-red-400/60">Zonder OG tags</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{withoutOg}</p>
        </div>
      </div>

      {/* Pages List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <Globe className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">Geen pagina's gevonden. Zorg dat de plugin actief is.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]"
            >
              {/* OG Image preview */}
              <div className="hidden h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white/5 sm:block">
                {p.og_image ? (
                  <img src={p.og_image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Image className="h-5 w-5 text-white/10" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {p.has_og ? (
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                  )}
                  <h3 className="truncate text-sm font-medium text-white">{p.title}</h3>
                </div>
                <p className="mt-0.5 truncate text-xs text-white/30">
                  {p.og_title || p.og_description || "Geen OG tags ingesteld"}
                </p>
                <span className="mt-0.5 inline-block rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/20">
                  {p.type}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(p)}
                  className="rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs text-brand-400 transition hover:bg-brand-500/20"
                >
                  Bewerken
                </button>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="rounded-lg p-2 text-white/20 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <OgEditModal
          page={editing}
          onSave={saveOg}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function OgEditModal({
  page,
  onSave,
  onClose,
}: {
  page: OgPage;
  onSave: (id: number, data: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [ogTitle, setOgTitle] = useState(page.og_title || page.title || "");
  const [ogDesc, setOgDesc] = useState(page.og_description || "");
  const [ogImage, setOgImage] = useState(page.og_image || "");
  const [ogType, setOgType] = useState(page.og_type || "website");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(page.id, {
      og_title: ogTitle,
      og_description: ogDesc,
      og_image: ogImage,
      og_type: ogType,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-2xl rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">OpenGraph Bewerken</h2>
            <p className="text-xs text-white/30">{page.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">og:title</label>
              <input
                type="text"
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
              />
              <p className={`mt-1 text-[10px] ${ogTitle.length > 60 ? "text-yellow-400" : "text-white/20"}`}>
                {ogTitle.length}/60 tekens
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">og:description</label>
              <textarea
                value={ogDesc}
                onChange={(e) => setOgDesc(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
              />
              <p className={`mt-1 text-[10px] ${ogDesc.length > 155 ? "text-yellow-400" : "text-white/20"}`}>
                {ogDesc.length}/155 tekens
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">og:image URL</label>
              <input
                type="url"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">og:type</label>
              <select
                value={ogType}
                onChange={(e) => setOgType(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="website">website</option>
                <option value="article">article</option>
                <option value="product">product</option>
                <option value="profile">profile</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="mb-2 text-xs font-medium text-white/40">Social Media Preview</p>
            {/* Facebook-style */}
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <div className="aspect-[1.91/1] bg-white/5">
                {ogImage ? (
                  <img src={ogImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Image className="h-8 w-8 text-white/10" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[10px] uppercase text-white/20">{new URL(page.url).hostname}</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{ogTitle || page.title}</p>
                {ogDesc && <p className="mt-0.5 line-clamp-2 text-xs text-white/40">{ogDesc}</p>}
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-white/15">Facebook / LinkedIn preview</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/40 hover:text-white">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
