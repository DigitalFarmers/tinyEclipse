"use client";

import { useEffect, useState } from "react";
import {
  Gift,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Save,
  DollarSign,
  Package,
  Calendar,
  Tag,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PackageItem {
  id: number;
  title: string;
  description: string;
  price: string;
  original_price: string;
  items: { name: string; type: string; quantity: number }[];
  validity: string;
  max_sales: number | null;
  sold: number;
  status: string;
  image: string | null;
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PackageItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchPackages(s.tenant_id);
  }, []);

  async function fetchPackages(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/packages`);
      if (r.ok) {
        const d = await r.json();
        setPackages(d.packages || d.items || []);
      }
    } catch {}
    setLoading(false);
  }

  async function deletePackage(id: number) {
    if (!confirm("Dit pakket verwijderen?")) return;
    await fetch(`${API}/api/portal/data/${tenantId}/packages/${id}/delete`, { method: "POST" });
    setPackages((prev) => prev.filter((x) => x.id !== id));
  }

  async function savePackage(data: Record<string, any>) {
    const id = editing?.id;
    const url = id
      ? `${API}/api/portal/data/${tenantId}/packages/${id}`
      : `${API}/api/portal/data/${tenantId}/packages/create`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      fetchPackages(tenantId);
      setEditing(null);
      setCreating(false);
    }
  }

  const filtered = packages.filter((p) =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pakketten</h1>
          <p className="mt-1 text-sm text-white/40">Combineer producten, diensten en boekingen in aantrekkelijke pakketten</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> Nieuw Pakket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-brand-400/60">Pakketten</p>
          <p className="mt-1 text-2xl font-bold text-brand-400">{packages.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-green-400/60">Actief</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{packages.filter((p) => p.status === "publish").length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-purple-400/60">Verkocht</p>
          <p className="mt-1 text-2xl font-bold text-purple-400">{packages.reduce((s, p) => s + (p.sold || 0), 0)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Zoek pakketten..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Packages */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <Gift className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">
            {packages.length === 0 ? "Nog geen pakketten. Maak je eerste pakket!" : "Geen resultaten"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <div key={pkg.id} className="group overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] transition hover:border-white/10 hover:bg-white/[0.04]">
              <div className="relative aspect-video bg-white/5">
                {pkg.image ? (
                  <img src={pkg.image} alt={pkg.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-500/5 to-purple-500/5">
                    <Gift className="h-12 w-12 text-white/10" />
                  </div>
                )}
                {pkg.original_price && pkg.price !== pkg.original_price && (
                  <span className="absolute left-2 top-2 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                    Bespaar €{(parseFloat(pkg.original_price) - parseFloat(pkg.price)).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-white">{pkg.title}</h3>
                {pkg.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-white/40">{pkg.description}</p>
                )}

                {/* Price */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-lg font-bold text-brand-400">€{pkg.price}</span>
                  {pkg.original_price && pkg.price !== pkg.original_price && (
                    <span className="text-xs text-white/30 line-through">€{pkg.original_price}</span>
                  )}
                </div>

                {/* Included items */}
                {pkg.items?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pkg.items.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-white/30">
                        <Package className="h-3 w-3" />
                        <span>{item.quantity}x {item.name}</span>
                        <span className="rounded bg-white/5 px-1 py-0.5 text-[8px]">{item.type}</span>
                      </div>
                    ))}
                    {pkg.items.length > 3 && (
                      <p className="text-[10px] text-white/20">+{pkg.items.length - 3} meer</p>
                    )}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[10px] text-white/20">
                  {pkg.validity && <span>Geldig: {pkg.validity}</span>}
                  {pkg.sold > 0 && <span>{pkg.sold}x verkocht</span>}
                </div>

                <div className="mt-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditing(pkg)} className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white">Bewerken</button>
                  <button onClick={() => deletePackage(pkg.id)} className="rounded-lg bg-red-500/5 px-2.5 py-1 text-[10px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">Verwijderen</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <PackageModal
          pkg={editing}
          onSave={savePackage}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function PackageModal({ pkg, onSave, onClose }: { pkg: PackageItem | null; onSave: (d: Record<string, any>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(pkg?.title || "");
  const [description, setDescription] = useState(pkg?.description || "");
  const [price, setPrice] = useState(pkg?.price || "");
  const [originalPrice, setOriginalPrice] = useState(pkg?.original_price || "");
  const [validity, setValidity] = useState(pkg?.validity || "");
  const [maxSales, setMaxSales] = useState(pkg?.max_sales?.toString() || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const data: Record<string, any> = { title, description, price, original_price: originalPrice, validity };
    if (maxSales) data.max_sales = parseInt(maxSales);
    await onSave(data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{pkg ? "Pakket Bewerken" : "Nieuw Pakket"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Naam</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Cadeau Arrangement Deluxe" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Beschrijving</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Pakketprijs (€)</label>
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.95" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Oorspronkelijke prijs (€)</label>
              <input type="text" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="65.00" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Geldigheid</label>
              <input type="text" value={validity} onChange={(e) => setValidity(e.target.value)} placeholder="Bijv. 3 maanden" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Max verkoop</label>
              <input type="number" value={maxSales} onChange={(e) => setMaxSales(e.target.value)} placeholder="Onbeperkt" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
          </div>
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
