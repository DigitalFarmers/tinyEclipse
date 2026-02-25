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
  FileEdit,
  Package,
  ShoppingCart,
  Wrench,
  Key,
  CalendarDays,
  FolderOpen,
  Gift,
  Briefcase,
  HelpCircle,
  Building2,
  Search,
  Globe,
  Link2,
  Settings,
  ChevronDown,
  Users,
  Languages,
  Wheat,
  Brain,
} from "lucide-react";
import type { PlanFeatures } from "@/lib/usePortalSession";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PortalFeatures {
  tenant_id: string;
  plan: string;
  plan_label: string;
  price: string;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  active_modules: { type: string; name: string; auto_detected: boolean }[];
  active_blocks: string[];
  sector_profile: {
    sector: string;
    sector_label: string;
    sector_icon: string;
    recommended_blocks: string[];
  } | null;
  hub_config: {
    branding?: { logo_url?: string; primary_color?: string; company_name?: string };
    visible_blocks?: string[];
    block_order?: string[];
  } | null;
  upgrade_url: string;
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [features, setFeatures] = useState<PortalFeatures | null>(null);
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
      <MobileBottomNav features={features} />
    </div>
  );
}

function PortalTopBar({ features, tenantId }: { features: PortalFeatures | null; tenantId: string | null }) {
  function handleLogout() {
    sessionStorage.removeItem("te_portal_session");
    window.location.href = "/portal/login";
  }

  const planColors: Record<string, string> = {
    tiny: "bg-white/10 text-white/50",
    pro: "bg-brand-500/20 text-brand-400",
    pro_plus: "bg-gradient-to-r from-brand-500/20 to-purple-500/20 text-purple-400",
  };

  const branding = features?.hub_config?.branding;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-brand-950/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 lg:hidden">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>
        {tenantId && <ProjectSwitcher currentTenantId={tenantId} />}
        {features?.sector_profile && (
          <span className="hidden items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30 sm:inline-flex">
            {features.sector_profile.sector_label}
          </span>
        )}
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

function MobileBottomNav({ features }: { features: PortalFeatures | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const hasBlock = (b: string) => features?.active_blocks?.includes(b);

  const primaryTabs = [
    { href: "/portal", label: "Home", icon: LayoutDashboard },
    ...(hasBlock("products") || hasBlock("orders")
      ? [{ href: "/portal/orders", label: "Orders", icon: ShoppingCart }]
      : [{ href: "/portal/events", label: "Activiteit", icon: Activity }]),
    { href: "/portal/ai", label: "AI", icon: Bot },
    ...(hasBlock("products")
      ? [{ href: "/portal/products", label: "Producten", icon: Package }]
      : [{ href: "/portal/monitoring", label: "Monitor", icon: Shield }]),
  ];

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-brand-950/98 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
            <span className="text-sm font-semibold text-white">Menu</span>
            <button onClick={() => setMoreOpen(false)} className="rounded-lg p-2 text-white/50 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="overflow-y-auto p-4">
            <MobileMenuSection features={features} onClose={() => setMoreOpen(false)} />
          </nav>
        </div>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-brand-950/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around px-2">
          {primaryTabs.map((tab) => {
            const active = tab.href === "/portal" ? pathname === "/portal" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition ${active ? "text-brand-400" : "text-white/30"}`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-white/30 transition"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[9px] font-medium">Meer</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function MobileMenuSection({ features, onClose }: { features: PortalFeatures | null; onClose: () => void }) {
  const sections = buildNavSections(features);
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">{section.label}</p>
          <div className="space-y-1">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  locked?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function buildNavSections(features: PortalFeatures | null): NavSection[] {
  const hasBlock = (b: string) => features?.active_blocks?.includes(b);
  const hasModule = (t: string) => features?.active_modules?.some((m) => m.type === t);
  const isLocked = (feat: string) => features ? !(features.features as Record<string, boolean>)[feat] : false;

  const sections: NavSection[] = [];

  // Mijn Website
  sections.push({
    label: "Mijn Website",
    items: [
      { href: "/portal", label: "Overzicht", icon: LayoutDashboard },
      { href: "/portal/events", label: "Activiteit", icon: Activity },
      { href: "/portal/ai", label: "AI Assistent", icon: Bot },
      { href: "/portal/self-learning", label: "Zelflerend AI", icon: Brain },
      { href: "/portal/monitoring", label: "Monitoring", icon: Shield },
    ],
  });

  // Vertalingen (only if WPML detected)
  if (hasModule("wpml")) {
    sections[0].items.push({ href: "/portal/translations", label: "Vertalingen", icon: Languages });
  }

  // Mijn Aanbod (dynamic based on active modules)
  const offeringItems: NavItem[] = [];
  if (hasBlock("products")) offeringItems.push({ href: "/portal/products", label: "Producten", icon: Package });
  if (hasBlock("products")) offeringItems.push({ href: "/portal/product-intelligence", label: "Product Intel", icon: Wheat });
  if (hasBlock("services")) offeringItems.push({ href: "/portal/services", label: "Diensten", icon: Wrench });
  if (hasBlock("rentals")) offeringItems.push({ href: "/portal/rentals", label: "Verhuur", icon: Key });
  if (hasBlock("bookings")) offeringItems.push({ href: "/portal/bookings", label: "Boekingen", icon: CalendarDays });
  if (hasBlock("projects")) offeringItems.push({ href: "/portal/projects", label: "Projecten", icon: FolderOpen });
  if (hasBlock("packages")) offeringItems.push({ href: "/portal/packages", label: "Pakketten", icon: Gift });
  if (hasBlock("jobs")) offeringItems.push({ href: "/portal/jobs", label: "Vacatures", icon: Briefcase });
  if (hasBlock("orders")) offeringItems.push({ href: "/portal/orders", label: "Orders", icon: ShoppingCart });

  if (offeringItems.length > 0) {
    sections.push({ label: "Mijn Aanbod", items: offeringItems });
  }

  // Mijn Klanten
  const clientItems: NavItem[] = [];
  if (hasBlock("forms") || hasModule("forms")) clientItems.push({ href: "/portal/forms", label: "Formulieren", icon: FileText });
  clientItems.push({ href: "/portal/conversations", label: "Gesprekken", icon: MessageSquare });
  clientItems.push({ href: "/portal/analytics", label: "Bezoekers", icon: BarChart3, locked: isLocked("analytics_basic") });
  sections.push({ label: "Mijn Klanten", items: clientItems });

  // SEO & Zichtbaarheid
  sections.push({
    label: "SEO & Zichtbaarheid",
    items: [
      { href: "/portal/seo", label: "SEO Console", icon: Search },
      { href: "/portal/seo/opengraph", label: "OpenGraph", icon: Globe },
      { href: "/portal/seo/links", label: "Link Manager", icon: Link2 },
    ],
  });

  // Mijn Bedrijf
  const bizItems: NavItem[] = [
    { href: "/portal/faq", label: "FAQ's", icon: HelpCircle },
    { href: "/portal/business", label: "Bedrijfsprofiel", icon: Building2 },
  ];
  sections.push({ label: "Mijn Bedrijf", items: bizItems });

  // Instellingen
  const settingsItems: NavItem[] = [
    { href: "/portal/requests", label: "Wijzigingen", icon: FileEdit },
    { href: "/portal/reports", label: "Rapporten", icon: FileText },
  ];
  settingsItems.push({ href: "/portal/settings", label: "Hub Instellingen", icon: Settings });
  settingsItems.push({ href: "/portal/account", label: "Mijn Account", icon: User });
  sections.push({ label: "Instellingen", items: settingsItems });

  return sections;
}

function PortalSidebar({ features }: { features: PortalFeatures | null }) {
  const pathname = usePathname();
  const sections = buildNavSections(features);
  const branding = features?.hub_config?.branding;

  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-white/5 bg-brand-950 lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-white/5 px-5">
        {branding?.logo_url ? (
          <img src={branding.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
        )}
        <div>
          {branding?.company_name ? (
            <span className="text-sm font-bold tracking-tight text-white">{branding.company_name}</span>
          ) : (
            <>
              <span className="text-sm font-bold tracking-tight">Tiny</span>
              <span className="text-sm font-light text-brand-500">Eclipse</span>
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section, si) => (
          <div key={section.label} className={si > 0 ? "mt-4" : ""}>
            <p className="mb-1.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-white/20">
              {section.label}
            </p>
            <div className="space-y-0.5 px-3">
              {section.items.map((item) => {
                const active = item.href === "/portal"
                  ? pathname === "/portal"
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.locked ? "#" : item.href}
                    onClick={item.locked ? (e) => e.preventDefault() : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] transition-all ${
                      item.locked
                        ? "cursor-not-allowed text-white/15"
                        : active
                        ? "bg-brand-500/10 text-brand-400"
                        : "text-white/45 hover:bg-white/5 hover:text-white/80"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                    {item.locked && <Lock className="ml-auto h-3 w-3 text-white/10" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
