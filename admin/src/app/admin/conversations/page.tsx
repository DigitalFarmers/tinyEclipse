"use client";

import { useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  Search,
  RefreshCw,
  Bot,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Mail,
  MapPin,
  Languages,
  UserCheck,
  Link2,
  Sparkles,
  TrendingUp,
  Tag,
  Brain,
  Phone,
  Building2,
} from "lucide-react";
import { getTenants, getConversations, getConversation } from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; }

interface ConversationSummary {
  id: string;
  tenant_id: string;
  session_id: string;
  channel: string;
  status: string;
  created_at: string;
  message_count: number;
  visitor_name?: string | null;
  visitor_email?: string | null;
  visitor_ip?: string | null;
  visitor_country?: string | null;
  visitor_city?: string | null;
  visitor_device?: string | null;
  visitor_browser?: string | null;
  visitor_language?: string | null;
  contact_id?: string | null;
}

interface MessageDetail {
  id: string;
  role: string;
  content: string;
  confidence: number | null;
  sources_used: any[] | null;
  escalated: boolean;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  tenant_id: string;
  session_id: string;
  channel: string;
  status: string;
  created_at: string;
  messages: MessageDetail[];
  visitor_name?: string | null;
  visitor_email?: string | null;
  visitor_ip?: string | null;
  visitor_country?: string | null;
  visitor_city?: string | null;
  visitor_device?: string | null;
  visitor_browser?: string | null;
  visitor_language?: string | null;
  contact_id?: string | null;
  visitor_identity?: Record<string, any> | null;
}

function getConvStats(detail: ConversationDetail) {
  const msgs = detail.messages || [];
  const aiMsgs = msgs.filter(m => m.role === "assistant" && m.confidence !== null);
  const avgConf = aiMsgs.length > 0 ? aiMsgs.reduce((s, m) => s + (m.confidence || 0), 0) / aiMsgs.length : 0;
  const escalated = msgs.some(m => m.escalated);
  const lowConf = aiMsgs.filter(m => (m.confidence || 0) < 0.4).length;
  const summary = detail.visitor_identity?.conversation_summary;
  const topics = summary?.topics || [];
  const userMsgCount = msgs.filter(m => m.role === "user").length;
  const phone = detail.visitor_identity?.phone;
  const company = detail.visitor_identity?.company;
  return { avgConf, escalated, lowConf, summary, topics, userMsgCount, phone, company };
}

