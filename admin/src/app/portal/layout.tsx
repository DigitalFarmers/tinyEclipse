"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Shield,
  BarChart3,
  Zap,
  LogOut,
  Bot,
  Activity,
  Lock,
  Crown,
  Puzzle,
  Mail,
  Menu,
  X,
  User,
  FileText,
} from "lucide-react";
import type { PlanFeatures } from "@/lib/usePortalSession";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      setTenantId(s.tenant_id);
      fetch(`${API_URL}/api/portal/features/${s.tenant_id}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setFeatures(d); })
        .catch(() => {});
    } catch {}
  }, []);

  // Login page: no chrome
  if (pathname === "/portal/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <PortalSidebar features={features} />
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <PortalTopBar features={features} tenantId={tenantId} />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <MobileBottomNav />
    </div>
  );
}

function PortalTopBar({ features, tenantId }: { features: PlanFeatures | null; tenantId: string | null }) {
  function handleLogout() {
    sessionStorage.removeItem("te_portal_session");
    window.location.href = "/portal/login";
  }

  const planColors: Record<string, string> = {
    tiny: "bg-white/10 text-white/50",
    pro: "bg-brand-500/20 text-brand-400",
    pro_plus: "bg-gradient-to-r from-brand-500/20 to-purple-500/20 text-purple-400",
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-brand-950/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
        {tenantId && <ProjectSwitcher currentTenantId={tenantId} />}
        {features && (
          <span className={`hidden items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${planColors[features.plan] || planColors.tiny}`}>
            {features.plan === "pro_plus" && <Crown className="h-2.5 w-2.5" />}
            {features.plan_label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href="https://my.digitalfarmers.be/clientarea.php"
          target="_blank"
          rel="noopener"
          className="hidden rounded-lg bg-white/5 px-3 py-1.5 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white/60 sm:block"
        >
          Mijn Account →
        </a>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-400"
          title="Uitloggen"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/portal", label: "Home", icon: LayoutDashboard },
    { href: "/portal/events", label: "Activiteit", icon: Activity },
    { href: "/portal/ai", label: "AI", icon: Bot },
    { href: "/portal/monitoring", label: "Monitor", icon: Shield },
    { href: "/portal/reports", label: "Rapport", icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-brand-950/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-around px-2">
        {tabs.map((tab) => {
          const active = tab.href === "/portal" ? pathname === "/portal" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition ${
                active ? "text-brand-400" : "text-white/30"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[9px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PortalSidebar({ features }: { features: PlanFeatures | null }) {
  const pathname = usePathname();

  const items = [
    { href: "/portal", label: "Overzicht", icon: LayoutDashboard, locked: false },
    { href: "/portal/events", label: "Activiteit", icon: Activity, locked: false },
    { href: "/portal/ai", label: "AI Assistent", icon: Bot, locked: false },
    { href: "/portal/monitoring", label: "Monitoring", icon: Shield, locked: false },
    { href: "/portal/modules", label: "Modules", icon: Puzzle, locked: false },
    { href: "/portal/mail", label: "E-mail", icon: Mail, locked: false },
    { href: "/portal/analytics", label: "Bezoekers", icon: BarChart3, locked: features ? !features.features.analytics_basic : false },
    { href: "/portal/conversations", label: "Gesprekken", icon: MessageSquare, locked: false },
    { href: "/portal/reports", label: "Rapporten", icon: FileText, locked: false },
    { href: "/portal/account", label: "Mijn Account", icon: User, locked: false },
  ];

  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-white/5 bg-brand-950 lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold tracking-tight">Tiny</span>
          <span className="text-sm font-light text-brand-500">Eclipse</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Mijn Website
        </p>
        <div className="space-y-0.5 px-3">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.locked ? "#" : item.href}
                onClick={item.locked ? (e) => e.preventDefault() : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all ${
                  item.locked
                    ? "cursor-not-allowed text-white/20"
                    : active
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.locked && <Lock className="ml-auto h-3 w-3 text-white/15" />}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/5 p-4">
        {features && features.plan === "tiny" && (
          <a
            href={features.upgrade_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500/20 to-purple-500/20 p-3 transition hover:from-brand-500/30 hover:to-purple-500/30"
          >
            <Crown className="h-4 w-4 text-brand-400" />
            <div>
              <p className="text-[11px] font-semibold text-brand-400">Upgrade naar Pro</p>
              <p className="text-[9px] text-white/30">Meer features, meer inzicht</p>
            </div>
          </a>
        )}
        <div className="rounded-lg bg-gradient-to-r from-brand-600/20 to-purple-600/20 p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-green-400" />
            <span className="text-[11px] font-medium text-green-400">Site Online</span>
          </div>
          <p className="mt-1 text-[10px] text-white/30">Powered by Digital Farmers</p>
        </div>
      </div>
    </aside>
  );
}
