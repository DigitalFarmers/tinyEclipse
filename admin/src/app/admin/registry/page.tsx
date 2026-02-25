"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Zap,
  Shield,
  Server,
  Brain,
  RefreshCw,
  Clock,
  ArrowLeftRight,
  Terminal,
  Globe,
  Filter,
  ChevronDown,
} from "lucide-react";
import {
  getTenants,
  getRegistryTimeline,
  getRegistryAnomalies,
  getRegistryStats,
} from "@/lib/api";

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  debug: { color: "text-gray-400", bg: "bg-gray-50", icon: Terminal },
  info: { color: "text-blue-600", bg: "bg-blue-50", icon: Info },
  success: { color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 },
  warning: { color: "text-amber-600", bg: "bg-amber-50", icon: AlertTriangle },
  error: { color: "text-red-600", bg: "bg-red-50", icon: XCircle },
  critical: { color: "text-red-800", bg: "bg-red-100", icon: Zap },
};

const DOMAIN_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  system: { label: "System", icon: Server, color: "text-gray-600" },
  security: { label: "Security", icon: Shield, color: "text-red-600" },
  sync: { label: "Sync", icon: ArrowLeftRight, color: "text-blue-600" },
  deploy: { label: "Deploy", icon: RefreshCw, color: "text-purple-600" },
  monitor: { label: "Monitor", icon: Activity, color: "text-green-600" },
  ai: { label: "AI", icon: Brain, color: "text-violet-600" },
  server: { label: "Server", icon: Server, color: "text-orange-600" },
  plugin: { label: "Plugin", icon: Terminal, color: "text-cyan-600" },
  api: { label: "API", icon: Globe, color: "text-indigo-600" },
};

export default function RegistryPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [timeline, setTimeline] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [domainFilter, setDomainFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [hoursFilter, setHoursFilter] = useState(168);

  useEffect(() => {
    getTenants().then((d: any) => {
      const list = d.tenants || d || [];
      setTenants(list);
    });
  }, []);

  useEffect(() => {
    load();
  }, [selectedTenant, domainFilter, severityFilter, hoursFilter]);

  async function load() {
    setLoading(true);
    const tid = selectedTenant || undefined;
    const [tl, an, st] = await Promise.all([
      getRegistryTimeline(tid, domainFilter || undefined, severityFilter || undefined, hoursFilter).catch(() => null),
      getRegistryAnomalies(tid).catch(() => null),
      getRegistryStats(tid, Math.min(hoursFilter, 24)).catch(() => null),
    ]);
    setTimeline(tl);
    setAnomalies(an?.anomalies || []);
    setStats(st);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Technical Registry
            </h1>
            <p className="text-sm text-gray-500">
              Alles wat er technisch gebeurt, in realtime
            </p>
          </div>
        </div>
        <select
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Alle sites</option>
          {tenants.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name || t.domain}
            </option>
          ))}
        </select>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <div className="text-2xl font-bold text-gray-900">
              {stats.total}
            </div>
            <div className="text-xs text-gray-500">Events (24u)</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-2xl font-bold text-red-600">
              {stats.errors}
            </div>
            <div className="text-xs text-gray-500">Fouten</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-600">
              {stats.warnings}
            </div>
            <div className="text-xs text-gray-500">Waarschuwingen</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-2xl font-bold text-violet-600">
              {anomalies.length}
            </div>
            <div className="text-xs text-gray-500">Anomalieën</div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Anomalieën gedetecteerd
          </h3>
          <div className="space-y-2">
            {anomalies.map((a: any, i: number) => (
              <div
                key={i}
                className="bg-white/80 rounded-lg p-3 border border-red-100"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      a.severity === "high"
                        ? "text-red-700 bg-red-100"
                        : "text-amber-700 bg-amber-100"
                    }`}
                  >
                    {a.severity}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {a.title}
                  </span>
                </div>
                {a.detail && (
                  <p className="text-xs text-gray-600 mt-1">{a.detail}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domain distribution */}
      {stats?.by_domain && Object.keys(stats.by_domain).length > 0 && (
        <div className="bg-white border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Events per domein (24u)
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.by_domain)
              .sort((a: any, b: any) => b[1] - a[1])
              .map(([dom, count]: any) => {
                const cfg = DOMAIN_CONFIG[dom] || DOMAIN_CONFIG.system;
                const Icon = cfg.icon;
                return (
                  <button
                    key={dom}
                    onClick={() =>
                      setDomainFilter(domainFilter === dom ? "" : dom)
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      domainFilter === dom
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${domainFilter === dom ? "text-white" : cfg.color}`} />
                    <span className="font-medium">{cfg.label}</span>
                    <span
                      className={`text-xs ${
                        domainFilter === dom
                          ? "text-gray-300"
                          : "text-gray-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Filter className="w-3.5 h-3.5" />
          Filters:
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-xs"
        >
          <option value="">Alle niveaus</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="success">Success</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <select
          value={hoursFilter}
          onChange={(e) => setHoursFilter(Number(e.target.value))}
          className="border rounded-lg px-2 py-1.5 text-xs"
        >
          <option value={24}>Laatste 24u</option>
          <option value={168}>Laatste 7 dagen</option>
          <option value={720}>Laatste 30 dagen</option>
        </select>
        {(domainFilter || severityFilter) && (
          <button
            onClick={() => {
              setDomainFilter("");
              setSeverityFilter("");
            }}
            className="text-xs text-violet-600 hover:text-violet-800"
          >
            Reset filters
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {timeline?.total || 0} events
        </span>
      </div>

      {/* Timeline */}
      <div className="bg-white border rounded-2xl">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : !timeline?.events?.length ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Geen events gevonden voor de huidige filters.
          </div>
        ) : (
          <div className="divide-y">
            {timeline.events.map((e: any) => {
              const sev = SEVERITY_CONFIG[e.severity] || SEVERITY_CONFIG.info;
              const dom = DOMAIN_CONFIG[e.domain] || DOMAIN_CONFIG.system;
              const SevIcon = sev.icon;
              const DomIcon = dom.icon;
              return (
                <div
                  key={e.id}
                  className="px-5 py-3 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Severity icon */}
                    <div
                      className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${sev.bg}`}
                    >
                      <SevIcon className={`w-3.5 h-3.5 ${sev.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {e.title}
                        </span>
                      </div>
                      {e.detail && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {e.detail}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          className={`text-[10px] flex items-center gap-1 ${dom.color}`}
                        >
                          <DomIcon className="w-2.5 h-2.5" />
                          {dom.label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {e.action}
                        </span>
                        {e.source && (
                          <span className="text-[10px] text-gray-400">
                            via {e.source}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {e.created_at
                          ? new Date(e.created_at).toLocaleDateString(
                              "nl-BE",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
