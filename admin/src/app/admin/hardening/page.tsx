"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Zap,
  Server,
  Brain,
  Database,
  MessageSquare,
  Activity,
  TrendingUp,
  Users,
  RefreshCw,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import {
  getSecurityAudit,
  getResourceOverview,
  getOptimizationSuggestions,
} from "@/lib/api";

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-600 bg-emerald-50 border-emerald-200",
  A: "text-emerald-600 bg-emerald-50 border-emerald-200",
  B: "text-blue-600 bg-blue-50 border-blue-200",
  C: "text-amber-600 bg-amber-50 border-amber-200",
  D: "text-orange-600 bg-orange-50 border-orange-200",
  F: "text-red-600 bg-red-50 border-red-200",
};

const SEV_ICON: Record<string, any> = {
  error: XCircle,
  critical: Zap,
  warning: AlertTriangle,
  info: Info,
};

const SEV_COLOR: Record<string, string> = {
  error: "text-red-600 bg-red-50",
  critical: "text-red-800 bg-red-100",
  warning: "text-amber-600 bg-amber-50",
  info: "text-blue-600 bg-blue-50",
};

const PRIO_COLOR: Record<string, string> = {
  high: "text-red-700 bg-red-50",
  medium: "text-amber-700 bg-amber-50",
  low: "text-emerald-700 bg-emerald-50",
};

export default function HardeningPage() {
  const [audit, setAudit] = useState<any>(null);
  const [resources, setResources] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"audit" | "resources" | "optimize">("audit");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [a, r, s] = await Promise.all([
      getSecurityAudit().catch(() => null),
      getResourceOverview().catch(() => null),
      getOptimizationSuggestions().catch(() => null),
    ]);
    setAudit(a);
    setResources(r);
    setSuggestions(s?.suggestions || []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Server Hardening
            </h1>
            <p className="text-sm text-gray-500">
              Security audit, resources & optimalisatie
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Laden..." : "Hercontroleren"}
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">
          Security audit uitvoeren...
        </div>
      )}

      {!loading && (
        <>
          {/* Score banner */}
          {audit && (
            <div className="bg-white border rounded-2xl p-6">
              <div className="flex items-center gap-8">
                {/* Score ring */}
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={audit.score >= 70 ? "#10b981" : audit.score >= 40 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(audit.score / 100) * 327} 327`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{audit.score}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Security</span>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-lg font-bold px-2 py-0.5 rounded border ${GRADE_COLORS[audit.grade] || ""}`}>
                      {audit.grade}
                    </span>
                    <span className="text-sm text-gray-500">
                      Platform Security Score
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {audit.score >= 80
                      ? "Het platform is goed beveiligd. Blijf alert op nieuwe bevindingen."
                      : audit.score >= 60
                      ? "Er zijn enkele aandachtspunten gevonden die aandacht verdienen."
                      : "Er zijn kritieke bevindingen die direct actie vereisen."}
                  </p>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3 text-center flex-shrink-0">
                  <div className="bg-red-50 rounded-lg px-4 py-2">
                    <div className="text-lg font-bold text-red-600">{audit.summary.critical}</div>
                    <div className="text-[10px] text-gray-500">Kritiek</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg px-4 py-2">
                    <div className="text-lg font-bold text-amber-600">{audit.summary.warnings}</div>
                    <div className="text-[10px] text-gray-500">Warnings</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-4 py-2">
                    <div className="text-lg font-bold text-blue-600">{audit.summary.info}</div>
                    <div className="text-[10px] text-gray-500">Info</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg px-4 py-2">
                    <div className="text-lg font-bold text-emerald-600">{audit.summary.passed}</div>
                    <div className="text-[10px] text-gray-500">Passed</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: "audit", label: "Security Audit", icon: Shield },
              { key: "resources", label: "Resources", icon: Server },
              { key: "optimize", label: "Optimalisatie", icon: Lightbulb },
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

          {/* Tab: Security Audit */}
          {tab === "audit" && audit && (
            <div className="bg-white border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Bevindingen ({audit.findings.length})
              </h3>
              {audit.findings.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Geen bevindingen — alles ziet er goed uit!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {audit.findings.map((f: any, i: number) => {
                    const Icon = SEV_ICON[f.severity] || Info;
                    const color = SEV_COLOR[f.severity] || SEV_COLOR.info;
                    return (
                      <div key={i} className="border rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${color.split(" ")[1]}`}>
                            <Icon className={`w-4 h-4 ${color.split(" ")[0]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{f.title}</span>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                {f.category}
                              </span>
                            </div>
                            {f.tenant_name && (
                              <span className="text-[10px] text-gray-400">{f.tenant_name}</span>
                            )}
                            <p className="text-xs text-gray-600 mt-1">{f.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Resources */}
          {tab === "resources" && resources && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Actieve sites" value={resources.active_tenants} color="text-violet-600" />
                <StatCard icon={MessageSquare} label="Gesprekken (24u)" value={resources.conversations_today} color="text-blue-600" />
                <StatCard icon={MessageSquare} label="Gesprekken (7d)" value={resources.conversations_week} color="text-blue-600" />
                <StatCard icon={Activity} label="Berichten (24u)" value={resources.messages_today} color="text-emerald-600" />
                <StatCard icon={Database} label="Kennisbronnen" value={resources.total_sources} color="text-cyan-600" />
                <StatCard icon={Brain} label="Open gaps" value={resources.open_gaps} color="text-amber-600" />
                <StatCard icon={Zap} label="Events (24u)" value={resources.events_today} color="text-purple-600" />
              </div>

              {resources.top_tenants?.length > 0 && (
                <div className="bg-white border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Top verbruikers (7 dagen)
                  </h3>
                  <div className="space-y-2">
                    {resources.top_tenants.map((t: any) => (
                      <div key={t.tenant_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{t.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{t.domain}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-violet-600">{t.conversations_7d}</span>
                          <span className="text-[10px] text-gray-400 ml-1">gesprekken</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Optimization */}
          {tab === "optimize" && (
            <div className="bg-white border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Optimalisatiesuggesties ({suggestions.length})
              </h3>
              {suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Geen optimalisaties nodig — het platform draait optimaal!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s: any, i: number) => (
                    <div key={i} className="border rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded mt-0.5 ${PRIO_COLOR[s.priority] || ""}`}>
                          {s.priority}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{s.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{s.category}</span>
                            {s.tenant_name && <span className="text-[10px] text-gray-400">{s.tenant_name}</span>}
                          </div>
                          <p className="text-xs text-gray-600 mt-1.5">{s.action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
