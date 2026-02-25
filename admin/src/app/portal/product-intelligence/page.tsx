"use client";

import { useEffect, useState } from "react";
import { usePortalSession } from "@/lib/usePortalSession";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Wheat,
  Scale,
  Image as ImageIcon,
  FileText,
  RefreshCw,
  ExternalLink,
  Brain,
  Info,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  with_images: number;
  with_description: number;
  avg_completeness: number;
  ai_readiness_score: number;
  grade_distribution: Record<string, number>;
  category_breakdown: Record<string, { total: number; with_ingredients: number; avg_score: number; completeness_pct: number }>;
  allergens_overview: Record<string, number>;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  B: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  C: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  D: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  F: "text-red-400 bg-red-500/10 border-red-500/20",
};

function ScoreRing({ score, size = 100, label }: { score: number; size?: number; label: string }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-1.5">
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
      <span className="text-[10px] text-white/40 font-medium text-center">{label}</span>
    </div>
  );
}

export default function PortalProductIntelligence() {
  const { session } = usePortalSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ products: ProductAnalysis[]; summary: Summary } | null>(null);
  const [search, setSearch] = useState("");
  const [filterIngredients, setFilterIngredients] = useState<"all" | "with" | "without">("all");
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  async function loadData() {
    if (!session?.tenant_id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/portal/data/${session.tenant_id}/product-intelligence`, { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Product intelligence failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [session?.tenant_id]);

  const filtered = data?.products
    ?.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterIngredients === "with" && !p.has_ingredients) return false;
      if (filterIngredients === "without" && p.has_ingredients) return false;
      return true;
    })
    .sort((a, b) => a.completeness_score - b.completeness_score) || [];

  const s = data?.summary;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
        <p className="mt-4 text-sm text-white/40">Producten analyseren...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wheat className="h-5 w-5 text-brand-400" />
            Product Intelligence
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Hoe goed kent onze AI jouw producten? Compleetheid, ingrediënten & allergenen.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-brand-500/10 border border-brand-500/20 px-3 py-2 text-xs font-medium text-brand-400 transition hover:bg-brand-500/20"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Heranalyse
        </button>
      </div>

      {/* AI Readiness Banner */}
      {s && (
        <div className={`rounded-xl border p-5 ${
          s.ai_readiness_score >= 80 ? "bg-emerald-500/5 border-emerald-500/10" :
          s.ai_readiness_score >= 50 ? "bg-yellow-500/5 border-yellow-500/10" :
          "bg-red-500/5 border-red-500/10"
        }`}>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ScoreRing score={s.ai_readiness_score} size={90} label="AI Readiness" />
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-sm font-semibold">
                {s.ai_readiness_score >= 80 ? "Uitstekend! Jouw AI kent de producten goed." :
                 s.ai_readiness_score >= 50 ? "Goed begin, maar er ontbreekt nog productinformatie." :
                 "Jouw AI mist veel productinformatie."}
              </h3>
              <p className="text-xs text-white/40 mt-1">
                {s.without_ingredients > 0
                  ? `${s.without_ingredients} van ${s.total_products} producten missen ingrediënten. Hoe completer jouw productdata, hoe beter onze AI klanten kan helpen.`
                  : "Alle producten hebben ingrediënten — top!"
                }
              </p>
            </div>
            <div className="flex gap-4">
              <ScoreRing score={Math.round(s.avg_completeness)} size={70} label="Compleetheid" />
              <ScoreRing score={Math.round(s.ingredients_pct)} size={70} label="Ingrediënten" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {s && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Producten", value: s.total_products, icon: Package, color: "text-white" },
            { label: "Met ingrediënten", value: s.with_ingredients, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Zonder ingrediënten", value: s.without_ingredients, icon: XCircle, color: "text-red-400" },
            { label: "Met allergenen", value: s.with_allergens, icon: ShieldAlert, color: "text-yellow-400" },
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
      )}

      {/* Allergens */}
      {s && Object.keys(s.allergens_overview).length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
          <h3 className="text-xs font-semibold flex items-center gap-2 mb-2">
            <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />
            Allergenen in jouw producten
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(s.allergens_overview).map(([allergen, count]) => (
              <span key={allergen} className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] text-yellow-300">
                {allergen}
                <span className="text-yellow-500/50">{count}×</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {s && Object.keys(s.category_breakdown).length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
          <h3 className="text-xs font-semibold mb-3">Ingrediënten per categorie</h3>
          <div className="space-y-2">
            {Object.entries(s.category_breakdown)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([cat, info]) => (
                <div key={cat} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate text-white/60">{cat}</span>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500"
                        style={{ width: `${info.completeness_pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-right text-white/30 text-[10px]">{info.with_ingredients}/{info.total}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Product List */}
      {data && (
        <div className="rounded-xl bg-white/[0.03] border border-white/5">
          <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Zoek product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-xs text-white placeholder:text-white/30"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "without", "with"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterIngredients(f)}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium transition ${
                    filterIngredients === f
                      ? "border-brand-500 bg-brand-500/10 text-brand-400"
                      : "border-white/10 text-white/40 hover:text-white"
                  }`}
                >
                  {f === "all" ? "Alle" : f === "without" ? "Zonder ingrediënten" : "Met ingrediënten"}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {filtered.map((p) => (
              <div key={p.id}>
                <button
                  onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
                >
                  {p.image ? (
                    <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover bg-white/5 shrink-0" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 shrink-0">
                      <Package className="h-3.5 w-3.5 text-white/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      {p.has_ingredients ? (
                        <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Ingrediënten
                        </span>
                      ) : (
                        <span className="text-[9px] text-red-400 flex items-center gap-0.5">
                          <XCircle className="h-2.5 w-2.5" /> Ingrediënten
                        </span>
                      )}
                      {p.allergens_found.length > 0 && (
                        <span className="text-[9px] text-yellow-400">{p.allergens_found.length} allergenen</span>
                      )}
                    </div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${GRADE_COLORS[p.quality_grade] || "text-white/40 bg-white/5 border-white/10"}`}>
                    {p.quality_grade}
                  </span>
                  <div className="w-10 hidden sm:block">
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.completeness_score >= 80 ? "bg-emerald-500" :
                          p.completeness_score >= 50 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${p.completeness_score}%` }}
                      />
                    </div>
                  </div>
                  {expandedProduct === p.id ? <ChevronUp className="h-3.5 w-3.5 text-white/30 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30 shrink-0" />}
                </button>

                {expandedProduct === p.id && (
                  <div className="border-t border-white/5 bg-white/[0.01] px-4 py-4 space-y-3">
                    {/* Checklist */}
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                      {[
                        { label: "Beschrijving", ok: p.has_description },
                        { label: "Ingrediënten", ok: p.has_ingredients },
                        { label: "Allergenen", ok: p.has_allergens },
                        { label: "Voedingswaarde", ok: p.has_nutrition },
                        { label: "Gewicht", ok: p.has_weight },
                        { label: "Afbeelding", ok: p.has_images },
                        { label: "Prijs", ok: p.has_price },
                        { label: "SKU", ok: p.has_sku },
                        { label: "Categorie", ok: p.has_categories },
                        { label: "Korte beschr.", ok: p.has_short_description },
                      ].map((item) => (
                        <div key={item.label} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] ${
                          item.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}>
                          {item.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {item.label}
                        </div>
                      ))}
                    </div>

                    {/* Ingredients */}
                    {p.ingredients_text && (
                      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                        <p className="text-[9px] font-semibold text-emerald-400 mb-1">INGREDIËNTEN</p>
                        <p className="text-[11px] text-white/70 leading-relaxed">{p.ingredients_text}</p>
                      </div>
                    )}

                    {/* Allergens */}
                    {p.allergens_found.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold text-yellow-400 mb-1">ALLERGENEN</p>
                        <div className="flex flex-wrap gap-1">
                          {p.allergens_found.map((a) => (
                            <span key={a} className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[9px] text-yellow-300">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    {p.suggestions.length > 0 && (
                      <div className="rounded-lg bg-brand-500/5 border border-brand-500/10 p-3">
                        <p className="text-[9px] font-semibold text-brand-400 mb-1 flex items-center gap-1">
                          <Brain className="h-3 w-3" /> VERBETER TIPS
                        </p>
                        <ul className="space-y-1">
                          {p.suggestions.map((s, i) => (
                            <li key={i} className="text-[10px] text-white/50 flex items-start gap-1">
                              <Info className="h-2.5 w-2.5 mt-0.5 shrink-0 text-brand-400" />{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[9px] text-white/30 pt-1">
                      <span>Score: {p.completeness_score}%</span>
                      <span>Woorden: {p.description_word_count}</span>
                      {p.price && <span>Prijs: €{p.price}</span>}
                      {p.permalink && (
                        <a href={p.permalink} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-400 hover:text-brand-300">
                          <ExternalLink className="h-2.5 w-2.5" /> Bekijk
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-10 text-center text-xs text-white/30">
              Geen producten gevonden
            </div>
          )}
        </div>
      )}
    </div>
  );
}
