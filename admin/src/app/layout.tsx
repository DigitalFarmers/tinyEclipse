import type { Metadata } from "next";
import Link from "next/link";
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
} from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eclipse HUB — Digital Farmers Command Center",
  description: "AI-Powered Intelligence Layer for all Digital Farmers clients",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-brand-950 text-white antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <TopBar />
            <div className="p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-brand-950/80 px-6 backdrop-blur-xl lg:px-8">
      <div />
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600" />
          <span className="text-xs font-medium text-white/70">DF Admin</span>
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
  const sections = [
    {
      title: "Command Center",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/tenants", label: "Websites", icon: Building2 },
        { href: "/monitoring", label: "Monitoring", icon: Shield },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { href: "/analytics", label: "Visitor Analytics", icon: Users },
        { href: "/conversations", label: "Conversations", icon: MessageSquare },
        { href: "/sources", label: "Knowledge Base", icon: Database },
      ],
    },
    {
      title: "Operations",
      items: [
        { href: "/usage", label: "Usage & Billing", icon: BarChart3 },
        { href: "/alerts", label: "Alerts", icon: Bell },
      ],
    },
  ];

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-white/5 bg-brand-950 lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold tracking-tight">Eclipse</span>
          <span className="ml-1 text-sm font-light text-brand-500">HUB</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              {section.title}
            </p>
            <div className="space-y-0.5 px-3">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-white/50 transition-all hover:bg-white/5 hover:text-white"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="rounded-lg bg-gradient-to-r from-brand-600/20 to-purple-600/20 p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-green-400" />
            <span className="text-[11px] font-medium text-green-400">System Operational</span>
          </div>
          <p className="mt-1 text-[10px] text-white/30">All services running</p>
        </div>
      </div>
    </aside>
  );
}
