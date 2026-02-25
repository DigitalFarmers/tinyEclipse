"use client";

import { useEffect, useState } from "react";
import { getTenants, apiFetch } from "@/lib/api";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Brain,
  ShieldAlert,
  Wheat,
  Scale,
  Image as ImageIcon,
  FileText,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface ProductAnalysis {
  id: number;
  name: string;
  sku: string;
  price: string;
  stock_status: string;
  image: string;
  permalink: string;
  categories: string[];
  has_description: boolean;
  has_short_description: boolean;
  has_ingredients: boolean;
  has_nutrition: boolean;
  has_allergens: boolean;
  has_weight: boolean;
  has_images: boolean;
  has_price: boolean;
  has_sku: boolean;
  has_categories: boolean;
  ingredients_text: string;
  allergens_found: string[];
  weight_info: string;
  description_length: number;
  description_word_count: number;
  completeness_score: number;
  quality_grade: string;
  issues: string[];
  suggestions: string[];
}

interface Summary {
  total_products: number;
  with_ingredients: number;
  without_ingredients: number;
  ingredients_pct: number;
  with_allergens: number;
  with_nutrition: number;
  with_weight: number;
  with_images: number;
  with_description: number;
  avg_completeness: number;
  grade_distribution: Record<string, number>;
  ai_readiness_score: number;
  category_breakdown: Record<string, { total: number; with_ingredients: number; avg_score: number; completeness_pct: number }>;
  allergens_overview: Record<string, number>;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400 bg-emerald-500/10",
  A: "text-emerald-400 bg-emerald-500/10",
  B: "text-blue-400 bg-blue-500/10",
  C: "text-yellow-400 bg-yellow-500/10",
  D: "text-orange-400 bg-orange-500/10",
  F: "text-red-400 bg-red-500/10",
};