export default function ConversationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTenants().then(setTenants).catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations();
  }, [filter, tenantFilter]);

  async function loadConversations() {
    setLoading(true);
    try {
      const tid = tenantFilter || undefined;
      const status = filter || undefined;
      const data = await getConversations(tid, status);
      setConversations(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const openConversation = async (id: string) => {
    try {
      const detail = await getConversation(id);
      setSelected(detail);
      setTimeout(() => detailRef.current?.scrollTo({ top: detailRef.current.scrollHeight, behavior: "smooth" }), 100);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const tn = (id: string) => tenants.find(t => t.id === id)?.name || id.slice(0, 8);
  const td = (id: string) => tenants.find(t => t.id === id)?.domain || "";

  const filtered = search
    ? conversations.filter(c =>
        tn(c.tenant_id).toLowerCase().includes(search.toLowerCase()) ||
        c.session_id.toLowerCase().includes(search.toLowerCase()) ||
        (c.visitor_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.visitor_email || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.visitor_city || "").toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const DeviceIcon = ({ device }: { device?: string | null }) => {
    if (device === "mobile") return <Smartphone className="h-3 w-3" />;
    if (device === "tablet") return <Tablet className="h-3 w-3" />;
    return <Monitor className="h-3 w-3" />;
  };

  const visitorLabel = (c: ConversationSummary) => {
    if (c.visitor_name) return c.visitor_name;
    if (c.visitor_email) return c.visitor_email.split("@")[0];
    if (c.visitor_city && c.visitor_device) return `${c.visitor_city} · ${c.visitor_device}`;
    if (c.visitor_ip) return `Bezoeker ${c.visitor_ip.split(".").slice(0, 2).join(".")}.**`;
    return c.session_id.slice(0, 12) + "...";
  };

  const identifiedCount = conversations.filter(c => c.visitor_name || c.visitor_email || c.contact_id).length;

  const confColor = (c: number) => c >= 0.7 ? "text-green-400" : c >= 0.4 ? "text-yellow-400" : "text-red-400";
  const confBg = (c: number) => c >= 0.7 ? "bg-green-500" : c >= 0.4 ? "bg-yellow-500" : "bg-red-500";

  const statusCounts = {
    all: conversations.length,
    active: conversations.filter(c => c.status === "active").length,
    escalated: conversations.filter(c => c.status === "escalated").length,
    closed: conversations.filter(c => c.status === "closed").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MessageSquare className="h-6 w-6 text-brand-400" /> Conversations
          </h1>
          <p className="mt-0.5 text-sm text-white/40">{conversations.length} gesprek{conversations.length !== 1 ? "ken" : ""} over alle sites</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none"
          >
            <option value="" className="bg-brand-950">Alle sites</option>
            {tenants.map(t => <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>)}
          </select>
          <button onClick={loadConversations} disabled={loading} className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          {([
            { key: "", label: "Alle", count: statusCounts.all },
            { key: "active", label: "Actief", count: statusCounts.active },
            { key: "escalated", label: "Escalated", count: statusCounts.escalated },
            { key: "closed", label: "Gesloten", count: statusCounts.closed },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === s.key
                  ? s.key === "escalated" ? "bg-red-500/20 text-red-400" : "bg-brand-600 text-white"
                  : "border border-white/10 text-white/50 hover:bg-white/5"
              }`}
            >
              {s.label}
              {s.count > 0 && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">{s.count}</span>}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            placeholder="Zoek op site of sessie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none focus:border-brand-500/30"
          />
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      {/* Main Grid */}
      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        {/* Conversation List */}
        <div className="lg:col-span-2 space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {loading && filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-white/40">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
              <span className="ml-3 text-sm">Laden...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <MessageSquare className="mx-auto h-6 w-6 text-white/15" />
              <p className="mt-2 text-xs text-white/30">Geen gesprekken gevonden</p>
            </div>
          ) : filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selected?.id === c.id
                  ? "border-brand-500/40 bg-brand-500/10"
                  : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/50">
                    {tn(c.tenant_id)}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    c.status === "escalated" ? "bg-red-500/20 text-red-400"
                    : c.status === "active" ? "bg-green-500/20 text-green-400"
                    : "bg-white/10 text-white/30"
                  }`}>{c.status}</span>
                  {c.contact_id && (
                    <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                      <UserCheck className="inline h-2.5 w-2.5 mr-0.5" />ID
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-white/20">{timeAgo(c.created_at)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                  c.visitor_name || c.contact_id ? "bg-purple-500/10" : c.visitor_email ? "bg-blue-500/10" : "bg-white/5"
                }`}>
                  {c.visitor_name || c.contact_id ? (
                    <UserCheck className="h-3.5 w-3.5 text-purple-400" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-white/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white/80 truncate">
                    {visitorLabel(c)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.visitor_device && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/25">
                        <DeviceIcon device={c.visitor_device} /> {c.visitor_device}
                      </span>
                    )}
                    {c.visitor_language && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/25">
                        <Languages className="h-2.5 w-2.5" /> {c.visitor_language.toUpperCase()}
                      </span>
                    )}
                    {c.visitor_city && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/25">
                        <MapPin className="h-2.5 w-2.5" /> {c.visitor_city}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 text-[9px] text-white/25 ml-auto">
                      <MessageSquare className="h-2.5 w-2.5" /> {c.message_count}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              {/* Detail Header */}
              <div className="border-b border-white/5 px-4 py-3 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      selected.contact_id ? "bg-purple-500/10" : selected.status === "escalated" ? "bg-red-500/10" : "bg-brand-500/10"
                    }`}>
                      {selected.contact_id ? (
                        <UserCheck className="h-4 w-4 text-purple-400" />
                      ) : (
                        <MessageSquare className={`h-4 w-4 ${selected.status === "escalated" ? "text-red-400" : "text-brand-400"}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">
                          {selected.visitor_name || selected.visitor_email?.split("@")[0] || tn(selected.tenant_id)}
                        </h3>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          selected.status === "escalated" ? "bg-red-500/20 text-red-400"
                          : selected.status === "active" ? "bg-green-500/20 text-green-400"
                          : "bg-white/10 text-white/30"
                        }`}>{selected.status}</span>
                        {selected.contact_id && (
                          <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                            Bekend contact
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/30">
                        {td(selected.tenant_id)} · {new Date(selected.created_at).toLocaleString("nl-BE")} · {selected.messages.length} berichten
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Visitor Identity Bar */}
                {(selected.visitor_device || selected.visitor_email || selected.visitor_city || selected.visitor_language) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selected.visitor_email && (
                      <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
                        <Mail className="h-2.5 w-2.5" /> {selected.visitor_email}
                      </span>
                    )}
                    {selected.visitor_city && (
                      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                        <MapPin className="h-2.5 w-2.5" /> {selected.visitor_city}{selected.visitor_country ? `, ${selected.visitor_country.toUpperCase()}` : ""}
                      </span>
                    )}
                    {selected.visitor_device && (
                      <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                        <DeviceIcon device={selected.visitor_device} /> {selected.visitor_browser || selected.visitor_device}
                      </span>
                    )}
                    {selected.visitor_language && (
                      <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                        <Languages className="h-2.5 w-2.5" /> {selected.visitor_language.toUpperCase()}
                      </span>
                    )}
                    {selected.visitor_ip && (
                      <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/25">
                        <Globe className="h-2.5 w-2.5" /> {selected.visitor_ip}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Conversation Intelligence Bar */}
              {(() => {
                const stats = getConvStats(selected);
                return (
                  <div className="border-b border-white/5 px-4 py-2.5 bg-white/[0.01]">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Avg Confidence */}
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        stats.avgConf >= 0.7 ? "bg-green-500/10 text-green-400" : stats.avgConf >= 0.4 ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        <Brain className="h-2.5 w-2.5" /> {Math.round(stats.avgConf * 100)}% confidence
                      </span>
                      {stats.lowConf > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5" /> {stats.lowConf} zwakke antwoorden
                        </span>
                      )}
                      {stats.phone && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                          <Phone className="h-2.5 w-2.5" /> {stats.phone}
                        </span>
                      )}
                      {stats.company && (
                        <span className="flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400">
                          <Building2 className="h-2.5 w-2.5" /> {stats.company}
                        </span>
                      )}
                      {stats.topics.length > 0 && stats.topics.map((t: string) => (
                        <span key={t} className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-white/30">
                          <Tag className="h-2 w-2" /> {t}
                        </span>
                      ))}
                    </div>
                    {/* AI Summary */}
                    {stats.summary?.summary && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-brand-500/5 border border-brand-500/10 p-2.5">
                        <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-brand-400 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-white/60 leading-relaxed">{stats.summary.summary}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[9px] text-white/20">{stats.summary.message_count} berichten</span>
                            <span className={`text-[9px] font-semibold ${stats.summary.avg_confidence >= 0.7 ? "text-green-400" : stats.summary.avg_confidence >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                              {Math.round((stats.summary.avg_confidence || 0) * 100)}% avg
                            </span>
                            {stats.summary.escalated && <span className="text-[9px] font-semibold text-red-400">Geëscaleerd</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Messages */}
              <div ref={detailRef} className="max-h-[calc(100vh-420px)] overflow-y-auto p-4 space-y-3">
                {selected.messages.map((m) => (
                  <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
                    {m.role !== "user" && (
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                        m.escalated ? "bg-red-500/10" : "bg-brand-500/10"
                      }`}>
                        <Bot className={`h-3.5 w-3.5 ${m.escalated ? "text-red-400" : "text-brand-400"}`} />
                      </div>
                    )}
                    <div className={`max-w-[85%] ${m.role === "user" ? "order-first" : ""}`}>
                      <div className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "bg-brand-600 text-white"
                          : m.escalated
                          ? "border border-red-500/20 bg-red-500/5 text-white/80"
                          : "border border-white/5 bg-white/[0.03] text-white/80"
                      }`}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                      {m.confidence !== null && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1 w-16 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${confBg(m.confidence)} transition-all`} style={{ width: `${m.confidence * 100}%` }} />
                          </div>
                          <span className={`text-[10px] font-semibold ${confColor(m.confidence)}`}>
                            {Math.round(m.confidence * 100)}%
                          </span>
                          {m.escalated && <span className="text-[10px] font-semibold text-red-400">ESC</span>}
                          {m.sources_used && m.sources_used.length > 0 && (
                            <span className="text-[10px] text-white/20">{m.sources_used.length} bronnen</span>
                          )}
                        </div>
                      )}
                      <p className="mt-0.5 text-[9px] text-white/15">
                        {new Date(m.created_at).toLocaleTimeString("nl-BE")}
                      </p>
                    </div>
                    {m.role === "user" && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <User className="h-3.5 w-3.5 text-white/50" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-white/10">
              <div className="text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-white/10" />
                <p className="mt-3 text-sm text-white/25">Selecteer een gesprek</p>
                <p className="mt-1 text-[11px] text-white/15">Klik op een gesprek links om de details te zien</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u`;
  return `${Math.floor(hrs / 24)}d`;
}
