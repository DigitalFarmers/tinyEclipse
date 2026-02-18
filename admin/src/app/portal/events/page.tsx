"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ShieldAlert,
  Users,
  Mail,
  DollarSign,
  Flame,
  Filter,
  RefreshCw,
  Clock,
  ChevronDown,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Event {
  id: string;
  type: string;
  icon: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  severity: string;
  timestamp: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  lead: { icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  chat: { icon: MessageSquare, color: "text-brand-400", bg: "bg-brand-500/10 border-brand-500/20" },
  alert: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  visit: { icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  contact: { icon: Mail, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  sale: { icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-yellow-500",
  success: "bg-green-500",
  info: "bg-blue-500",
};

export default function PortalEventsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<any>(null);
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) { router.replace("/portal/login"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.replace("/portal/login"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    loadEvents();
    loadStats();
  }, [session, hours, filter]);

  async function loadEvents() {
    setLoading(true);
    try {
      let url = `${API_URL}/api/portal/events/${session.tenant_id}?hours=${hours}&limit=100`;
      if (filter) url += `&event_type=${filter}`;
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setEvents(data.events || []);
        setSummary(data.summary || {});
      }
    } catch {}
    setLoading(false);
  }

  async function loadStats() {
    try {
      const r = await fetch(`${API_URL}/api/portal/events/${session.tenant_id}/stats`, { cache: "no-store" });
      if (r.ok) setStats(await r.json());
    } catch {}
  }

  if (!session) return null;

  const filters = [
    { key: null, label: "Alles" },
    { key: "lead", label: "Leads" },
    { key: "chat", label: "Chats" },
    { key: "alert", label: "Alerts" },
    { key: "visit", label: "Bezoekers" },
    { key: "contact", label: "Contact" },
    { key: "sale", label: "Sales" },
  ];

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "zojuist";
    if (mins < 60) return `${mins}m geleden`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}u geleden`;
    const days = Math.floor(hrs / 24);
    return `${days}d geleden`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Activiteit</h1>
          <p className="mt-0.5 text-sm text-white/40">
            Alles wat er gebeurt op {session.domain}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none"
          >
            <option value={1} className="bg-brand-950">Laatste uur</option>
            <option value={24} className="bg-brand-950">24 uur</option>
            <option value={168} className="bg-brand-950">7 dagen</option>
            <option value={720} className="bg-brand-950">30 dagen</option>
          </select>
          <button
            onClick={loadEvents}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Chats 24u</p>
            <p className="mt-1 text-xl font-bold">{stats.last_24h.conversations}</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Bezoekers 24u</p>
            <p className="mt-1 text-xl font-bold">{stats.last_24h.visitors}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Alerts 24u</p>
            <p className="mt-1 text-xl font-bold">{stats.last_24h.alerts}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Open alerts</p>
            <p className="mt-1 text-xl font-bold">{stats.unresolved_alerts}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key || "all"}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              filter === f.key
                ? "bg-brand-500 text-white"
                : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
            }`}
          >
            {f.label}
            {summary[f.key || ""] ? ` (${summary[f.key || ""]})` : ""}
          </button>
        ))}
      </div>

      {/* Events Timeline */}
      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Laden...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Clock className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">
            {filter ? "Geen events van dit type gevonden." : "Nog geen activiteit in deze periode."}
          </p>
          <p className="mt-1 text-xs text-white/25">
            Events verschijnen hier zodra er activiteit is op je site.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {events.map((event) => {
            const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.visit;
            const Icon = config.icon;
            return (
              <div
                key={event.id}
                className={`flex items-start gap-3 rounded-xl border p-4 transition hover:bg-white/[0.02] ${config.bg}`}
              >
                <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[event.severity] || SEVERITY_DOT.info}`} />
                    <span className="text-xs font-semibold">{event.title}</span>
                    <span className="ml-auto flex-shrink-0 text-[10px] text-white/30">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/50 line-clamp-2">{event.description}</p>
                  {event.metadata?.message_count && (
                    <span className="mt-1 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-white/30">
                      {event.metadata.message_count} berichten
                    </span>
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