function ScoreRing({ score, size = 120, label }: { score: number; size?: number; label: string }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          className="rotate-90 origin-center" fill="white" fontSize={size * 0.28} fontWeight="bold">
          {score}
        </text>
      </svg>
      <span className="text-xs text-white/40 font-medium">{label}</span>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = "text-brand-400" }: {
  label: string; value: string | number; sub?: string; icon: any; color?: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-[11px] text-white/40">{label}</p>
          {sub && <p className="text-[10px] text-white/30">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ProductIntelligencePage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ products: ProductAnalysis[]; summary: Summary } | null>(null);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterIngredients, setFilterIngredients] = useState<"all" | "with" | "without">("all");
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "name" | "grade">("score");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    getTenants().then((ts) => {
      setTenants(ts);
      if (ts.length > 0) setSelectedTenant(ts[0].id);
    }).catch(() => {});
  }, []);

  const analyze = async () => {
    if (!selectedTenant) return;
    setLoading(true);
    setData(null);
    try {
      const result = await apiFetch(`/api/admin/product-intelligence/${selectedTenant}`);
      setData(result);
    } catch (e: any) {
      alert(e.message || "Analyse mislukt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTenant) analyze();
  }, [selectedTenant]);

  const filtered = data?.products
    ?.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGrade !== "all" && p.quality_grade !== filterGrade) return false;
      if (filterIngredients === "with" && !p.has_ingredients) return false;
      if (filterIngredients === "without" && p.has_ingredients) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortBy === "score") return (a.completeness_score - b.completeness_score) * dir;
      if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
      return a.quality_grade.localeCompare(b.quality_grade) * dir;
    }) || [];

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Intelligence</h1>
          <p className="text-sm text-white/40">Ingrediënten, allergenen & compleetheid van elk product</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id} className="bg-brand-950">{t.domain || t.name}</option>
            ))}
          </select>
          <button
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Analyseert..." : "Analyseer"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <p className="mt-4 text-sm text-white/40">Producten ophalen & analyseren...</p>
        </div>
      )}

      {s && !loading && (
        <>
          {/* Score Rings */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 p-6">
              <ScoreRing score={s.ai_readiness_score} size={140} label="AI Readiness" />
            </div>
            <div className="flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 p-6">
              <ScoreRing score={Math.round(s.avg_completeness)} size={140} label="Gem. Compleetheid" />
            </div>
            <div className="flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 p-6">
              <ScoreRing score={Math.round(s.ingredients_pct)} size={140} label="Ingrediënten Dekking" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Package} label="Producten" value={s.total_products} />
            <StatCard icon={Wheat} label="Met ingrediënten" value={s.with_ingredients} color="text-emerald-400" sub={`${s.ingredients_pct}%`} />
            <StatCard icon={XCircle} label="Zonder ingrediënten" value={s.without_ingredients} color="text-red-400" />
            <StatCard icon={ShieldAlert} label="Met allergenen" value={s.with_allergens} color="text-yellow-400" />
            <StatCard icon={FileText} label="Met beschrijving" value={s.with_description} color="text-blue-400" />
            <StatCard icon={ImageIcon} label="Met afbeelding" value={s.with_images} color="text-purple-400" />
          </div>

          {/* Allergens Overview */}
          {Object.keys(s.allergens_overview).length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-5">
              <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-yellow-400" />
                Allergenen Overzicht
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(s.allergens_overview).map(([allergen, count]) => (
                  <span key={allergen} className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                    {allergen}
                    <span className="rounded-full bg-yellow-500/20 px-1.5 text-[10px]">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {Object.keys(s.category_breakdown).length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-5">
              <h3 className="mb-3 text-sm font-semibold">Categorie Overzicht</h3>
              <div className="space-y-2">
                {Object.entries(s.category_breakdown)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([cat, info]) => (
                    <div key={cat} className="flex items-center gap-3 text-sm">
                      <span className="w-40 truncate text-white/60">{cat}</span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all"
                            style={{ width: `${info.completeness_pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-16 text-right text-white/40 text-xs">
                        {info.with_ingredients}/{info.total}
                      </span>
                      <span className="w-12 text-right text-xs font-medium">{info.avg_score}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Grade Distribution */}
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-5">
            <h3 className="mb-3 text-sm font-semibold">Kwaliteitsverdeling</h3>
            <div className="flex gap-3 flex-wrap">
              {["A+", "A", "B", "C", "D", "F"].map((grade) => {
                const count = s.grade_distribution[grade] || 0;
                const pct = s.total_products > 0 ? Math.round((count / s.total_products) * 100) : 0;
                return (
                  <button
                    key={grade}
                    onClick={() => setFilterGrade(filterGrade === grade ? "all" : grade)}
                    className={`flex flex-col items-center rounded-lg border px-4 py-3 transition ${
                      filterGrade === grade ? "border-brand-500 bg-brand-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <span className={`text-lg font-bold ${GRADE_COLORS[grade]?.split(" ")[0] || "text-white"}`}>{grade}</span>
                    <span className="text-xl font-bold">{count}</span>
                    <span className="text-[10px] text-white/30">{pct}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product List */}
          <div className="rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Zoek product of SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/30"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterIngredients}
                  onChange={(e) => setFilterIngredients(e.target.value as any)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                >
                  <option value="all" className="bg-brand-950">Alle producten</option>
                  <option value="with" className="bg-brand-950">Met ingrediënten</option>
                  <option value="without" className="bg-brand-950">Zonder ingrediënten</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                >
                  <option value="score" className="bg-brand-950">Score</option>
                  <option value="name" className="bg-brand-950">Naam</option>
                  <option value="grade" className="bg-brand-950">Grade</option>
                </select>
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white"
                >
                  {sortAsc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="p-2 text-xs text-white/30 px-4">
              {filtered.length} producten gevonden
            </div>

            <div className="divide-y divide-white/5">
              {filtered.map((p) => (
                <div key={p.id} className="group">
                  <button
                    onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-white/[0.02]"
                  >
                    {p.image ? (
                      <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover bg-white/5" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                        <Package className="h-4 w-4 text-white/20" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.sku && <span className="text-[10px] text-white/30">SKU: {p.sku}</span>}
                        {p.categories.length > 0 && (
                          <span className="text-[10px] text-white/20">{p.categories[0]}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.has_ingredients ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ingrediënten
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> Ingrediënten
                        </span>
                      )}
                      {p.has_allergens && (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                          <ShieldAlert className="h-3.5 w-3.5" /> {p.allergens_found.length}
                        </span>
                      )}
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${GRADE_COLORS[p.quality_grade] || "text-white/40 bg-white/5"}`}>
                        {p.quality_grade}
                      </span>
                      <div className="w-16">
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              p.completeness_score >= 80 ? "bg-emerald-500" :
                              p.completeness_score >= 60 ? "bg-blue-500" :
                              p.completeness_score >= 40 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${p.completeness_score}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-8 text-right text-xs text-white/40">{p.completeness_score}%</span>
                      {expandedProduct === p.id ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                    </div>
                  </button>

                  {expandedProduct === p.id && (
                    <div className="border-t border-white/5 bg-white/[0.01] px-4 py-4 space-y-4">
                      {/* Checklist */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[
                          { label: "Beschrijving", ok: p.has_description, icon: FileText },
                          { label: "Ingrediënten", ok: p.has_ingredients, icon: Wheat },
                          { label: "Allergenen", ok: p.has_allergens, icon: ShieldAlert },
                          { label: "Voedingswaarde", ok: p.has_nutrition, icon: Scale },
                          { label: "Gewicht", ok: p.has_weight, icon: Scale },
                          { label: "Afbeelding", ok: p.has_images, icon: ImageIcon },
                          { label: "Prijs", ok: p.has_price, icon: Package },
                          { label: "SKU", ok: p.has_sku, icon: Package },
                          { label: "Categorie", ok: p.has_categories, icon: Filter },
                          { label: "Korte beschr.", ok: p.has_short_description, icon: FileText },
                        ].map((item) => (
                          <div key={item.label} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                            item.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {item.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                            {item.label}
                          </div>
                        ))}
                      </div>

                      {/* Ingredients text */}
                      {p.ingredients_text && (
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                          <p className="text-[10px] font-semibold text-emerald-400 mb-1">INGREDIËNTEN</p>
                          <p className="text-xs text-white/70">{p.ingredients_text}</p>
                        </div>
                      )}

                      {/* Allergens */}
                      {p.allergens_found.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-yellow-400 mb-1">ALLERGENEN</p>
                          <div className="flex flex-wrap gap-1">
                            {p.allergens_found.map((a) => (
                              <span key={a} className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-300">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Issues & Suggestions */}
                      {p.issues.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-semibold text-red-400 mb-1">PROBLEMEN</p>
                            <ul className="space-y-1">
                              {p.issues.map((issue, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-red-300/80">
                                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-brand-400 mb-1">SUGGESTIES</p>
                            <ul className="space-y-1">
                              {p.suggestions.map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-white/50">
                                  <Brain className="h-3 w-3 mt-0.5 shrink-0 text-brand-400" />{s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-[10px] text-white/30 pt-2 border-t border-white/5">
                        <span>Beschrijving: {p.description_word_count} woorden</span>
                        <span>Prijs: {p.price ? `€${p.price}` : "—"}</span>
                        <span>Voorraad: {p.stock_status}</span>
                        {p.permalink && (
                          <a href={p.permalink} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-400 hover:text-brand-300">
                            <ExternalLink className="h-3 w-3" /> Bekijk product
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filtered.length === 0 && !loading && (
              <div className="py-12 text-center text-sm text-white/30">
                Geen producten gevonden met deze filters
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
