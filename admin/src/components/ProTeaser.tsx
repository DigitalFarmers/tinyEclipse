"use client";

import { Crown, Lock, Sparkles, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

/**
 * PRO/PRO+ Feature Teaser Component
 * Shows blurred premium content with upgrade CTA overlay.
 *
 * Usage:
 *   <ProTeaser plan="tiny" requiredPlan="pro" feature="AI Insights">
 *     <ActualPremiumContent />
 *   </ProTeaser>
 */

interface ProTeaserProps {
  plan: string;
  requiredPlan: "pro" | "pro_plus";
  feature: string;
  description?: string;
  children: React.ReactNode;
  compact?: boolean;
  upgradeUrl?: string;
}

const PLAN_RANK: Record<string, number> = {
  tiny: 0,
  pro: 1,
  pro_plus: 2,
};

const PLAN_LABELS: Record<string, string> = {
  pro: "PRO",
  pro_plus: "PRO+",
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  pro: {
    bg: "bg-brand-500/10",
    text: "text-brand-400",
    border: "border-brand-500/30",
    gradient: "from-brand-500 to-purple-600",
  },
  pro_plus: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
    gradient: "from-purple-500 to-pink-600",
  },
};

export function ProTeaser({
  plan,
  requiredPlan,
  feature,
  description,
  children,
  compact = false,
  upgradeUrl,
}: ProTeaserProps) {
  const userRank = PLAN_RANK[plan] ?? 0;
  const requiredRank = PLAN_RANK[requiredPlan] ?? 1;

  // User has access — render children normally
  if (userRank >= requiredRank) {
    return <>{children}</>;
  }

  const colors = PLAN_COLORS[requiredPlan];
  const label = PLAN_LABELS[requiredPlan];
  const href = upgradeUrl || "/portal/account?upgrade=true";

  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        {/* Blurred content */}
        <div className="pointer-events-none select-none blur-[6px] opacity-40">
          {children}
        </div>
        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Link
            href={href}
            className={`flex items-center gap-2 rounded-lg ${colors.bg} ${colors.border} border px-3 py-2 text-[11px] font-semibold ${colors.text} transition hover:scale-105`}
          >
            <Crown className="h-3.5 w-3.5" />
            {label}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${colors.border}`}>
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-[8px] opacity-30 saturate-50">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] p-6">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${colors.gradient} shadow-lg`}>
          <Crown className="h-7 w-7 text-white" />
        </div>

        <h3 className="mt-4 text-lg font-bold text-white">{feature}</h3>
        {description && (
          <p className="mt-1.5 max-w-xs text-center text-sm text-white/50">{description}</p>
        )}

        <div className="mt-2 flex items-center gap-1.5">
          <span className={`rounded-full ${colors.bg} px-2.5 py-0.5 text-[10px] font-bold ${colors.text}`}>
            {label}
          </span>
          <span className="text-[11px] text-white/30">feature</span>
        </div>

        <Link
          href={href}
          className={`mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r ${colors.gradient} px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:shadow-xl`}
        >
          <Sparkles className="h-4 w-4" />
          Upgrade naar {label}
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-3 text-[10px] text-white/25">
          {requiredPlan === "pro" ? "Vanaf €9,99/maand" : "Vanaf €24,99/maand"}
        </p>
      </div>
    </div>
  );
}

/**
 * Inline PRO badge — shows a small lock icon next to feature names
 */
