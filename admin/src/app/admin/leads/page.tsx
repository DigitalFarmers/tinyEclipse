"use client";

import { useEffect, useState } from "react";
import {
  UserPlus, Mail, Phone, Globe, Clock, RefreshCw, MessageSquare,
  TrendingUp, ArrowUpRight, Filter, Search, Zap,
} from "lucide-react";
import { getTenants, getLeads, getLeadStats } from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; }
interface Lead {
  id: string; tenant_id: string; session_id: string | null;
  conversation_id: string | null; email: string | null; name: string | null;
  phone: string | null; message: string | null; source: string;
  page_url: string | null; created_at: string;
}

export default function LeadsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tenantFilter, setTenantFilter] = useState("");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getTenants().then(setTenants).catch(() => {}); }, []);
  useEffect(() => { loadData(); }, [tenantFilter, days]);

  async function loadData() {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        getLeads(tenantFilter || undefined, days).catch(() => []),
        getLeadStats(tenantFilter || undefined).catch(() => null),
      ]);
      setLeads(l);
      setStats(s);
    } finally { setLoading(false); }
  }

  const tn = (id: string) => tenants.find(t => t.id === id)?.name || id.slice(0, 8);

  const filtered = search
    ? leads.filter(l =>
        (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.phone || "").includes(search) ||
        tn(l.tenant_id).toLowerCase().includes(search.toLowerCase())
      )
    : leads;

  const sourceColors: Record<string, string> = {
    chat: "bg-brand-500/20 text-brand-400",
    exit_intent: "bg-red-500/20 text-red-400",
    proactive: "bg-purple-500/20 text-purple-400",
    manual: "bg-blue-500/20 text-blue-400",
  };
  const sourceLabels: Record<string, string> = {
    chat: "Chat", exit_intent: "Exit Intent", proactive: "Proactief", manual: "Handmatig",
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <UserPlus className="h-6 w-6 text-brand-400" /> Leads
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Contactgegevens van bezoekers via de chat widget</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            <option value="" className="bg-brand-950">Alle sites</option>
            {tenants.filter(t => (t as any).environment !== "staging").map(t =>
              <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>
            )}
          </select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            <option value={7} className="bg-brand-950">7 dagen</option>
            <option value={30} className="bg-brand-950">30 dagen</option>
            <option value={90} className="bg-brand-950">90 dagen</option>
          </select>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 to-brand-600/5 p-4">
            <div className="flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-brand-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Totaal</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Vandaag</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold">{stats.today}</p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Deze week</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold">{stats.this_week}</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Via Chat</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold">{stats.by_source?.chat || 0}</p>
            {stats.by_source?.exit_intent > 0 && (
              <p className="mt-0.5 text-[10px] text-white/30">{stats.by_source.exit_intent} exit intent</p>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mt-5 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op naam, email, telefoon of site..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-xs text-white/70 outline-none focus:border-brand-500/30"
        />
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Leads laden...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-sm text-white/40">
            {leads.length === 0 ? "Nog geen leads — zodra bezoekers hun gegevens achterlaten verschijnen ze hier" : "Geen resultaten voor deze zoekopdracht"}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {filtered.map((lead) => (
            <div key={lead.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                    <UserPlus className="h-4 w-4 text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {lead.name && <span className="text-sm font-semibold">{lead.name}</span>}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                      )}
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
                          <Phone className="h-3 w-3" /> {lead.phone}
                        </a>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                        {tn(lead.tenant_id)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sourceColors[lead.source] || "bg-white/10 text-white/40"}`}>
                        {sourceLabels[lead.source] || lead.source}
                      </span>
                      {lead.page_url && (
                        <span className="flex items-center gap-1 text-[10px] text-white/25">
                          <Globe className="h-2.5 w-2.5" /> {new URL(lead.page_url).pathname}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-white/25">
                        <Clock className="h-2.5 w-2.5" /> {new Date(lead.created_at).toLocaleString("nl-BE")}
                      </span>
                    </div>
                    {lead.message && (
                      <p className="mt-1.5 text-[11px] text-white/40 line-clamp-2">{lead.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {lead.email && (
                    <a href={`mailto:${lead.email}`}
                      className="rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-[10px] font-medium text-brand-400 transition hover:bg-brand-500/20">
                      E-mail
                    </a>
                  )}
                  {lead.conversation_id && (
                    <a href={`/admin/conversations?id=${lead.conversation_id}`}
                      className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/50 transition hover:bg-white/10">
                      Chat
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
