"use client";

import { useEffect, useState } from "react";
import { usePortalSession } from "@/lib/usePortalSession";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Database,
  ShieldAlert,
  Zap,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LearningData {
  growth_score: number;
  confidence: { current: number; trend: number; label: string };
  stats: {
    conversations_30d: number;
    total_knowledge_sources: number;
    learned_qa_total: number;
    learned_qa_this_week: number;
    learned_qa_this_month: number;
    resolved_gaps: number;
    open_gaps: number;
    escalation_rate: number;
  };
  learned_items: Array<{ id: string; title: string; content: string; created_at: string; status: string }>;
  resolved_items: Array<{ id: string; title: string; content: string; created_at: string }>;
  open_gaps: Array<{ id: string; question: string; category: string; frequency: number; avg_confidence: number; escalated: boolean; last_asked_at: string }>;
}

function ScoreRing({ score, size = 100, label, sub }: { score: number; size?: number; label: string; sub?: string }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          className="rotate-90 origin-center" fill="white" fontSize={size * 0.26} fontWeight="bold">
          {score}
        </text>
      </svg>
      <span className="text-[10px] text-white/40 font-medium">{label}</span>
      {sub && <span className="text-[9px] text-white/25">{sub}</span>}
    </div>
  );
}

const CAT_LABELS: Record<string, string> = {
  product: "Product", pricing: "Prijzen", shipping: "Verzending",
  returns: "Retour", hours: "Openingsuren", contact: "Contact",
  process: "Proces", technical: "Technisch", policy: "Beleid", other: "Overig",
};

