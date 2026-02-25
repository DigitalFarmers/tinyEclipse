"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  Database,
  BarChart3,
  Shield,
  Users,
  Activity,
  Bell,
  Zap,
  LogOut,
  Eye,
  Brain,
  Menu,
  X,
  ShoppingCart,
  UserPlus,
  Contact,
  Terminal,
  Gauge,
  FileEdit,
  Server,
  Key,
  Mail,
  Image,
  Package,
  ArrowLeftRight,
  Globe,
  Cpu,
  Wheat,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getTenants, getAlerts, getOverview } from "@/lib/api";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [apiOk, setApiOk] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || pathname === "/admin/login") return;
    let mounted = true;
    async function poll() {
      try {
        const ts = await getTenants().catch(() => []);
        let alerts = 0;
        await Promise.all(ts.map(async (t: any) => {
          try { const a = await getAlerts(t.id, false); alerts += a.length; } catch {}
        }));
        const ov = await getOverview().catch(() => null);
        if (mounted) {
          setAlertCount(alerts);
          setChatCount(ov?.today?.conversations || 0);
          setApiOk(true);
        }
      } catch { if (mounted) setApiOk(false); }
    }
    poll();
    const iv = setInterval(poll, 60000);
    return () => { mounted = false; clearInterval(iv); };
  }, [isAuthenticated, pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alertCount={alertCount} chatCount={chatCount} apiOk={apiOk} />
      <main className="flex-1 overflow-auto">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-brand-950/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button onClick={onMenuClick} className="rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        <Link href="/admin/alerts" className="relative rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white">
          <Bell className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600" />
          <span className="text-xs font-medium text-white/70">DF Admin</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-400"
          title="Uitloggen"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function Sidebar({ open, onClose, alertCount, chatCount, apiOk }: { open: boolean; onClose: () => void; alertCount: number; chatCount: number; apiOk: boolean }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const sections = [
    {
      title: "Command Center",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, badge: 0 },
        { href: "/admin/portfolio", label: "Portfolio", icon: Globe, badge: 0 },
        { href: "/admin/clients", label: "Klanten", icon: Users, badge: 0 },
        { href: "/admin/tenants", label: "Websites", icon: Building2, badge: 0 },
        { href: "/admin/monitoring", label: "Monitoring", icon: Shield, badge: 0 },
        { href: "/admin/site-manager", label: "Site Manager", icon: ShoppingCart, badge: 0 },
        { href: "/admin/commander", label: "Commander", icon: Terminal, badge: 0 },
        { href: "/admin/superview", label: "Superview", icon: Eye, badge: 0 },
        { href: "/admin/server", label: "Server", icon: Server, badge: 0 },
        { href: "/admin/dfguard", label: "DFGuard", icon: Shield, badge: 0 },
        { href: "/admin/commands", label: "Commands", icon: Terminal, badge: 0 },
        { href: "/admin/content", label: "Content", icon: FileEdit, badge: 0 },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { href: "/admin/mother-brain", label: "Mother Brain", icon: Cpu, badge: 0 },
        { href: "/admin/product-intelligence", label: "Product Intel", icon: Wheat, badge: 0 },
        { href: "/admin/brain", label: "AI Brain", icon: Brain, badge: 0 },
        { href: "/admin/insights", label: "AI Insights", icon: Brain, badge: 0 },
        { href: "/admin/analytics", label: "Deep Analytics", icon: BarChart3, badge: 0 },
        { href: "/admin/insights/cross-site", label: "Cross-Site AI", icon: Brain, badge: 0 },
        { href: "/admin/conversations", label: "Conversations", icon: MessageSquare, badge: chatCount },
        { href: "/admin/leads", label: "Leads", icon: UserPlus, badge: 0 },
        { href: "/admin/contacts", label: "Contacts", icon: Contact, badge: 0 },
        { href: "/admin/calibration", label: "Calibratie", icon: Gauge, badge: 0 },
        { href: "/admin/sources", label: "Knowledge Base", icon: Database, badge: 0 },
        { href: "/admin/sync", label: "Cross-Site Sync", icon: ArrowLeftRight, badge: 0 },
      ],
    },
    {
      title: "Tooling",
      items: [
        { href: "/admin/apikeys", label: "API Keys", icon: Key, badge: 0 },
        { href: "/admin/updater", label: "Plugin Updater", icon: Package, badge: 0 },
        { href: "/admin/digest", label: "Email Digest", icon: Mail, badge: 0 },
        { href: "/admin/compressor", label: "Compressor", icon: Image, badge: 0 },
      ],
    },
    {
      title: "Operations",
      items: [
        { href: "/admin/registry", label: "Tech Registry", icon: Activity, badge: 0 },
        { href: "/admin/hardening", label: "Hardening", icon: Shield, badge: 0 },
        { href: "/admin/requests", label: "Verzoeken", icon: FileEdit, badge: 0 },
        { href: "/admin/usage", label: "Usage & Billing", icon: BarChart3, badge: 0 },
        { href: "/admin/alerts", label: "Alerts", icon: Bell, badge: alertCount },
      ],
    },
  ];

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center justify-between border-b border-white/5 px-5">
        <Link href="/admin" className="flex items-center gap-3" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight">Eclipse</span>
            <span className="ml-1 text-sm font-light text-brand-500">HUB</span>
          </div>
        </Link>
        <button onClick={onClose} className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white lg:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              {section.title}
            </p>
            <div className="space-y-0.5 px-3">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-all ${
                      active
                        ? "bg-brand-500/10 text-white font-medium"
                        : "text-white/50 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className={`h-4 w-4 ${active ? "text-brand-400" : ""}`} />
                      {item.label}
                    </span>
                    {item.badge > 0 && (
                      <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                        item.href === "/admin/alerts"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-brand-500/20 text-brand-400"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className={`rounded-lg p-3 ${apiOk ? "bg-gradient-to-r from-brand-600/20 to-purple-600/20" : "bg-red-500/10 border border-red-500/20"}`}>
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5`}>
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${apiOk ? "bg-green-400" : "bg-red-400"}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${apiOk ? "bg-green-400" : "bg-red-500"}`} />
            </span>
            <span className={`text-[11px] font-medium ${apiOk ? "text-green-400" : "text-red-400"}`}>
              {apiOk ? "System Operational" : "API Unreachable"}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-white/30">
            {apiOk ? "All services running" : "Check backend connection"}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-white/5 bg-brand-950 lg:flex lg:flex-col">
        {sidebarContent}
      </aside>
      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-white/5 bg-brand-950 transition-transform duration-200 lg:hidden ${
        open ? "translate-x-0" : "-translate-x-full"
      } flex flex-col`}>
        {sidebarContent}
      </aside>
    </>
  );
}
