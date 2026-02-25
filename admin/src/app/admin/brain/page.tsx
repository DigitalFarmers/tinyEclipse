"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  MessageSquare,
  TrendingUp,
  Eye,
  Users,
  Sparkles,
  Send,
  X,
  BarChart3,
  Clock,
  Globe,
  Smartphone,
  ArrowUpRight,
} from "lucide-react";
import {
  getTenants,
  getBrainHealth,
  getBrainGaps,
  getBrainSelfReport,
  resolveGap,
  dismissGap,
  getVisitorProfiles,
} from "@/lib/api";

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-600 bg-emerald-50 border-emerald-200",
  A: "text-emerald-600 bg-emerald-50 border-emerald-200",
  B: "text-blue-600 bg-blue-50 border-blue-200",
  C: "text-amber-600 bg-amber-50 border-amber-200",
  D: "text-orange-600 bg-orange-50 border-orange-200",
  F: "text-red-600 bg-red-50 border-red-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  product: "Product",
  pricing: "Prijzen",
  shipping: "Verzending",
  returns: "Retouren",
  hours: "Openingstijden",
  contact: "Contact",
  process: "Proces",
  technical: "Technisch",
  policy: "Beleid",
  other: "Overig",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-700 bg-red-50",
  medium: "text-amber-700 bg-amber-50",
  low: "text-emerald-700 bg-emerald-50",
};

