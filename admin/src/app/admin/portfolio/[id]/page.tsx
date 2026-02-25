"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Globe, MessageSquare, Eye, Database, UserPlus, Activity,
  Heart, AlertTriangle, ChevronLeft, TrendingUp, TrendingDown,
  Minus, Shield, Zap, ArrowLeftRight, Brain, Clock, Package,
  BarChart3, Lightbulb, GitCompare, Rocket, RefreshCw, Send,
  CheckCircle, Copy,
} from "lucide-react";
import {
  getClientPortfolio, getDomainComparison, getUnifiedTimeline,
  getBulkActions, triggerBulkReindex, triggerBulkCommand,
  triggerKnowledgeTransfer, triggerBulkGapResolve,
} from "@/lib/api";

function HealthRing({ score }: { score: number }) {
  const r = 36, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#facc15" : score >= 40 ? "#fb923c" : "#ef4444";
  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold" style={{ color }}>{grade}</span>
        <span className="text-[10px] text-white/30">{score}</span>
      </div>
    </div>
  );
}

function GrowthBadge({ pct }: { pct: number }) {
  if (pct > 5) return <span className="flex items-center gap-0.5 text-xs text-green-400"><TrendingUp className="h-3 w-3" /> +{pct}%</span>;
  if (pct < -5) return <span className="flex items-center gap-0.5 text-xs text-red-400"><TrendingDown className="h-3 w-3" /> {pct}%</span>;
  return <span className="flex items-center gap-0.5 text-xs text-white/30"><Minus className="h-3 w-3" /> stabiel</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const c = severity === "error" || severity === "critical" ? "bg-red-500/10 text-red-400" :
            severity === "warning" ? "bg-yellow-500/10 text-yellow-400" :
            severity === "success" ? "bg-green-500/10 text-green-400" :
            "bg-white/5 text-white/40";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c}`}>{severity}</span>;
}

function ImpactBadge({ impact }: { impact: string }) {
  const c = impact === "high" ? "bg-red-500/10 text-red-400" : impact === "medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-white/5 text-white/40";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${c}`}>{impact}</span>;
}

