"use client";

import { Lock, ArrowUpRight } from "lucide-react";
import type { PlanFeatures } from "@/lib/usePortalSession";

interface FeatureGateProps {
  features: PlanFeatures | null;
  requires: keyof PlanFeatures["features"];
  children: React.ReactNode;
  label?: string;
}

export function FeatureGate({ features, requires, children, label }: FeatureGateProps) {
  if (!features) return <>{children}</>;

  const allowed = features.features[requires];
  if (allowed) return <>{children}</>;

  const planNames: Record<string, string> = {
    tiny: "Tiny",
    pro: "Pro",
    pro_plus: "Pro+",
  };

  // Determine which plan unlocks this feature
  const featureToMinPlan: Record<string, string> = {
    monitoring_ssl: "Pro",
    monitoring_dns: "Pro",
    monitoring_performance: "Pro+",
    monitoring_server: "Pro+",
    analytics_basic: "Pro",
    analytics_advanced: "Pro+",
    proactive_help: "Pro",
    push_notifications: "Pro",
    priority_support: "Pro+",
    custom_branding: "Pro+",
  };

  const minPlan = featureToMinPlan[requires] || "Pro";

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-20 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-brand-950/95 p-6 text-center shadow-2xl backdrop-blur-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10">
            <Lock className="h-5 w-5 text-brand-400" />
          </div>
          <h3 className="mt-3 text-sm font-bold">
            {label || "Deze functie"} is beschikbaar vanaf {minPlan}
          </h3>
          <p className="mt-1 text-xs text-white/40">
            Je huidige plan: <span className="font-semibold text-white/60">{planNames[features.plan] || features.plan}</span>
          </p>
          <a
            href={features.upgrade_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Upgrade naar {minPlan}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    tiny: { bg: "bg-white/10", text: "text-white/50", label: "Tiny" },
    pro: { bg: "bg-brand-500/20", text: "text-brand-400", label: "Pro" },
    pro_plus: { bg: "bg-gradient-to-r from-brand-500/20 to-purple-500/20", text: "text-purple-400", label: "Pro+" },
  };
  const c = config[plan] || config.tiny;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