export function ProBadge({
  plan,
  requiredPlan = "pro",
}: {
  plan: string;
  requiredPlan?: "pro" | "pro_plus";
}) {
  const userRank = PLAN_RANK[plan] ?? 0;
  const requiredRank = PLAN_RANK[requiredPlan] ?? 1;

  if (userRank >= requiredRank) return null;

  const colors = PLAN_COLORS[requiredPlan];
  const label = PLAN_LABELS[requiredPlan];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${colors.bg} px-2 py-0.5 text-[9px] font-bold ${colors.text}`}>
      <Lock className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

/**
 * Feature comparison card for upgrade page
 */
export function PlanComparisonCard({
  currentPlan,
}: {
  currentPlan: string;
}) {
  const features = [
    { name: "AI Gesprekken", tiny: "50/maand", pro: "500/maand", proPlus: "Onbeperkt" },
    { name: "Kennisbronnen", tiny: "5 pagina's", pro: "50 pagina's", proPlus: "Onbeperkt" },
    { name: "Monitoring", tiny: "Uptime only", pro: "Uptime + SSL + DNS", proPlus: "Alles + Server" },
    { name: "AI Insights", tiny: "—", pro: "Wekelijks", proPlus: "Dagelijks + Suggesties" },
    { name: "Push Notificaties", tiny: "—", pro: "Email", proPlus: "Slack + Telegram + Email" },
    { name: "Leads Pipeline", tiny: "—", pro: "Basis", proPlus: "Geavanceerd + Auto-extract" },
    { name: "Rapporten", tiny: "—", pro: "Maandelijks", proPlus: "Wekelijks + Custom" },
    { name: "Event History", tiny: "24 uur", pro: "7 dagen", proPlus: "30 dagen" },
    { name: "Security Audit", tiny: "—", pro: "Basis", proPlus: "Volledig + Auto-fix" },
    { name: "SEO Audit", tiny: "—", pro: "—", proPlus: "Volledig + Suggesties" },
    { name: "AI Vertaling", tiny: "—", pro: "—", proPlus: "WPML + Auto-translate" },
  ];

  const rank = PLAN_RANK[currentPlan] ?? 0;

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-4 gap-0 border-b border-white/10">
        <div className="p-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Feature</div>
        <div className={`p-4 text-center text-[11px] font-semibold uppercase tracking-wider ${rank === 0 ? "bg-white/5 text-white" : "text-white/30"}`}>
          Tiny {rank === 0 && <span className="text-[9px] text-brand-400 ml-1">Huidig</span>}
        </div>
        <div className={`p-4 text-center text-[11px] font-semibold uppercase tracking-wider ${rank === 1 ? "bg-brand-500/10 text-brand-400" : "text-white/30"}`}>
          PRO {rank === 1 && <span className="text-[9px] text-brand-400 ml-1">Huidig</span>}
        </div>
        <div className={`p-4 text-center text-[11px] font-semibold uppercase tracking-wider ${rank === 2 ? "bg-purple-500/10 text-purple-400" : "text-white/30"}`}>
          PRO+ {rank === 2 && <span className="text-[9px] text-purple-400 ml-1">Huidig</span>}
        </div>
      </div>
      {/* Rows */}
      {features.map((f, i) => (
        <div key={f.name} className={`grid grid-cols-4 gap-0 ${i < features.length - 1 ? "border-b border-white/5" : ""}`}>
          <div className="p-3 text-[11px] text-white/60">{f.name}</div>
          <div className={`p-3 text-center text-[11px] ${rank === 0 ? "bg-white/[0.02]" : ""} ${f.tiny === "—" ? "text-white/15" : "text-white/50"}`}>
            {f.tiny}
          </div>
          <div className={`p-3 text-center text-[11px] ${rank === 1 ? "bg-brand-500/[0.03]" : ""} ${f.pro === "—" ? "text-white/15" : "text-brand-400/80"}`}>
            {f.pro}
          </div>
          <div className={`p-3 text-center text-[11px] ${rank === 2 ? "bg-purple-500/[0.03]" : ""} text-purple-400/80`}>
            {f.proPlus}
          </div>
        </div>
      ))}
      {/* CTA */}
      {rank < 2 && (
        <div className="grid grid-cols-4 gap-0 border-t border-white/10 bg-white/[0.02]">
          <div className="p-4" />
          <div className="p-4 text-center">
            {rank === 0 && (
              <span className="text-[10px] text-white/20">Gratis</span>
            )}
          </div>
          <div className="p-4 text-center">
            {rank < 1 ? (
              <Link href="/portal/account?upgrade=pro" className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-brand-500">
                <Zap className="h-3 w-3" /> €9,99/mo
              </Link>
            ) : (
              <span className="text-[10px] text-brand-400">Actief</span>
            )}
          </div>
          <div className="p-4 text-center">
            {rank < 2 ? (
              <Link href="/portal/account?upgrade=pro_plus" className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:opacity-90">
                <Crown className="h-3 w-3" /> €24,99/mo
              </Link>
            ) : (
              <span className="text-[10px] text-purple-400">Actief</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
