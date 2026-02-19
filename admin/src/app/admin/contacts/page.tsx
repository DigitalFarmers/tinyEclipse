"use client";

import { useEffect, useState } from "react";
import {
  Users, Mail, Phone, Globe, Clock, RefreshCw, Search, ShoppingCart,
  MessageSquare, FileText, UserPlus, TrendingUp, ChevronRight, ArrowLeft,
  MapPin, Tag, DollarSign,
} from "lucide-react";
import { getTenants, getContacts, getContact, getContactStats } from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; }

export default function ContactsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tenantFilter, setTenantFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { getTenants().then(setTenants).catch(() => {}); }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadData(); }, [tenantFilter, searchDebounce]);

  async function loadData() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        getContacts(tenantFilter || undefined, searchDebounce || undefined).catch(() => []),
        getContactStats(tenantFilter || undefined).catch(() => null),
      ]);
      setContacts(c);
      setStats(s);
    } finally { setLoading(false); }
  }

  async function openContact(id: string) {
    setDetailLoading(true);
    try {
      const c = await getContact(id);
      setSelectedContact(c);
    } catch { }
    finally { setDetailLoading(false); }
  }

  const tn = (id: string) => tenants.find(t => t.id === id)?.name || id.slice(0, 8);

  if (selectedContact) {
    return <ContactDetail contact={selectedContact} tenantName={tn(selectedContact.tenant_id)} onBack={() => setSelectedContact(null)} />;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-brand-400" /> Contacts
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Unified identities — elke persoon across orders, chats, formulieren en leads</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            <option value="" className="bg-brand-950">Alle sites</option>
            {tenants.filter(t => (t as any).environment !== "staging").map(t =>
              <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>
            )}
          </select>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-5">
          <SC icon={Users} label="Totaal" value={stats.total} color="brand" />
          <SC icon={TrendingUp} label="Vandaag" value={stats.today} color="green" />
          <SC icon={Clock} label="Deze week" value={stats.this_week} color="purple" />
          <SC icon={ShoppingCart} label="Met orders" value={stats.with_orders} color="blue" />
          <SC icon={MessageSquare} label="Met chats" value={stats.with_conversations} color="yellow" />
        </div>
      )}

      {/* Search */}
      <div className="mt-5 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op naam, email, telefoon of bedrijf..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-xs text-white/70 outline-none focus:border-brand-500/30" />
      </div>

      {/* Contacts List */}
      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Contacts laden...</span>
        </div>
      ) : contacts.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-sm text-white/40">
            {search ? "Geen contacten gevonden" : "Nog geen contacten — zodra bezoekers interacteren verschijnen ze hier"}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {contacts.map((c: any) => (
            <button key={c.id} onClick={() => openContact(c.id)}
              className="w-full text-left rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-purple-500/20">
                    <span className="text-sm font-bold text-brand-400">
                      {(c.name || c.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{c.name || c.email || c.phone || "Onbekend"}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/50">{tn(c.tenant_id)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {c.email && <span className="flex items-center gap-1 text-[11px] text-white/40"><Mail className="h-2.5 w-2.5" />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1 text-[11px] text-white/40"><Phone className="h-2.5 w-2.5" />{c.phone}</span>}
                      {c.city && <span className="flex items-center gap-1 text-[11px] text-white/30"><MapPin className="h-2.5 w-2.5" />{c.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.total_orders > 0 && (
                    <div className="text-center">
                      <p className="text-xs font-bold text-green-400">{c.total_orders}</p>
                      <p className="text-[9px] text-white/25">orders</p>
                    </div>
                  )}
                  {c.total_spent > 0 && (
                    <div className="text-center">
                      <p className="text-xs font-bold text-blue-400">€{c.total_spent.toFixed(0)}</p>
                      <p className="text-[9px] text-white/25">besteed</p>
                    </div>
                  )}
                  {c.total_conversations > 0 && (
                    <div className="text-center">
                      <p className="text-xs font-bold text-purple-400">{c.total_conversations}</p>
                      <p className="text-[9px] text-white/25">chats</p>
                    </div>
                  )}
                  {c.total_leads > 0 && (
                    <div className="text-center">
                      <p className="text-xs font-bold text-brand-400">{c.total_leads}</p>
                      <p className="text-[9px] text-white/25">leads</p>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-white/15" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactDetail({ contact, tenantName, onBack }: { contact: any; tenantName: string; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar contacten
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20">
            <span className="text-xl font-bold text-brand-400">
              {(contact.name || contact.email || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{contact.name || "Onbekend"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300">
                  <Mail className="h-3.5 w-3.5" /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300">
                  <Phone className="h-3.5 w-3.5" /> {contact.phone}
                </a>
              )}
              {contact.company && <span className="flex items-center gap-1.5 text-sm text-white/50"><Globe className="h-3.5 w-3.5" />{contact.company}</span>}
              {contact.city && <span className="flex items-center gap-1.5 text-sm text-white/40"><MapPin className="h-3.5 w-3.5" />{contact.city}{contact.country ? `, ${contact.country}` : ""}</span>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/50">{tenantName}</span>
              {contact.language && <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-medium text-blue-400">{contact.language}</span>}
              <span className="text-[10px] text-white/25">Eerste contact: {new Date(contact.first_seen_at).toLocaleDateString("nl-BE")}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl bg-white/[0.03] p-3 text-center">
            <ShoppingCart className="mx-auto h-4 w-4 text-green-400" />
            <p className="mt-1 text-lg font-bold">{contact.total_orders}</p>
            <p className="text-[10px] text-white/30">Orders</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3 text-center">
            <DollarSign className="mx-auto h-4 w-4 text-blue-400" />
            <p className="mt-1 text-lg font-bold">€{(contact.total_spent || 0).toFixed(2)}</p>
            <p className="text-[10px] text-white/30">Besteed</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3 text-center">
            <MessageSquare className="mx-auto h-4 w-4 text-purple-400" />
            <p className="mt-1 text-lg font-bold">{contact.total_conversations}</p>
            <p className="text-[10px] text-white/30">Chats</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3 text-center">
            <FileText className="mx-auto h-4 w-4 text-yellow-400" />
            <p className="mt-1 text-lg font-bold">{contact.total_form_submissions}</p>
            <p className="text-[10px] text-white/30">Formulieren</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3 text-center">
            <UserPlus className="mx-auto h-4 w-4 text-brand-400" />
            <p className="mt-1 text-lg font-bold">{contact.total_leads}</p>
            <p className="text-[10px] text-white/30">Leads</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Interactie Timeline</h2>
        <div className="space-y-2">
          {/* Events (orders, forms) */}
          {(contact.events || []).map((e: any) => (
            <div key={e.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                e.event_type?.includes("order") ? "bg-green-500/10" : "bg-yellow-500/10"
              }`}>
                {e.event_type?.includes("order") ? <ShoppingCart className="h-3.5 w-3.5 text-green-400" /> : <FileText className="h-3.5 w-3.5 text-yellow-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{e.title}</p>
                {e.description && <p className="text-[11px] text-white/40">{e.description}</p>}
                <p className="mt-0.5 text-[10px] text-white/25">{e.module_type} · {new Date(e.created_at).toLocaleString("nl-BE")}</p>
              </div>
            </div>
          ))}
          {/* Leads */}
          {(contact.leads || []).map((l: any) => (
            <div key={l.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                <UserPlus className="h-3.5 w-3.5 text-brand-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">Lead via {l.source}</p>
                {l.message && <p className="text-[11px] text-white/40">{l.message}</p>}
                <p className="mt-0.5 text-[10px] text-white/25">{l.page_url ? new URL(l.page_url).pathname : ""} · {new Date(l.created_at).toLocaleString("nl-BE")}</p>
              </div>
            </div>
          ))}
          {(!contact.events?.length && !contact.leads?.length) && (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <Clock className="mx-auto h-6 w-6 text-white/15" />
              <p className="mt-2 text-[11px] text-white/30">Nog geen interacties geregistreerd</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SC({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20",
    green: "from-green-500/10 to-green-600/5 border-green-500/20",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20",
  };
  const ic: Record<string, string> = { brand: "text-brand-400", green: "text-green-400", purple: "text-purple-400", blue: "text-blue-400", yellow: "text-yellow-400" };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${ic[color]}`} />
        <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
