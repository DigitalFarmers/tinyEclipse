"use client";

import { useEffect, useState } from "react";
import {
  Languages,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Search,
  Zap,
  Shield,
  TrendingUp,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LangVariant {
  lang: string;
  id: number | null;
  status: string;
  word_count: number;
  ratio: number;
}

interface ContentUnit {
  id: number;
  trid: number;
  title: string;
  type: string;
  url: string;
  word_count: number;
  languages: number;
  complete_count: number;
  variants: LangVariant[];
}

interface PerLanguage {
  name: string;
  is_default: boolean;
  total: number;
  complete: number;
  incomplete: number;
  missing: number;
  empty: number;
  stub: number;
  percentage: number;
  rating: string;
}

interface TranslationData {
  languages: {
    wpml_active: boolean;
    multilingual: boolean;
    language_count: number;
    default_language: string;
    languages: { code: string; name: string; english_name: string; is_default: boolean; flag_url?: string }[];
    analysis: string;
  };
  completeness: {
    active: boolean;
    overall_percentage: number;
    overall_rating: string;
    per_language: Record<string, PerLanguage>;
    total_content_units: number;
    recommendation: string;
  };
  seo: {
    per_language: Record<string, {
      language: string;
      total_pages: number;
      missing_meta: number;
      short_titles: number;
      thin_content: number;
      seo_score: number;
      rating: string;
    }>;
  };
}

interface IntelligenceScan {
  content: {
    wpml_grouped: boolean;
    total_content_units: number;
    total_wp_posts: number;
    total_variants: number;
    expected_variants: number;
    content_units: ContentUnit[];
    note: string;
  };
  rating: {
    overall_score: number;
    overall_rating: string;
    breakdown: Record<string, { score: number; weight: number; label: string }>;
  };
  scanned_at: string;
}

export default function TranslationsPage() {
  const [tenantId, setTenantId] = useState("");
  const [data, setData] = useState<TranslationData | null>(null);
  const [scan, setScan] = useState<IntelligenceScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [filterLang, setFilterLang] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      setTenantId(s.tenant_id);
      loadData(s.tenant_id);
    } catch {}
  }, []);

  async function loadData(tid: string) {
    setLoading(true);
    try {
      const [transRes, scanRes] = await Promise.all([
        fetch(`${API}/api/portal/data/${tid}/intelligence/translations`),
        fetch(`${API}/api/portal/data/${tid}/intelligence/scan`),
      ]);
      if (transRes.ok) setData(await transRes.json());
      if (scanRes.ok) setScan(await scanRes.json());
    } catch {}
    setLoading(false);
  }

  async function triggerDeepScan() {
    if (!tenantId) return;
    setScanning(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tenantId}/intelligence/deep-scan`, { method: "POST" });
      if (r.ok) {
        const result = await r.json();
        setScan(result);
        await loadData(tenantId);
      }
    } catch {}
    setScanning(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const langs = data?.languages;
  const completeness = data?.completeness;
  const seo = data?.seo;
  const content = scan?.content;

  // If no WPML
  if (langs && !langs.wpml_active) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Vertalingen</h1>
            <p className="text-sm text-white/40">Taal- en vertaalintelligentie</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
          <Globe className="mx-auto h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-lg font-semibold text-white">Eentalige website</h2>
          <p className="mt-2 text-sm text-white/40">
            Deze site is momenteel eentalig ({langs.default_language?.toUpperCase()}). Alle pagina&apos;s zijn in één taal.
          </p>
          <p className="mt-1 text-xs text-white/25">
            Wil je je website meertalig maken? Neem contact op met Digital Farmers.
          </p>
        </div>
      </div>
    );
  }

  // Filter content units
  const units = content?.content_units || [];
  const filtered = units.filter((u) => {
    if (search && !u.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === "complete" && u.complete_count < u.languages) return false;
    if (filterStatus === "incomplete" && u.complete_count >= u.languages) return false;
    if (filterStatus === "missing") {
      const hasMissing = u.variants.some((v) => v.status === "missing");
      if (!hasMissing) return false;
    }
    if (filterLang !== "all") {
      const variant = u.variants.find((v) => v.lang === filterLang);
      if (!variant || variant.status === "complete") return false;
    }
    return true;
  });

  const ratingColor = (rating: string) => {
    if (rating.startsWith("A")) return "text-green-400";
    if (rating.startsWith("B")) return "text-brand-400";
    if (rating === "C") return "text-yellow-400";
    return "text-red-400";
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      complete: { bg: "bg-green-500/10", text: "text-green-400", label: "Compleet" },
      incomplete: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Onvolledig" },
      stub: { bg: "bg-orange-500/10", text: "text-orange-400", label: "Stub" },
      empty: { bg: "bg-red-500/10", text: "text-red-400", label: "Leeg" },
      missing: { bg: "bg-red-500/10", text: "text-red-400", label: "Ontbreekt" },
    };
    const s = map[status] || map.missing;
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vertalingen</h1>
          <p className="text-sm text-white/40">
            Taaloverzicht — {langs?.language_count || 0} talen, {completeness?.total_content_units || 0} pagina&apos;s
          </p>
        </div>
        <button
          onClick={triggerDeepScan}
          disabled={scanning}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Analyseren..." : "Website Analyseren"}
        </button>
      </div>

      {/* Overall Rating + Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Overall Score */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Site Score</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${ratingColor(scan?.rating?.overall_rating || "F")}`}>
              {scan?.rating?.overall_rating || "—"}
            </span>
            <span className="text-sm text-white/30">{scan?.rating?.overall_score || 0}%</span>
          </div>
        </div>

        {/* Translation Completeness */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Languages className="h-4 w-4" />
            <span className="text-xs">Vertalingen</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${ratingColor(completeness?.overall_rating || "F")}`}>
              {completeness?.overall_percentage || 0}%
            </span>
            <span className="text-sm text-white/30">{completeness?.overall_rating}</span>
          </div>
        </div>

        {/* Content Units */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <FileText className="h-4 w-4" />
            <span className="text-xs">Unieke Pagina&apos;s</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{content?.total_content_units || 0}</span>
            {content?.wpml_grouped && content.total_wp_posts !== content.total_content_units && (
              <span className="text-xs text-white/25">
                ×{langs?.language_count || 1} talen
              </span>
            )}
          </div>
        </div>

        {/* Languages */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Globe className="h-4 w-4" />
            <span className="text-xs">Talen</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{langs?.language_count || 1}</span>
            <span className="text-xs text-white/25">
              {langs?.default_language?.toUpperCase()} = hoofd
            </span>
          </div>
        </div>
      </div>

      {/* WPML Note */}
      {content?.note && (
        <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-3">
          <div className="flex items-start gap-2">
            <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-400" />
            <p className="text-xs text-brand-300">{content.note}</p>
          </div>
        </div>
      )}

      {/* Language Analysis */}
      {langs?.analysis && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <p className="text-xs text-white/50">{langs.analysis}</p>
        </div>
      )}

      {/* Per-Language Breakdown */}
      {completeness?.per_language && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60">Vertaalstatus per taal</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(completeness.per_language).map(([code, lang]) => (
              <div key={code} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{lang.name}</span>
                    {lang.is_default && (
                      <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-[9px] font-bold text-brand-400">HOOFD</span>
                    )}
                  </div>
                  <span className={`text-lg font-bold ${ratingColor(lang.rating)}`}>{lang.rating}</span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      lang.percentage >= 90 ? "bg-green-500" : lang.percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${lang.percentage}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
                  <span>{lang.percentage}% compleet</span>
                  <span>{lang.complete}/{lang.total}</span>
                </div>

                {/* Breakdown */}
                {!lang.is_default && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                    {lang.missing > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle className="h-3 w-3" /> {lang.missing} ontbreekt
                      </span>
                    )}
                    {lang.stub > 0 && (
                      <span className="flex items-center gap-1 text-orange-400">
                        <AlertTriangle className="h-3 w-3" /> {lang.stub} stub
                      </span>
                    )}
                    {lang.incomplete > 0 && (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <AlertTriangle className="h-3 w-3" /> {lang.incomplete} onvolledig
                      </span>
                    )}
                    {lang.missing === 0 && lang.stub === 0 && lang.incomplete === 0 && (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Alles compleet
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEO per Language */}
      {seo?.per_language && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60">SEO per taal</h2>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[11px] text-white/30">
                  <th className="px-4 py-3">Taal</th>
                  <th className="px-4 py-3">Pagina&apos;s</th>
                  <th className="px-4 py-3">Meta ontbreekt</th>
                  <th className="px-4 py-3">Korte titels</th>
                  <th className="px-4 py-3">Dunne content</th>
                  <th className="px-4 py-3">SEO Score</th>
                  <th className="px-4 py-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(seo.per_language).map(([code, s]) => (
                  <tr key={code} className="border-b border-white/5 text-white/60">
                    <td className="px-4 py-3 font-medium text-white">{s.language}</td>
                    <td className="px-4 py-3">{s.total_pages}</td>
                    <td className="px-4 py-3">
                      <span className={s.missing_meta > 0 ? "text-red-400" : "text-green-400"}>{s.missing_meta}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.short_titles > 0 ? "text-yellow-400" : "text-green-400"}>{s.short_titles}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.thin_content > 0 ? "text-yellow-400" : "text-green-400"}>{s.thin_content}</span>
                    </td>
                    <td className="px-4 py-3">{s.seo_score}%</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${ratingColor(s.rating)}`}>{s.rating}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {completeness?.recommendation && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-400">Aanbevelingen</h3>
              <div className="mt-1 space-y-1 text-xs text-yellow-300/70">
                {completeness.recommendation.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Units Table */}
      {units.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-white/60">
              Pagina&apos;s & Vertalingen ({filtered.length}/{units.length})
            </h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                <input
                  type="text"
                  placeholder="Zoek pagina..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-white/20 focus:border-brand-500/50 focus:outline-none"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-brand-500/50 focus:outline-none"
              >
                <option value="all">Alle statussen</option>
                <option value="complete">Compleet</option>
                <option value="incomplete">Onvolledig</option>
                <option value="missing">Ontbrekend</option>
              </select>
              {langs && langs.languages.length > 1 && (
                <select
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-brand-500/50 focus:outline-none"
                >
                  <option value="all">Alle talen</option>
                  {langs.languages
                    .filter((l) => !l.is_default)
                    .map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {filtered.slice(0, 50).map((unit) => {
              const isExpanded = expandedUnit === unit.id;
              const allComplete = unit.complete_count === unit.languages;

              return (
                <div key={unit.id} className="rounded-lg border border-white/5 bg-white/[0.02]">
                  <button
                    onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-white/30" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-white/30" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">{unit.title}</span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/30">{unit.type}</span>
                      </div>
                      <span className="text-[10px] text-white/25">{unit.word_count} woorden</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Mini language dots */}
                      <div className="flex gap-1">
                        {unit.variants.map((v) => (
                          <div
                            key={v.lang}
                            title={`${v.lang.toUpperCase()}: ${v.status}`}
                            className={`h-2.5 w-2.5 rounded-full ${
                              v.status === "complete"
                                ? "bg-green-500"
                                : v.status === "incomplete"
                                ? "bg-yellow-500"
                                : v.status === "stub"
                                ? "bg-orange-500"
                                : "bg-red-500"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-medium ${allComplete ? "text-green-400" : "text-yellow-400"}`}>
                        {unit.complete_count}/{unit.languages}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/5 px-4 py-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {unit.variants.map((v) => (
                          <div
                            key={v.lang}
                            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase text-white/60">{v.lang}</span>
                              {statusBadge(v.status)}
                            </div>
                            <div className="text-right text-[10px] text-white/30">
                              {v.word_count > 0 && <span>{v.word_count}w</span>}
                              {v.ratio > 0 && v.ratio < 100 && <span className="ml-1">({v.ratio}%)</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <a
                        href={unit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-[10px] text-brand-400 hover:underline"
                      >
                        Bekijk pagina →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length > 50 && (
              <p className="py-2 text-center text-xs text-white/25">
                Toont 50 van {filtered.length} pagina&apos;s
              </p>
            )}
          </div>
        </div>
      )}

      {/* Rating Breakdown */}
      {scan?.rating?.breakdown && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60">Score Breakdown</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(scan.rating.breakdown).map(([key, b]) => (
              <div key={key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{b.label}</span>
                  <span className="text-[10px] text-white/20">gewicht: {b.weight}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${
                      b.score >= 80 ? "bg-green-500" : b.score >= 50 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${b.score}%` }}
                  />
                </div>
                <span className="mt-1 text-lg font-bold text-white">{b.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last scan info */}
      {scan?.scanned_at && (
        <p className="text-center text-[10px] text-white/15">
          Laatste scan: {new Date(scan.scanned_at).toLocaleString("nl-BE")}
        </p>
      )}
    </div>
  );
}