export default function ClientPortfolioPage() {
  const params = useParams();
  const id = params.id as string;

  const [portfolio, setPortfolio] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [bulkActions, setBulkActions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "compare" | "timeline" | "knowledge" | "actions">("overview");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getClientPortfolio(id),
      getDomainComparison(id).catch(() => null),
      getUnifiedTimeline(id).catch(() => null),
      getBulkActions(id).catch(() => null),
    ])
      .then(([p, c, t, b]) => { setPortfolio(p); setComparison(c); setTimeline(t); setBulkActions(b); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
      </div>
    );
  }

  if (!portfolio || portfolio.error) {
    return <p className="text-white/50">{portfolio?.error || "Client niet gevonden."}</p>;
  }

  const { account, domains, knowledge_sharing, recent_events } = portfolio;

  const tabs = [
    { key: "overview", label: "Overzicht", icon: BarChart3 },
    { key: "compare", label: "Vergelijken", icon: GitCompare },
    { key: "timeline", label: "Timeline", icon: Clock },
    { key: "knowledge", label: "Kennisdeling", icon: Brain },
    { key: "actions", label: "Bulk Actions", icon: Rocket },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/portfolio" className="rounded-lg p-2 text-white/30 transition hover:bg-white/5 hover:text-white">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
              {account.name}
            </span>
          </h1>
          <p className="text-sm text-white/40">
            {portfolio.domain_count} productie-domein{portfolio.domain_count !== 1 ? "en" : ""}
            {portfolio.staging_count > 0 && ` · ${portfolio.staging_count} staging`}
            {account.company && ` · ${account.company}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-brand-500/10 text-white" : "text-white/40 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab domains={domains} />}
      {tab === "compare" && <CompareTab comparison={comparison} />}
      {tab === "timeline" && <TimelineTab timeline={timeline} />}
      {tab === "knowledge" && <KnowledgeTab sharing={knowledge_sharing} />}
      {tab === "actions" && <ActionsTab clientAccountId={id} bulkActions={bulkActions} />}
    </div>
  );
}

function OverviewTab({ domains }: { domains: any[] }) {
  return (
    <div className="space-y-4">
      {domains.map((d: any) => (
        <div key={d.tenant_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <HealthRing score={d.health_score} />
              <div>
                <h3 className="text-lg font-semibold">{d.domain || d.name}</h3>
                <p className="text-xs text-white/40">
                  {d.plan.toUpperCase()} · {d.status}
                  {d.technical.connector_version && ` · Connector v${d.technical.connector_version}`}
                </p>
              </div>
            </div>
            <GrowthBadge pct={d.traffic.growth_pct} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <Metric label="Sessies 30d" value={d.traffic.sessions_30d.toLocaleString()} sub={`${d.traffic.sessions_7d} deze week`} />
            <Metric label="Gesprekken 30d" value={d.ai.conversations_30d} sub={`${d.ai.conversations_7d} deze week`} />
            <Metric label="AI Confidence" value={`${d.ai.avg_confidence}%`} sub={`${d.ai.sources} bronnen`} />
            <Metric label="Leads" value={d.business.leads} sub={`${d.business.orders_30d} orders`} />
            <Metric label="Open Gaps" value={d.ai.open_gaps} sub={`${d.ai.resolved_gaps} opgelost`} alert={d.ai.open_gaps > 3} />
            <Metric label="Responstijd" value={d.technical.response_ms ? `${d.technical.response_ms}ms` : "—"} sub={d.technical.uptime_status} />
          </div>

          {d.technical.languages && d.technical.languages.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Globe className="h-3 w-3 text-white/25" />
              <div className="flex gap-1">
                {d.technical.languages.map((lang: any) => (
                  <span key={typeof lang === 'string' ? lang : lang.code} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                    {typeof lang === 'string' ? lang.toUpperCase() : lang.code?.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, sub, alert }: { label: string; value: any; sub?: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/25">{label}</p>
      <p className={`text-lg font-bold ${alert ? "text-yellow-400" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

function CompareTab({ comparison }: { comparison: any }) {
  if (!comparison || comparison.error) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
        <GitCompare className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-sm text-white/40">{comparison?.error || "Minstens 2 productie-domeinen nodig."}</p>
      </div>
    );
  }

  const { domains, winners } = comparison;
  const metrics = [
    { key: "sessions_30d", label: "Sessies 30d", icon: Eye },
    { key: "conversations_30d", label: "Gesprekken 30d", icon: MessageSquare },
    { key: "sources", label: "Bronnen", icon: Database },
    { key: "embeddings", label: "Embeddings", icon: Package },
    { key: "leads", label: "Leads", icon: UserPlus },
    { key: "contacts", label: "Contacten", icon: UserPlus },
    { key: "open_gaps", label: "Open Gaps", icon: AlertTriangle },
    { key: "avg_confidence", label: "AI Confidence %", icon: Brain },
    { key: "response_ms", label: "Responstijd (ms)", icon: Activity },
    { key: "health_score", label: "Health Score", icon: Heart },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-white/30">Metric</th>
            {domains.map((d: any) => (
              <th key={d.tenant_id} className="px-4 py-3 text-center text-xs font-medium uppercase text-white/30">
                {d.domain || d.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {metrics.map((m) => (
            <tr key={m.key} className="hover:bg-white/[0.02]">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2 text-white/50">
                  <m.icon className="h-3.5 w-3.5" /> {m.label}
                </div>
              </td>
              {domains.map((d: any) => {
                const isWinner = winners[m.key] === d.tenant_id;
                const val = d[m.key];
                // For open_gaps, lower is better
                const isGapMetric = m.key === "open_gaps" || m.key === "response_ms";
                return (
                  <td key={d.tenant_id} className={`px-4 py-2.5 text-center font-semibold ${
                    isWinner && !isGapMetric ? "text-green-400" :
                    isWinner && isGapMetric ? "text-green-400" :
                    ""
                  }`}>
                    {val !== null && val !== undefined ? (
                      typeof val === 'number' ? val.toLocaleString() : val
                    ) : "—"}
                    {isWinner && <span className="ml-1 text-[10px]">🏆</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineTab({ timeline }: { timeline: any }) {
  if (!timeline || !timeline.events?.length) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
        <Clock className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-sm text-white/40">Geen events in de afgelopen 7 dagen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/30">{timeline.total} events totaal (laatste 7 dagen)</p>
      {timeline.events.map((e: any) => (
        <div key={e.id} className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <SeverityBadge severity={e.severity} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-brand-400">{e.tenant_name}</span>
              <span className="text-[10px] text-white/20">{e.domain}</span>
            </div>
            <p className="text-sm text-white/70">{e.title}</p>
            {e.detail && <p className="mt-0.5 text-xs text-white/30 truncate">{e.detail}</p>}
          </div>
          <span className="whitespace-nowrap text-[10px] text-white/20">
            {e.created_at ? new Date(e.created_at).toLocaleString("nl-BE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActionsTab({ clientAccountId, bulkActions }: { clientAccountId: string; bulkActions: any }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedCmd, setSelectedCmd] = useState("deep_scan");
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [gapCategory, setGapCategory] = useState("");
  const [gapAnswer, setGapAnswer] = useState("");

  if (!bulkActions || bulkActions.error) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
        <Rocket className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-sm text-white/40">{bulkActions?.error || "Geen bulk acties beschikbaar."}</p>
      </div>
    );
  }

  const { domains, actions } = bulkActions;
  const cmdAction = actions.find((a: any) => a.action === "bulk_command");
  const transferAction = actions.find((a: any) => a.action === "knowledge_transfer");
  const gapAction = actions.find((a: any) => a.action === "bulk_gap_resolve");

  const handleReindex = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await triggerBulkReindex(clientAccountId);
      setResult({ type: "success", data: r });
    } catch (e: any) { setResult({ type: "error", message: e.message }); }
    setBusy(false);
  };

  const handleCommand = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await triggerBulkCommand(clientAccountId, selectedCmd);
      setResult({ type: "success", data: r });
    } catch (e: any) { setResult({ type: "error", message: e.message }); }
    setBusy(false);
  };

  const handleTransfer = async () => {
    if (!transferFrom || !transferTo) return;
    setBusy(true); setResult(null);
    try {
      const r = await triggerKnowledgeTransfer(transferFrom, transferTo);
      setResult({ type: "success", data: r });
    } catch (e: any) { setResult({ type: "error", message: e.message }); }
    setBusy(false);
  };

  const handleGapResolve = async () => {
    if (!gapCategory || !gapAnswer.trim()) return;
    setBusy(true); setResult(null);
    try {
      const r = await triggerBulkGapResolve(clientAccountId, gapCategory, gapAnswer);
      setResult({ type: "success", data: r });
    } catch (e: any) { setResult({ type: "error", message: e.message }); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {/* Result banner */}
      {result && (
        <div className={`rounded-xl border p-4 ${result.type === "success" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
          <div className="flex items-center gap-2">
            {result.type === "success" ? <CheckCircle className="h-4 w-4 text-green-400" /> : <AlertTriangle className="h-4 w-4 text-red-400" />}
            <span className={`text-sm font-medium ${result.type === "success" ? "text-green-400" : "text-red-400"}`}>
              {result.type === "success" ? `${result.data.action}: ${result.data.domains_affected || result.data.copied || result.data.gaps_resolved || 0} verwerkt` : result.message}
            </span>
          </div>
        </div>
      )}

      {/* 1. Bulk Reindex */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <RefreshCw className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold">Alle bronnen herindexeren</h4>
              <p className="text-xs text-white/40">{actions.find((a: any) => a.action === "bulk_reindex")?.description}</p>
            </div>
          </div>
          <button
            onClick={handleReindex}
            disabled={busy}
            className="rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
          >
            {busy ? "Bezig..." : "Reindex All"}
          </button>
        </div>
      </div>

      {/* 2. Bulk Command */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <Send className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">Command naar alle sites</h4>
            <p className="text-xs text-white/40">Stuur een commando naar {domains?.length || 0} WordPress sites tegelijk</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <select
            value={selectedCmd}
            onChange={(e) => setSelectedCmd(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            {(cmdAction?.context?.allowed_commands || []).map((cmd: string) => (
              <option key={cmd} value={cmd} className="bg-brand-950">{cmd.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button
            onClick={handleCommand}
            disabled={busy}
            className="rounded-lg bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-400 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {busy ? "Bezig..." : "Verstuur"}
          </button>
        </div>
      </div>

      {/* 3. Knowledge Transfer */}
      {transferAction?.available && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Copy className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h4 className="font-semibold">Kennis transfereren</h4>
              <p className="text-xs text-white/40">Kopieer bronnen van het ene domein naar het andere</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-white/30">Van</label>
              <select
                value={transferFrom}
                onChange={(e) => setTransferFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="" className="bg-brand-950">Kies domein...</option>
                {(transferAction.context?.domains || []).map((d: any) => (
                  <option key={d.name} value={domains?.find((dom: any) => dom.domain === d.domain)?.tenant_id || ""} className="bg-brand-950">
                    {d.domain || d.name} ({d.sources} bronnen)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-white/30">Naar</label>
              <select
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="" className="bg-brand-950">Kies domein...</option>
                {(transferAction.context?.domains || []).map((d: any) => (
                  <option key={d.name} value={domains?.find((dom: any) => dom.domain === d.domain)?.tenant_id || ""} className="bg-brand-950">
                    {d.domain || d.name} ({d.sources} bronnen)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleTransfer}
              disabled={busy || !transferFrom || !transferTo || transferFrom === transferTo}
              className="rounded-lg bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition hover:bg-green-500/20 disabled:opacity-50"
            >
              {busy ? "Bezig..." : "Transfer starten"}
            </button>
          </div>
        </div>
      )}

      {/* 4. Bulk Gap Resolve */}
      {gapAction?.available && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <Brain className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h4 className="font-semibold">Gaps bulk-oplossen</h4>
              <p className="text-xs text-white/40">Los kennislacunes op over alle domeinen tegelijk</p>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[10px] uppercase text-white/30">Categorie</label>
              <select
                value={gapCategory}
                onChange={(e) => setGapCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="" className="bg-brand-950">Kies categorie...</option>
                {Object.entries(gapAction.context?.categories || {}).map(([cat, count]: [string, any]) => (
                  <option key={cat} value={cat} className="bg-brand-950">{cat} ({count} gaps)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-white/30">Antwoord (wordt als kennis toegevoegd)</label>
              <textarea
                value={gapAnswer}
                onChange={(e) => setGapAnswer(e.target.value)}
                rows={3}
                placeholder="Typ het antwoord dat op alle domeinen als kennis wordt toegevoegd..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleGapResolve}
                disabled={busy || !gapCategory || !gapAnswer.trim()}
                className="rounded-lg bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400 transition hover:bg-yellow-500/20 disabled:opacity-50"
              >
                {busy ? "Bezig..." : "Alle gaps oplossen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeTab({ sharing }: { sharing: any[] }) {
  if (!sharing || sharing.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
        <Brain className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-sm text-white/40">Geen kennisdelingsopportuniteiten gevonden.</p>
        <p className="mt-1 text-xs text-white/20">Dit betekent dat de kennis gelijk verdeeld is — goed bezig!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/30">{sharing.length} opportuniteit{sharing.length !== 1 ? "en" : ""} gevonden</p>
      {sharing.map((opp: any, i: number) => (
        <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 text-yellow-400" />
              <div>
                <h4 className="text-sm font-semibold">{opp.title}</h4>
                <p className="mt-1 text-xs text-white/40">{opp.description}</p>
              </div>
            </div>
            <ImpactBadge impact={opp.impact} />
          </div>
          {opp.type === "knowledge_imbalance" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-white/30">
              <ArrowLeftRight className="h-3 w-3" />
              {opp.from_domain} → {opp.to_domain}
            </div>
          )}
          {opp.affected_domains && (
            <div className="mt-2 flex gap-1">
              {opp.affected_domains.map((d: string) => (
                <span key={d} className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{d}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
