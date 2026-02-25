"use client";

import { useEffect, useState } from "react";
import {
  Wrench,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Save,
  Clock,
  DollarSign,
  MapPin,
  MoreHorizontal,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Service {
  id: number;
  title: string;
  description: string;
  price_type: string;
  price: string;
  duration_minutes: number | null;
  category: string;
  location: string;
  status: string;
  url: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionMenu, setActionMenu] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchServices(s.tenant_id);
  }, []);

  async function fetchServices(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/services`);
      if (r.ok) {
        const d = await r.json();
        setServices(d.services || d.items || []);
      }
    } catch {}
    setLoading(false);
  }

  async function deleteService(id: number) {
    if (!confirm("Deze dienst verwijderen?")) return;
    await fetch(`${API}/api/portal/data/${tenantId}/services/${id}/delete`, { method: "POST" });
    setServices((s) => s.filter((x) => x.id !== id));
    setActionMenu(null);
  }

  async function saveService(data: Record<string, string | number>) {
    const id = editing?.id;
    const url = id
      ? `${API}/api/portal/data/${tenantId}/services/${id}`
      : `${API}/api/portal/data/${tenantId}/services/create`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      fetchServices(tenantId);
      setEditing(null);
      setCreating(false);
    }
  }

  const filtered = services.filter((s) =>
    !search || s.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Diensten</h1>
          <p className="mt-1 text-sm text-white/40">Beheer je diensten en tarieven</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Nieuwe Dienst
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Wrench className="h-4 w-4 opacity-60" />
            <span className="text-[11px] uppercase tracking-wider opacity-60">Totaal</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-brand-400">{services.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
          <div className="flex items-center gap-2 text-green-400">
            <DollarSign className="h-4 w-4 opacity-60" />
            <span className="text-[11px] uppercase tracking-wider opacity-60">Uurprijs</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {services.filter((s) => s.price_type === "hourly").length}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4">
          <div className="flex items-center gap-2 text-purple-400">
            <DollarSign className="h-4 w-4 opacity-60" />
            <span className="text-[11px] uppercase tracking-wider opacity-60">Vast tarief</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-purple-400">
            {services.filter((s) => s.price_type === "fixed").length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Zoek diensten..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Services List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <Wrench className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">
            {services.length === 0 ? "Nog geen diensten. Voeg je eerste dienst toe!" : "Geen resultaten"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-white">{s.title}</h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-white/35">
                  {s.price && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      €{s.price}{s.price_type === "hourly" ? "/uur" : ""}
                    </span>
                  )}
                  {s.duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {s.duration_minutes} min
                    </span>
                  )}
                  {s.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {s.location}
                    </span>
                  )}
                  {s.category && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5">{s.category}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => setEditing(s)}
                  className="rounded-lg p-2 text-white/30 hover:bg-white/5 hover:text-white"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteService(s.id)}
                  className="rounded-lg p-2 text-white/30 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {(editing || creating) && (
        <ServiceModal
          service={editing}
          onSave={saveService}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function ServiceModal({
  service,
  onSave,
  onClose,
}: {
  service: Service | null;
  onSave: (data: Record<string, string | number>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(service?.title || "");
  const [description, setDescription] = useState(service?.description || "");
  const [priceType, setPriceType] = useState(service?.price_type || "fixed");
  const [price, setPrice] = useState(service?.price || "");
  const [duration, setDuration] = useState(service?.duration_minutes?.toString() || "");
  const [category, setCategory] = useState(service?.category || "");
  const [location, setLocation] = useState(service?.location || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const data: Record<string, string | number> = {
      title,
      description,
      price_type: priceType,
    };
    if (price) data.price = price;
    if (duration) data.duration_minutes = parseInt(duration);
    if (category) data.category = category;
    if (location) data.location = location;
    await onSave(data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {service ? "Dienst Bewerken" : "Nieuwe Dienst"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Naam</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv. Website Onderhoud"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Beschrijving</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Wat houdt deze dienst in?"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Type</label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="fixed">Vast tarief</option>
                <option value="hourly">Per uur</option>
                <option value="quote">Op offerte</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Prijs (€)</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={priceType === "hourly" ? "75" : "250"}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Duur (min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Categorie</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Bijv. Webdesign"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Locatie</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bijv. Op locatie"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/40 transition hover:text-white">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