export default function BrainPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [health, setHealth] = useState<any>(null);
  const [selfReport, setSelfReport] = useState<any>(null);
  const [gaps, setGaps] = useState<any>(null);
  const [visitors, setVisitors] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"health" | "gaps" | "visitors">("health");
  const [gapFilter, setGapFilter] = useState("open");
  const [resolveModal, setResolveModal] = useState<any>(null);
  const [resolveAnswer, setResolveAnswer] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    getTenants().then((d: any) => {
      const list = d.tenants || d || [];
      setTenants(list);
      if (list.length > 0) setSelectedTenant(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    setLoading(true);
    Promise.all([
      getBrainHealth(selectedTenant).catch(() => null),
      getBrainSelfReport(selectedTenant).catch(() => null),
      getBrainGaps(selectedTenant, gapFilter).catch(() => null),
      getVisitorProfiles(selectedTenant).catch(() => null),
    ]).then(([h, sr, g, v]) => {
      setHealth(h);
      setSelfReport(sr);
      setGaps(g);
      setVisitors(v);
      setLoading(false);
    });
  }, [selectedTenant, gapFilter]);

  async function handleResolve() {
    if (!resolveModal || !resolveAnswer.trim()) return;
    setResolving(true);
    try {
      await resolveGap(resolveModal.id, resolveAnswer);
      setResolveModal(null);
      setResolveAnswer("");
      // Refresh gaps
      const g = await getBrainGaps(selectedTenant, gapFilter);
      setGaps(g);
      const h = await getBrainHealth(selectedTenant);
      setHealth(h);
    } catch (e) {
      alert("Fout bij opslaan");
    }
    setResolving(false);
  }

  async function handleDismiss(gapId: string) {
    try {
      await dismissGap(gapId);
      const g = await getBrainGaps(selectedTenant, gapFilter);
      setGaps(g);
    } catch (e) {
      alert("Fout");
    }
  }

  const tenantName =
    tenants.find((t: any) => t.id === selectedTenant)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Brain</h1>
            <p className="text-sm text-gray-500">
              Kennisbank, zelf-lering & bezoekersprofielen
            </p>
          </div>
        </div>
        <select
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {tenants.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name || t.domain}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Laden...</div>
      )}

      {!loading && health && (
        <>
          {/* ── Score Banner ── */}
          <div className="bg-white border rounded-2xl p-6">
            <div className="flex items-center gap-8">
              {/* Score ring */}
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={
                      health.health_score >= 70
                        ? "#10b981"
                        : health.health_score >= 40
                        ? "#f59e0b"
                        : "#ef4444"
                    }
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${
                      (health.health_score / 100) * 327
                    } 327`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">
                    {health.health_score}
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Score
                  </span>
                </div>
              </div>

              {/* Self-report summary */}
              <div className="flex-1">
                {selfReport && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-lg font-bold px-2 py-0.5 rounded border ${
                          GRADE_COLORS[selfReport.grade] || ""
                        }`}
                      >
                        {selfReport.grade}
                      </span>
                      <span className="text-sm text-gray-500">
                        — {tenantName}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selfReport.summary}
                    </p>
                  </>
                )}
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-3 text-center flex-shrink-0">
                <div className="bg-gray-50 rounded-lg px-4 py-2">
                  <div className="text-lg font-bold text-gray-900">
                    {health.sources}
                  </div>
                  <div className="text-[10px] text-gray-500">Bronnen</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-2">
                  <div className="text-lg font-bold text-gray-900">
                    {health.open_gaps}
                  </div>
                  <div className="text-[10px] text-gray-500">Open gaps</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-2">
                  <div className="text-lg font-bold text-gray-900">
                    {(health.avg_confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-gray-500">Confidence</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-2">
                  <div className="text-lg font-bold text-gray-900">
                    {(health.escalation_rate * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-gray-500">Escalatie</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Suggestions ── */}
          {selfReport?.what_i_need?.length > 0 && (
            <div className="bg-white border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                Wat ik nodig heb om slimmer te worden
              </h3>
              <div className="space-y-2">
                {selfReport.what_i_need.map((s: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
                  >
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        PRIORITY_COLORS[s.priority] || ""
                      }`}
                    >
                      {s.priority}
                    </span>
                    <p className="text-sm text-gray-700 flex-1">{s.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: "health", label: "Kennisoverzicht", icon: BarChart3 },
              { key: "gaps", label: "Knowledge Gaps", icon: AlertTriangle },
              { key: "visitors", label: "Bezoekers", icon: Users },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  tab === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: Knowledge Overview ── */}
          {tab === "health" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category distribution */}
              <div className="bg-white border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Gaps per categorie
                </h3>
                {Object.keys(health.category_distribution || {}).length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Geen open gaps — uitstekend!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(health.category_distribution || {})
                      .sort((a: any, b: any) => b[1] - a[1])
                      .map(([cat, count]: any) => (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-24 truncate">
                            {CATEGORY_LABELS[cat] || cat}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-violet-500 h-2 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (count /
                                    Math.max(
                                      ...Object.values(
                                        health.category_distribution
                                      ).map(Number)
                                    )) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-8 text-right">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Learning stats */}
              <div className="bg-white border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Leerstatistieken (30 dagen)
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" /> Gesprekken
                    </span>
                    <span className="font-semibold">
                      {health.conversations_30d}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <Target className="w-3.5 h-3.5" /> Gem. confidence
                    </span>
                    <span className="font-semibold">
                      {(health.avg_confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5" /> Opgeloste gaps
                    </span>
                    <span className="font-semibold text-emerald-600">
                      {health.resolved_gaps}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Open gaps
                    </span>
                    <span className="font-semibold text-amber-600">
                      {health.open_gaps}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" /> Kennisbronnen
                    </span>
                    <span className="font-semibold">{health.sources}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <Brain className="w-3.5 h-3.5" /> Embedding chunks
                    </span>
                    <span className="font-semibold">{health.embeddings}</span>
                  </div>
                </div>
              </div>

              {/* Top blind spots */}
              {health.top_gaps?.length > 0 && (
                <div className="bg-white border rounded-2xl p-5 md:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-500" />
                    Top blinde vlekken
                  </h3>
                  <div className="space-y-2">
                    {health.top_gaps.slice(0, 5).map((g: any) => (
                      <div
                        key={g.id}
                        className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100"
                      >
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          {g.frequency}x
                        </span>
                        <span className="flex-1 text-sm text-gray-800">
                          {g.question}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {CATEGORY_LABELS[g.category] || g.category}
                        </span>
                        <button
                          onClick={() => {
                            setResolveModal(g);
                            setTab("gaps");
                          }}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                        >
                          Beantwoorden
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Knowledge Gaps ── */}
          {tab === "gaps" && (
            <div className="bg-white border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Knowledge Gaps ({gaps?.total || 0})
                </h3>
                <div className="flex gap-1">
                  {["open", "resolved", "dismissed"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setGapFilter(s)}
                      className={`text-xs px-3 py-1 rounded-full ${
                        gapFilter === s
                          ? "bg-violet-100 text-violet-700"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {s === "open"
                        ? "Open"
                        : s === "resolved"
                        ? "Opgelost"
                        : "Genegeerd"}
                    </button>
                  ))}
                </div>
              </div>

              {!gaps?.gaps?.length ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  {gapFilter === "open"
                    ? "Geen open knowledge gaps — de AI weet alles!"
                    : "Geen items in deze categorie."}
                </p>
              ) : (
                <div className="space-y-2">
                  {gaps.gaps.map((g: any) => (
                    <div
                      key={g.id}
                      className="border rounded-xl p-4 hover:border-violet-200 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {g.status === "open" ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : g.status === "resolved" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 font-medium">
                            {g.question}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              {CATEGORY_LABELS[g.category] || g.category}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {g.frequency}x gevraagd
                            </span>
                            <span className="text-[10px] text-gray-400">
                              Confidence:{" "}
                              {(g.avg_confidence * 100).toFixed(0)}%
                            </span>
                            {g.escalated && (
                              <span className="text-[10px] text-red-500 font-medium">
                                Geescaleerd
                              </span>
                            )}
                          </div>
                          {g.resolved_answer && (
                            <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-xs text-emerald-800">
                              {g.resolved_answer}
                            </div>
                          )}
                        </div>
                        {g.status === "open" && (
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => {
                                setResolveModal(g);
                                setResolveAnswer("");
                              }}
                              className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700"
                            >
                              Beantwoorden
                            </button>
                            <button
                              onClick={() => handleDismiss(g.id)}
                              className="text-xs text-gray-400 px-2 py-1.5 rounded-lg hover:bg-gray-100"
                            >
                              Negeren
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Visitors ── */}
          {tab === "visitors" && (
            <div className="bg-white border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Bezoekerprofielen ({visitors?.total || 0})
                </h3>
              </div>

              {!visitors?.profiles?.length ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Nog geen bezoekersprofielen. Deze worden automatisch opgebouwd
                  bij elk bezoek.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wider border-b">
                        <th className="pb-2 pl-2">Bezoeker</th>
                        <th className="pb-2">Sessies</th>
                        <th className="pb-2">Pagina&apos;s</th>
                        <th className="pb-2">Chats</th>
                        <th className="pb-2">Engagement</th>
                        <th className="pb-2">Loyaliteit</th>
                        <th className="pb-2">Tags</th>
                        <th className="pb-2">Laatst gezien</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.profiles.map((v: any) => (
                        <tr
                          key={v.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td className="py-2.5 pl-2">
                            <div>
                              <div className="font-medium text-gray-900 flex items-center gap-1.5">
                                {v.name || (
                                  <span className="text-gray-400 text-xs font-mono">
                                    {v.visitor_id?.slice(0, 12)}...
                                  </span>
                                )}
                                {v.email && (
                                  <span className="text-[10px] text-violet-500">
                                    {v.email}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                {v.country && (
                                  <span className="flex items-center gap-0.5">
                                    <Globe className="w-2.5 h-2.5" />{" "}
                                    {v.country}
                                  </span>
                                )}
                                {v.device_type && (
                                  <span className="flex items-center gap-0.5">
                                    <Smartphone className="w-2.5 h-2.5" />{" "}
                                    {v.device_type}
                                  </span>
                                )}
                                {v.language && (
                                  <span>{v.language}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 font-medium">
                            {v.total_sessions}
                          </td>
                          <td className="py-2.5">{v.total_pageviews}</td>
                          <td className="py-2.5">
                            {v.total_conversations > 0 ? (
                              <span className="text-violet-600 font-medium">
                                {v.total_conversations}
                              </span>
                            ) : (
                              <span className="text-gray-300">0</span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-violet-500 h-1.5 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      v.engagement_score
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500">
                                {v.engagement_score.toFixed(0)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-emerald-500 h-1.5 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      v.loyalty_score
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500">
                                {v.loyalty_score.toFixed(0)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(v.journey?.tags || [])
                                .slice(0, 3)
                                .map((tag: string) => (
                                  <span
                                    key={tag}
                                    className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                            </div>
                          </td>
                          <td className="py-2.5 text-xs text-gray-400">
                            {v.last_seen_at
                              ? new Date(v.last_seen_at).toLocaleDateString(
                                  "nl-BE",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Resolve Modal ── */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="p-5 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Knowledge Gap beantwoorden
                </h3>
                <button
                  onClick={() => setResolveModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">
                  Vraag van bezoeker
                </label>
                <p className="text-sm text-gray-900 mt-1 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  {resolveModal.question}
                </p>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400">
                    {resolveModal.frequency}x gevraagd
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Categorie:{" "}
                    {CATEGORY_LABELS[resolveModal.category] ||
                      resolveModal.category}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">
                  Jouw antwoord (wordt toegevoegd aan de kennisbank)
                </label>
                <textarea
                  value={resolveAnswer}
                  onChange={(e) => setResolveAnswer(e.target.value)}
                  rows={5}
                  className="w-full mt-1 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  placeholder="Typ het antwoord dat de AI voortaan moet geven..."
                  autoFocus
                />
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <button
                onClick={() => setResolveModal(null)}
                className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Annuleren
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving || !resolveAnswer.trim()}
                className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                {resolving ? "Opslaan..." : "Opslaan & indexeren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