export default function SelfLearningPage() {
  const { session } = usePortalSession();
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"learned" | "gaps" | "resolved">("learned");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  async function loadData() {
    if (!session?.tenant_id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/portal/self-learning/${session.tenant_id}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Self-learning load failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [session?.tenant_id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
        <p className="mt-4 text-sm text-white/40">AI leerdata laden...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-sm text-white/30">
        Geen leerdata beschikbaar
      </div>
    );
  }

  const s = data.stats;
  const TrendIcon = data.confidence.trend > 0 ? TrendingUp : data.confidence.trend < 0 ? TrendingDown : Minus;
  const trendColor = data.confidence.trend > 0 ? "text-emerald-400" : data.confidence.trend < 0 ? "text-red-400" : "text-white/40";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-brand-400" />
            Zelflerend AI
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Zo leert jouw AI-assistent van elk gesprek
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] text-white/50 hover:text-white transition"
        >
          <RefreshCw className="h-3 w-3" /> Ververs
        </button>
      </div>

      {/* AI Growth Banner */}
      <div className={`rounded-xl border p-5 ${
        data.growth_score >= 70 ? "bg-gradient-to-r from-emerald-500/5 to-brand-500/5 border-emerald-500/10" :
        data.growth_score >= 40 ? "bg-gradient-to-r from-yellow-500/5 to-brand-500/5 border-yellow-500/10" :
        "bg-gradient-to-r from-red-500/5 to-brand-500/5 border-red-500/10"
      }`}>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ScoreRing score={data.growth_score} size={100} label="AI Groei" />
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-sm font-semibold flex items-center gap-2 justify-center sm:justify-start">
              <Sparkles className="h-4 w-4 text-brand-400" />
              {data.growth_score >= 70 ? "Jouw AI wordt steeds slimmer!" :
               data.growth_score >= 40 ? "Jouw AI leert bij, maar kan nog meer." :
               "Jouw AI heeft meer gegevens nodig om te groeien."}
            </h3>
            <p className="text-xs text-white/40 mt-1">
              {s.learned_qa_total > 0
                ? `De AI heeft al ${s.learned_qa_total} antwoorden geleerd uit gesprekken${s.learned_qa_this_week > 0 ? ` (${s.learned_qa_this_week} deze week)` : ""}.`
                : "De AI is nog bezig met leren. Hoe meer gesprekken, hoe slimmer."}
              {s.resolved_gaps > 0 && ` ${s.resolved_gaps} kennislacunes zijn opgelost.`}
            </p>
          </div>
          <div className="flex gap-4">
            <ScoreRing score={data.confidence.current} size={70} label="Zekerheid" />
            <div className="flex flex-col items-center justify-center">
              <TrendIcon className={`h-5 w-5 ${trendColor}`} />
              <span className={`text-xs font-bold ${trendColor}`}>
                {data.confidence.trend > 0 ? "+" : ""}{data.confidence.trend}%
              </span>
              <span className="text-[9px] text-white/30">{data.confidence.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Gesprekken (30d)", value: s.conversations_30d, icon: MessageSquare, color: "text-blue-400" },
          { label: "Kennisbronnen", value: s.total_knowledge_sources, icon: Database, color: "text-brand-400" },
          { label: "Geleerde antwoorden", value: s.learned_qa_total, icon: BookOpen, color: "text-emerald-400" },
          { label: "Escalatiepercentage", value: `${s.escalation_rate}%`, icon: ShieldAlert, color: s.escalation_rate > 15 ? "text-red-400" : "text-yellow-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-lg font-bold">{stat.value}</span>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* How it works info */}
      <div className="rounded-xl bg-brand-500/5 border border-brand-500/10 p-4">
        <h3 className="text-xs font-semibold text-brand-400 flex items-center gap-1.5 mb-2">
          <Zap className="h-3.5 w-3.5" /> Hoe werkt zelflerend AI?
        </h3>
        <div className="grid gap-3 sm:grid-cols-3 text-[11px] text-white/50">
          <div className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-[9px] font-bold text-brand-400">1</span>
            <span>Na elk gesprek analyseert de AI de vragen en antwoorden automatisch.</span>
          </div>
          <div className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-[9px] font-bold text-brand-400">2</span>
            <span>Goede antwoorden worden opgeslagen als kennis voor toekomstige gesprekken.</span>
          </div>
          <div className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-[9px] font-bold text-brand-400">3</span>
            <span>Onbeantwoorde vragen worden bijgehouden zodat wij ze kunnen oplossen.</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-0">
        {[
          { key: "learned" as const, label: "Geleerd", count: s.learned_qa_total, icon: BookOpen },
          { key: "gaps" as const, label: "Kennislacunes", count: s.open_gaps, icon: HelpCircle },
          { key: "resolved" as const, label: "Opgelost", count: s.resolved_gaps, icon: CheckCircle2 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-xs font-medium transition ${
              activeTab === tab.key
                ? "border-white/10 bg-white/[0.03] text-white"
                : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 text-[9px] font-bold ${
                tab.key === "gaps" ? "bg-red-500/20 text-red-400" : "bg-brand-500/20 text-brand-400"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl bg-white/[0.03] border border-white/5">
        {activeTab === "learned" && (
          <div className="divide-y divide-white/5">
            {data.learned_items.length === 0 ? (
              <div className="py-10 text-center text-xs text-white/30">
                De AI heeft nog geen antwoorden geleerd. Dit gebeurt automatisch na gesprekken.
              </div>
            ) : (
              data.learned_items.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
                  >
                    <BookOpen className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[9px] text-white/30 mt-0.5">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-400">Geleerd</span>
                    {expandedItem === item.id ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
                  </button>
                  {expandedItem === item.id && (
                    <div className="border-t border-white/5 bg-white/[0.01] px-4 py-3">
                      <p className="text-[11px] text-white/60 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "gaps" && (
          <div className="divide-y divide-white/5">
            {data.open_gaps.length === 0 ? (
              <div className="py-10 text-center text-xs text-white/30 space-y-1">
                <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-400" />
                <p>Geen openstaande kennislacunes — de AI kan alles beantwoorden!</p>
              </div>
            ) : (
              data.open_gaps.map((gap) => (
                <div key={gap.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${gap.escalated ? "text-red-400" : "text-yellow-400"}`} />
                    <div className="flex-1">
                      <p className="text-xs font-medium">{gap.question}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-white/40">
                          {CAT_LABELS[gap.category] || gap.category}
                        </span>
                        <span className="text-[9px] text-white/30">{gap.frequency}× gevraagd</span>
                        <span className="text-[9px] text-white/30">Zekerheid: {gap.avg_confidence}%</span>
                        {gap.escalated && (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] text-red-400">Geëscaleerd</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "resolved" && (
          <div className="divide-y divide-white/5">
            {data.resolved_items.length === 0 ? (
              <div className="py-10 text-center text-xs text-white/30">
                Nog geen opgeloste kennislacunes
              </div>
            ) : (
              data.resolved_items.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[9px] text-white/30 mt-0.5">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-400">Opgelost</span>
                    {expandedItem === item.id ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
                  </button>
                  {expandedItem === item.id && (
                    <div className="border-t border-white/5 bg-white/[0.01] px-4 py-3">
                      <p className="text-[11px] text-white/60 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
