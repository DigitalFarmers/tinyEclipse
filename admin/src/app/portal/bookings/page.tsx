"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Booking {
  id: number;
  service_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: string;
  notes: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Bevestigd", color: "text-green-400 bg-green-500/10" },
  pending: { label: "Wachtend", color: "text-yellow-400 bg-yellow-500/10" },
  cancelled: { label: "Geannuleerd", color: "text-red-400 bg-red-500/10" },
  completed: { label: "Afgerond", color: "text-blue-400 bg-blue-500/10" },
  no_show: { label: "Niet verschenen", color: "text-orange-400 bg-orange-500/10" },
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
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
    const [bRes, uRes] = await Promise.all([
      fetch(`${API}/api/portal/data/${tid}/bookings`),
      fetch(`${API}/api/portal/data/${tid}/bookings/upcoming`),
    ]);
    if (bRes.ok) {
      const d = await bRes.json();
      setBookings(d.bookings || d.items || []);
    }
    if (uRes.ok) {
      const d = await uRes.json();
      setUpcoming(d.bookings || d.items || []);
    }
    setLoading(false);
  }

  async function updateBooking(id: number, action: "confirm" | "cancel") {
    await fetch(`${API}/api/portal/data/${tenantId}/bookings/${id}/${action}`, { method: "POST" });
    fetchData(tenantId);
  }

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.customer_name?.toLowerCase().includes(q) || b.service_name?.toLowerCase().includes(q);
  });

  const stats = {
    total: bookings.length,
    upcoming: upcoming.length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    pending: bookings.filter((b) => b.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Boekingen</h1>
          <p className="mt-1 text-sm text-white/40">Afspraken en reserveringen beheren</p>
        </div>
        <button
          onClick={() => fetchData(tenantId)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" /> Vernieuwen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-brand-400/60">Totaal</p>
          <p className="mt-1 text-2xl font-bold text-brand-400">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-blue-400/60">Aankomend</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{stats.upcoming}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-green-400/60">Bevestigd</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{stats.confirmed}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-yellow-400/60">Wachtend</p>
          <p className="mt-1 text-2xl font-bold text-yellow-400">{stats.pending}</p>
        </div>
      </div>

      {/* Upcoming Banner */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-400">
            Eerstvolgende boekingen
          </h3>
          <div className="space-y-2">
            {upcoming.slice(0, 3).map((b) => (
              <div key={b.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-white">{b.date} {b.time}</span>
                <span className="text-white/40">—</span>
                <span className="text-white/60">{b.service_name}</span>
                <span className="text-white/30">({b.customer_name})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Zoek op klant of dienst..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <CalendarDays className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">Geen boekingen gevonden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const st = STATUS_MAP[b.status] || STATUS_MAP.pending;
            return (
              <div key={b.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                    <span className="text-xs font-bold">{b.date?.split("-")[2]}</span>
                    <span className="text-[9px] uppercase">{new Date(b.date).toLocaleDateString("nl-BE", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{b.service_name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/35">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.time} · {b.duration_minutes}min</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{b.customer_name}</span>
                      {b.customer_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{b.customer_email}</span>}
                    </div>
                  </div>
                  {b.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateBooking(b.id, "confirm")}
                        className="rounded-lg bg-green-500/10 p-2 text-green-400 transition hover:bg-green-500/20"
                        title="Bevestigen"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => updateBooking(b.id, "cancel")}
                        className="rounded-lg bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20"
                        title="Annuleren"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
