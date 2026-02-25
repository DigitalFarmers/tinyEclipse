"use client";

import { useEffect, useState } from "react";
import {
  FolderOpen,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Save,
  Calendar,
  User,
  Tag,
  ExternalLink,
  Image,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Project {
  id: number;
  title: string;
  description: string;
  client_name: string;
  category: string;
  date: string;
  tags: string[];
  featured: boolean;
  images: string[];
  url: string;
  status: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchProjects(s.tenant_id);
  }, []);

  async function fetchProjects(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/portfolio`);
      if (r.ok) {
        const d = await r.json();
        setProjects(d.projects || d.items || []);
      }
    } catch {}
    setLoading(false);
  }

  async function deleteProject(id: number) {
    if (!confirm("Dit project verwijderen?")) return;
    await fetch(`${API}/api/portal/data/${tenantId}/portfolio/${id}/delete`, { method: "POST" });
    setProjects((prev) => prev.filter((x) => x.id !== id));
  }

  async function saveProject(data: Record<string, any>) {
    const id = editing?.id;
    const url = id
      ? `${API}/api/portal/data/${tenantId}/portfolio/${id}`
      : `${API}/api/portal/data/${tenantId}/portfolio/create`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      fetchProjects(tenantId);
      setEditing(null);
      setCreating(false);
    }
  }

  const filtered = projects.filter((p) =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Projecten / Portfolio</h1>
          <p className="mt-1 text-sm text-white/40">Showcase van je realisaties en projecten</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> Nieuw Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-brand-400/60">Totaal</p>
          <p className="mt-1 text-2xl font-bold text-brand-400">{projects.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-purple-400/60">Featured</p>
          <p className="mt-1 text-2xl font-bold text-purple-400">{projects.filter((p) => p.featured).length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-green-400/60">Categorieën</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{new Set(projects.map((p) => p.category).filter(Boolean)).size}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Zoek projecten..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <FolderOpen className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">
            {projects.length === 0 ? "Nog geen projecten. Voeg je eerste realisatie toe!" : "Geen resultaten"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="group overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] transition hover:border-white/10 hover:bg-white/[0.04]">
              {/* Gallery preview */}
              <div className="relative aspect-video bg-white/5">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Image className="h-10 w-10 text-white/10" />
                  </div>
                )}
                {p.featured && (
                  <span className="absolute left-2 top-2 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                    Featured
                  </span>
                )}
                {p.images?.length > 1 && (
                  <span className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
                    +{p.images.length - 1} foto's
                  </span>
                )}
              </div>

              <div className="p-4">
                <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-white/40">{p.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
                  {p.client_name && (
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.client_name}</span>
                  )}
                  {p.category && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5">{p.category}</span>
                  )}
                  {p.date && (
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{p.date}</span>
                  )}
                </div>
                {p.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] text-brand-400/60">{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditing(p)} className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white">Bewerken</button>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener" className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white">Bekijken</a>
                  )}
                  <button onClick={() => deleteProject(p.id)} className="rounded-lg bg-red-500/5 px-2.5 py-1 text-[10px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">Verwijderen</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <ProjectModal
          project={editing}
          onSave={saveProject}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function ProjectModal({ project, onSave, onClose }: { project: Project | null; onSave: (d: Record<string, any>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [clientName, setClientName] = useState(project?.client_name || "");
  const [category, setCategory] = useState(project?.category || "");
  const [date, setDate] = useState(project?.date || "");
  const [tags, setTags] = useState(project?.tags?.join(", ") || "");
  const [featured, setFeatured] = useState(project?.featured || false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title, description, client_name: clientName, category, date, featured,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{project ? "Project Bewerken" : "Nieuw Project"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Titel</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Renovatie Villa Brasschaat" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Beschrijving</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Klant</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Categorie</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Bijv. Renovatie" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Datum</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Tags (komma-gescheiden)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hout, interieur" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded border-white/20 bg-white/5" />
            <span className="text-xs text-white/40">Featured project (uitgelicht)</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/40 hover:text-white">Annuleren</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
