"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Save,
  DollarSign,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RentalItem {
  id: number;
  title: string;
  description: string;
  price_per_day: string;
  price_per_hour: string;
  deposit: string;
  condition: string;
  location: string;
  available: boolean;
  category: string;
  image: string | null;
}

export default function RentalsPage() {
  const [items, setItems] = useState<RentalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RentalItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchRentals(s.tenant_id);
  }, []);

  async function fetchRentals(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/rentals`);
      if (r.ok) {
        const d = await r.json();
        setItems(d.rentals || d.items || []);
      }
    } catch {}
    setLoading(false);
  }

  async function deleteRental(id: number) {
    if (!confirm("Dit verhuuritem verwijderen?")) return;
    await fetch(`${API}/api/portal/data/${tenantId}/rentals/${id}/delete`, { method: "POST" });
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function saveRental(data: Record<string, string | number | boolean>) {
    const id = editing?.id;
    const url = id
      ? `${API}/api/portal/data/${tenantId}/rentals/${id}`
      : `${API}/api/portal/data/${tenantId}/rentals/create`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      fetchRentals(tenantId);
      setEditing(null);
      setCreating(false);
    }
  }

  const filtered = items.filter((i) =>
    !search || i.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Verhuur</h1>
          <p className="mt-1 text-sm text-white/40">Beheer je verhuuritems en beschikbaarheid</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> Nieuw Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-brand-400/60">Totaal</p>
          <p className="mt-1 text-2xl font-bold text-brand-400">{items.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-green-400/60">Beschikbaar</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{items.filter((i) => i.available).length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-orange-400/60">Verhuurd</p>
          <p className="mt-1 text-2xl font-bold text-orange-400">{items.filter((i) => !i.available).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Zoek verhuuritems..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Items */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <Key className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">
            {items.length === 0 ? "Nog geen verhuuritems. Voeg je eerste item toe!" : "Geen resultaten"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="group overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] transition hover:border-white/10 hover:bg-white/[0.04]">
              <div className="relative aspect-video bg-white/5">
                {item.image ? (
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Key className="h-10 w-10 text-white/10" />
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.available ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                    {item.available ? "Beschikbaar" : "Verhuurd"}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-white">{item.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/35">
                  {item.price_per_day && <span>€{item.price_per_day}/dag</span>}
                  {item.price_per_hour && <span>€{item.price_per_hour}/uur</span>}
                  {item.deposit && <span>Borg: €{item.deposit}</span>}
                </div>
                {item.location && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-white/25">
                    <MapPin className="h-3 w-3" /> {item.location}
                  </p>
                )}
                <div className="mt-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditing(item)} className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white">Bewerken</button>
                  <button onClick={() => deleteRental(item.id)} className="rounded-lg bg-red-500/5 px-2.5 py-1 text-[10px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400">Verwijderen</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <RentalModal
          item={editing}
          onSave={saveRental}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function RentalModal({ item, onSave, onClose }: { item: RentalItem | null; onSave: (d: Record<string, string | number | boolean>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [priceDay, setPriceDay] = useState(item?.price_per_day || "");
  const [priceHour, setPriceHour] = useState(item?.price_per_hour || "");
  const [deposit, setDeposit] = useState(item?.deposit || "");
  const [location, setLocation] = useState(item?.location || "");
  const [condition, setCondition] = useState(item?.condition || "good");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title, description, price_per_day: priceDay, price_per_hour: priceHour, deposit, location, condition });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{item ? "Item Bewerken" : "Nieuw Verhuuritem"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Naam</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Partytent 6x3m" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Beschrijving</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">€/dag</label>
              <input type="text" value={priceDay} onChange={(e) => setPriceDay(e.target.value)} placeholder="50" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">€/uur</label>
              <input type="text" value={priceHour} onChange={(e) => setPriceHour(e.target.value)} placeholder="15" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Borgsom</label>
              <input type="text" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="100" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Locatie</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Conditie</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                <option value="new">Nieuw</option>
                <option value="good">Goed</option>
                <option value="fair">Redelijk</option>
              </select>
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
