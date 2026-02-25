"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Search,
  Filter,
  ChevronDown,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RotateCcw,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Package,
  X,
  Send,
} from "lucide-react";

import { StatSkeleton, ListRowSkeleton } from "@/components/StatSkeleton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OrderItem {
  name: string;
  quantity: number;
  total: string;
}

interface Order {
  id: number;
  status: string;
  total: string;
  currency: string;
  items_count: number;
  items: OrderItem[];
  customer: string;
  email: string;
  payment_method: string;
  created_at: string;
}

interface ShopStats {
  revenue: number;
  order_count: number;
  product_count: number;
  avg_order_value: number;
  by_status: Record<string, number>;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  processing: { label: "In behandeling", color: "text-yellow-400 bg-yellow-500/10", icon: Clock },
  completed: { label: "Afgerond", color: "text-green-400 bg-green-500/10", icon: CheckCircle2 },
  "on-hold": { label: "In wacht", color: "text-orange-400 bg-orange-500/10", icon: Clock },
  pending: { label: "Wachtend", color: "text-blue-400 bg-blue-500/10", icon: Clock },
  cancelled: { label: "Geannuleerd", color: "text-red-400 bg-red-500/10", icon: XCircle },
  refunded: { label: "Terugbetaald", color: "text-purple-400 bg-purple-500/10", icon: RotateCcw },
  failed: { label: "Mislukt", color: "text-red-400 bg-red-500/10", icon: XCircle },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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
    const [ordersRes, statsRes] = await Promise.all([
      fetch(`${API}/api/portal/data/${tid}/orders?status=any&limit=100`),
      fetch(`${API}/api/portal/data/${tid}/orders/stats?days=30`),
    ]);
    if (ordersRes.ok) {
      const d = await ordersRes.json();
      setOrders(d.orders || []);
    }
    if (statsRes.ok) {
      const d = await statsRes.json();
      setStats(d);
    }
    setLoading(false);
  }

  async function updateStatus(orderId: number, newStatus: string) {
    await fetch(`${API}/api/portal/data/${tenantId}/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  }

  async function addNote(orderId: number, note: string) {
    await fetch(`${API}/api/portal/data/${tenantId}/orders/${orderId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
  }

  const filtered = orders.filter((o) => {
    if (statusFilter !== "any" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.customer.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.id.toString().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Orders</h1>
        <p className="mt-1 text-sm text-white/40">Beheer bestellingen vanuit de Hub</p>
      </div>

      {/* Stats */}
      {loading && !stats && (
        <StatSkeleton count={4} cols="grid-cols-2 sm:grid-cols-4" />
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
            <div className="flex items-center gap-2 text-green-400">
              <DollarSign className="h-4 w-4 opacity-60" />
              <span className="text-[11px] uppercase tracking-wider opacity-60">Omzet 30d</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-green-400">€{stats.revenue.toLocaleString("nl-BE", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-4">
            <div className="flex items-center gap-2 text-brand-400">
              <ShoppingCart className="h-4 w-4 opacity-60" />
              <span className="text-[11px] uppercase tracking-wider opacity-60">Orders 30d</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-brand-400">{stats.order_count}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4">
            <div className="flex items-center gap-2 text-purple-400">
              <TrendingUp className="h-4 w-4 opacity-60" />
              <span className="text-[11px] uppercase tracking-wider opacity-60">Gem. waarde</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-purple-400">€{stats.avg_order_value.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-4">
            <div className="flex items-center gap-2 text-orange-400">
              <Package className="h-4 w-4 opacity-60" />
              <span className="text-[11px] uppercase tracking-wider opacity-60">Producten</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-orange-400">{stats.product_count}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Zoek op klant, email of order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="any">Alle statussen</option>
          <option value="processing">In behandeling</option>
          <option value="completed">Afgerond</option>
          <option value="on-hold">In wacht</option>
          <option value="pending">Wachtend</option>
          <option value="cancelled">Geannuleerd</option>
          <option value="refunded">Terugbetaald</option>
        </select>
      </div>

      {/* Orders List */}
      {loading ? (
        <ListRowSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <ShoppingCart className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">Geen orders gevonden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const st = STATUS_MAP[o.status] || STATUS_MAP.pending;
            const StIcon = st.icon;
            return (
              <button
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${st.color}`}>
                  <StIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">#{o.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-white/40">
                    {o.customer} · {o.payment_method}
                  </p>
                  {o.items && o.items.length > 0 && (
                    <p className="mt-0.5 truncate text-[10px] text-white/25">
                      {o.items.slice(0, 3).map((it) => it.name).join(", ")}
                      {o.items.length > 3 && ` +${o.items.length - 3} meer`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">€{o.total}</p>
                  <p className="text-[10px] text-white/25">
                    {new Date(o.created_at).toLocaleDateString("nl-BE")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Order Detail Slide-over */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={updateStatus}
          onAddNote={addNote}
        />
      )}
    </div>
  );
}

function OrderDetail({
  order,
  onClose,
  onUpdateStatus,
  onAddNote,
}: {
  order: Order;
  onClose: () => void;
  onUpdateStatus: (id: number, status: string) => void;
  onAddNote: (id: number, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const st = STATUS_MAP[order.status] || STATUS_MAP.pending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-white/5 bg-brand-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-brand-950/95 px-6 py-4 backdrop-blur-xl">
          <div>
            <h2 className="text-lg font-semibold text-white">Order #{order.id}</h2>
            <p className="text-xs text-white/30">
              {new Date(order.created_at).toLocaleString("nl-BE")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Status + Actions */}
          <div>
            <label className="mb-2 block text-xs font-medium text-white/40">Status</label>
            <select
              value={order.status}
              onChange={(e) => onUpdateStatus(order.id, e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="pending">Wachtend</option>
              <option value="processing">In behandeling</option>
              <option value="on-hold">In wacht</option>
              <option value="completed">Afgerond</option>
              <option value="cancelled">Geannuleerd</option>
              <option value="refunded">Terugbetaald</option>
            </select>
          </div>

          {/* Customer */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">Klant</h3>
            <p className="text-sm font-medium text-white">{order.customer}</p>
            <p className="text-xs text-white/40">{order.email}</p>
            <p className="mt-1 text-xs text-white/30">{order.payment_method}</p>
          </div>

          {/* Items */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">
              Artikelen ({order.items_count})
            </h3>
            <div className="space-y-2">
              {order.items?.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{item.name}</p>
                    <p className="text-[10px] text-white/30">{item.quantity}x</p>
                  </div>
                  <span className="text-sm font-medium text-white/70">€{item.total}</span>
                </div>
              ))}
            </div>
            <hr className="my-3 border-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white/50">Totaal</span>
              <span className="text-lg font-bold text-white">€{order.total}</span>
            </div>
          </div>

          {/* Add Note */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">Notitie toevoegen</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Schrijf een notitie..."
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && note.trim()) {
                    onAddNote(order.id, note);
                    setNote("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (note.trim()) {
                    onAddNote(order.id, note);
                    setNote("");
                  }
                }}
                className="rounded-lg bg-brand-500 p-2 text-white transition hover:bg-brand-600"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
