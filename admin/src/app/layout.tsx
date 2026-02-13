import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TinyEclipse — Admin",
  description: "TinyEclipse Operations Cockpit",
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
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  const navItems = [
    { href: "/", label: "Overview", icon: "LayoutDashboard" },
    { href: "/tenants", label: "Tenants", icon: "Building2" },
    { href: "/conversations", label: "Conversations", icon: "MessageSquare" },
    { href: "/sources", label: "Sources", icon: "Database" },
    { href: "/usage", label: "Usage", icon: "BarChart3" },
  ];

  return (
    <aside className="hidden w-64 border-r border-white/10 bg-brand-950 lg:block">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
        <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-sm font-bold">
          TE
        </div>
        <span className="text-lg font-semibold">TinyEclipse</span>
      </div>
      <nav className="mt-6 space-y-1 px-3">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <span className="text-xs opacity-50">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
