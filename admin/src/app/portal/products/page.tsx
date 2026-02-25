"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  X,
  Save,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Archive,
  Eye,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Product {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: string;
  stock_quantity: number | null;
  total_sales: number;
  categories: string[];
  image: string | null;
  url: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionMenu, setActionMenu] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchProducts(s.tenant_id);
  }, []);

  async function fetchProducts(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/products`);
      if (r.ok) {
        const d = await r.json();
        setProducts(d.products || []);
      }
    } catch {}
    setLoading(false);
  }

  async function deleteProduct(id: number) {
    if (!confirm("Dit product verwijderen?")) return;
    await fetch(`${API}/api/portal/data/${tenantId}/products/${id}/delete`, { method: "POST" });
    setProducts((p) => p.filter((x) => x.id !== id));
    setActionMenu(null);
  }

  async function duplicateProduct(id: number) {
    const r = await fetch(`${API}/api/portal/data/${tenantId}/products/${id}/duplicate`, { method: "POST" });
    if (r.ok) fetchProducts(tenantId);
    setActionMenu(null);
  }

  async function saveProduct(data: Record<string, string | number>) {
    const id = editing?.id;
    const url = id
      ? `${API}/api/portal/data/${tenantId}/products/${id}`
      : `${API}/api/portal/data/${tenantId}/products/create`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      fetchProducts(tenantId);
      setEditing(null);
      setCreating(false);
    }
  }

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (stockFilter === "instock" && p.stock_status !== "instock") return false;
    if (stockFilter === "outofstock" && p.stock_status !== "outofstock") return false;
    return true;
  });

  const stats = {
    total: products.length,
    inStock: products.filter((p) => p.stock_status === "instock").length,
    outOfStock: products.filter((p) => p.stock_status === "outofstock").length,
    totalSales: products.reduce((s, p) => s + (p.total_sales || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Producten</h1>
          <p className="mt-1 text-sm text-white/40">Beheer je producten vanuit de Hub</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Nieuw Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Package} label="Totaal" value={stats.total} color="brand" />
        <StatCard icon={Eye} label="Op voorraad" value={stats.inStock} color="green" />
        <StatCard icon={AlertCircle} label="Uitverkocht" value={stats.outOfStock} color="red" />
        <StatCard icon={TrendingUp} label="Verkocht" value={stats.totalSales} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Zoek producten..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/50"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="all">Alle voorraad</option>
            <option value="instock">Op voorraad</option>
            <option value="outofstock">Uitverkocht</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <Package className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">Geen producten gevonden</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] transition hover:border-white/10 hover:bg-white/[0.04]"
            >
              {/* Image */}
              <div className="relative aspect-square bg-white/5">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-12 w-12 text-white/10" />
                  </div>
                )}
                {/* Stock badge */}
                <div className="absolute left-2 top-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      p.stock_status === "instock"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {p.stock_status === "instock" ? "Op voorraad" : "Uitverkocht"}
                  </span>
                </div>
                {/* Action menu */}
                <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => setActionMenu(actionMenu === p.id ? null : p.id)}
                    className="rounded-lg bg-black/60 p-1.5 text-white/70 backdrop-blur-sm hover:text-white"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {actionMenu === p.id && (
                    <div className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-white/10 bg-brand-950 py-1 shadow-xl">
                      <button
                        onClick={() => { setEditing(p); setActionMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white/60 hover:bg-white/5 hover:text-white"
                      >
                        <Edit3 className="h-3 w-3" /> Bewerken
                      </button>
                      <button
                        onClick={() => duplicateProduct(p.id)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white/60 hover:bg-white/5 hover:text-white"
                      >
                        <Copy className="h-3 w-3" /> Dupliceren
                      </button>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white/60 hover:bg-white/5 hover:text-white"
                      >
                        <ExternalLink className="h-3 w-3" /> Bekijk op site
                      </a>
                      <hr className="my-1 border-white/5" />
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" /> Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="truncate text-sm font-medium text-white">{p.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  {p.sale_price ? (
                    <>
                      <span className="text-sm font-bold text-brand-400">€{p.sale_price}</span>
                      <span className="text-xs text-white/30 line-through">€{p.regular_price}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-white/70">€{p.price || "0"}</span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {p.categories?.slice(0, 2).map((c) => (
                      <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
                        {c}
                      </span>
                    ))}
                  </div>
                  {p.total_sales > 0 && (
                    <span className="text-[10px] text-white/25">{p.total_sales}x verkocht</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Modal */}
      {(editing || creating) && (
        <ProductModal
          product={editing}
          onSave={saveProduct}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-500/5 text-brand-400",
    green: "from-green-500/10 to-green-500/5 text-green-400",
    red: "from-red-500/10 to-red-500/5 text-red-400",
    purple: "from-purple-500/10 to-purple-500/5 text-purple-400",
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color]} border border-white/5 p-4`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 opacity-60" />
        <span className="text-[11px] uppercase tracking-wider opacity-60">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ProductModal({
  product,
  onSave,
  onClose,
}: {
  product: Product | null;
  onSave: (data: Record<string, string | number>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [price, setPrice] = useState(product?.regular_price || product?.price || "");
  const [salePrice, setSalePrice] = useState(product?.sale_price || "");
  const [stockStatus, setStockStatus] = useState(product?.stock_status || "instock");
  const [stockQty, setStockQty] = useState(product?.stock_quantity?.toString() || "");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const data: Record<string, string | number> = { name };
    if (price) data.price = price;
    if (salePrice) data.sale_price = salePrice;
    data.stock_status = stockStatus;
    if (stockQty) data.stock_quantity = parseInt(stockQty);
    if (description) data.description = description;
    await onSave(data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {product ? "Product Bewerken" : "Nieuw Product"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Productnaam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bijv. Pralines Assortiment"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Prijs (€)</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="29.95"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Actieprijs (€)</label>
              <input
                type="text"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="24.95"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Voorraad status</label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="instock">Op voorraad</option>
                <option value="outofstock">Uitverkocht</option>
                <option value="onbackorder">Nabestelling</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Aantal</label>
              <input
                type="number"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder="—"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
          </div>

          {!product && (
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Beschrijving</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Productbeschrijving..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-white/40 transition hover:text-white"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
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
