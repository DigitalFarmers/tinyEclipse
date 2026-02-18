"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Shield,
  BarChart3,
  Zap,
  LogOut,
  Bot,
  Activity,
} from "lucide-react";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login page: no chrome
  if (pathname === "/portal/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <PortalSidebar />
      <main className="flex-1 overflow-auto">
        <PortalTopBar />
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function PortalTopBar() {
  function handleLogout() {
    sessionStorage.removeItem("te_portal_session");
    window.location.href = "/portal/login";
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-brand-950/80 px-6 backdrop-blur-xl lg:px-8">
      <div />
      <div className="flex items-center gap-3">
        <a
          href="https://my.digitalfarmers.be/clientarea.php"
          target="_blank"
          rel="noopener"
          className="rounded-lg bg-white/5 px-3 py-1.5 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white/60"
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

function PortalSidebar() {
  const pathname = usePathname();

  const items = [
    { href: "/portal", label: "Overzicht", icon: LayoutDashboard },
    { href: "/portal/events", label: "Activiteit", icon: Activity },
    { href: "/portal/ai", label: "AI Assistent", icon: Bot },
    { href: "/portal/monitoring", label: "Monitoring", icon: Shield },
    { href: "/portal/analytics", label: "Bezoekers", icon: BarChart3 },
    { href: "/portal/conversations", label: "Gesprekken", icon: MessageSquare },
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
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all ${
                  active
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/5 p-4">
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
