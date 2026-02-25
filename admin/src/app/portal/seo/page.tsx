"use client";

import { useEffect, useState } from "react";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Image,
  Globe,
  Link2,
  Shield,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SeoCheck {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  fix?: string | null;
  pages?: PageAudit[];
}

interface PageAudit {
  id: number;
  title: string;
  type: string;
  url: string;
  title_length: number;
  title_ok: boolean;
  meta_description: string;
  meta_length: number;
  meta_ok: boolean;
  word_count: number;
  content_ok: boolean;
}

interface SeoAudit {
  score: number;
  total: number;
  passed: number;
  checks: Record<string, SeoCheck>;
  seo_plugin: string | null;
  scanned_at: string;
}

export default function SeoConsolePage() {
  const [audit, setAudit] = useState<SeoAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [showPages, setShowPages] = useState(false);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchSeo(s.tenant_id);
  }, []);

  async function fetchSeo(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/seo/audit`);
      if (r.ok) {
        const d = await r.json();
        setAudit(d);
      }
    } catch {}
    setLoading(false);
  }

  const statusIcon = (s: string) => {
    if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (s === "warn") return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  const statusColor = (s: string) => {
    if (s === "pass") return "border-green-500/20 bg-green-500/5";
    if (s === "warn") return "border-yellow-500/20 bg-yellow-500/5";
    return "border-red-500/20 bg-red-500/5";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Search className="mb-3 h-10 w-10 text-white/15" />
        <p className="text-sm text-white/30">SEO audit niet beschikbaar. Zorg dat de TinyEclipse plugin actief is.</p>
      </div>
    );
  }

  const checks = Object.entries(audit.checks || {});
  const pages = checks.find(([k]) => k === "meta_descriptions")?.[1]?.pages || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">SEO Console</h1>
          <p className="mt-1 text-sm text-white/40">
            {audit.seo_plugin ? `${audit.seo_plugin} gedetecteerd` : "Geen SEO plugin"} · Laatst gescand: {new Date(audit.scanned_at).toLocaleString("nl-BE")}
          </p>
        </div>
        <button
          onClick={() => fetchSeo(tenantId)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Opnieuw scannen
        </button>
      </div>

      {/* Score Ring */}
      <div className="flex items-center gap-6 rounded-xl border border-white/5 bg-white/[0.02] p-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
            <circle
              cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${(audit.score / 100) * 264} 264`}
              className={audit.score >= 80 ? "text-green-400" : audit.score >= 50 ? "text-yellow-400" : "text-red-400"}
              stroke="currentColor"
            />
          </svg>
          <span className={`absolute text-2xl font-bold ${audit.score >= 80 ? "text-green-400" : audit.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
            {audit.score}
          </span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">SEO Score</h2>
          <p className="text-sm text-white/40">
            {audit.passed}/{audit.total} checks geslaagd
          </p>
          <p className="mt-1 text-xs text-white/25">
            {audit.score >= 80 ? "Uitstekend! Je site is goed geoptimaliseerd." :
             audit.score >= 50 ? "Redelijk. Er zijn verbeterpunten." :
             "Actie nodig. Meerdere SEO issues gevonden."}
          </p>
        </div>
      </div>

      {/* Checks */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white/60">SEO Checks</h2>
        {checks.map(([key, check]) => (
          <div
            key={key}
            className={`overflow-hidden rounded-xl border ${statusColor(check.status)} transition`}
          >
            <button
              onClick={() => setExpandedCheck(expandedCheck === key ? null : key)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              {statusIcon(check.status)}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-white">{check.label}</h3>
                <p className="mt-0.5 truncate text-xs text-white/40">{check.detail}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-white/20 transition ${expandedCheck === key ? "rotate-180" : ""}`} />
            </button>
            {expandedCheck === key && (
              <div className="border-t border-white/5 bg-white/[0.01] px-4 py-3">
                <p className="text-sm text-white/50">{check.detail}</p>
                {check.fix && (
                  <div className="mt-2 rounded-lg bg-brand-500/10 p-3">
                    <p className="text-xs font-medium text-brand-400">Aanbeveling:</p>
                    <p className="mt-0.5 text-xs text-white/50">{check.fix}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Page Audit Table */}
      {pages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/60">Pagina Audit</h2>
            <button
              onClick={() => setShowPages(!showPages)}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              {showPages ? "Verbergen" : `${pages.length} pagina's bekijken`}
            </button>
          </div>

          {showPages && (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-4 py-3 font-medium text-white/40">Pagina</th>
                    <th className="px-4 py-3 font-medium text-white/40">Titel</th>
                    <th className="px-4 py-3 font-medium text-white/40">Meta</th>
                    <th className="px-4 py-3 font-medium text-white/40">Woorden</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <a href={p.url} target="_blank" rel="noopener" className="flex items-center gap-1 text-white/70 hover:text-brand-400">
                          {p.title.slice(0, 30)}{p.title.length > 30 ? "..." : ""}
                          <ExternalLink className="h-3 w-3 opacity-40" />
                        </a>
                        <span className="text-[10px] text-white/20">{p.type}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 ${p.title_ok ? "text-green-400" : "text-yellow-400"}`}>
                          {p.title_ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {p.title_length} tekens
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {p.meta_description ? (
                          <span className={`inline-flex items-center gap-1 ${p.meta_ok ? "text-green-400" : "text-yellow-400"}`}>
                            {p.meta_ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {p.meta_length} tekens
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400">
                            <XCircle className="h-3 w-3" /> Ontbreekt
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={p.content_ok ? "text-green-400" : "text-yellow-400"}>
                          {p.word_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Links */}
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="/portal/seo/opengraph"
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">OpenGraph Manager</h3>
            <p className="text-xs text-white/30">Beheer hoe je pagina's eruitzien op social media</p>
          </div>
        </a>
        <a
          href="/portal/seo/links"
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Link Manager</h3>
            <p className="text-xs text-white/30">Broken links, redirects en interne linking</p>
          </div>
        </a>
      </div>
    </div>
  );
}
