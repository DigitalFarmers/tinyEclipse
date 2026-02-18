"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ShoppingCart,
  Gift,
  FileText,
  Mail,
  BookOpen,
  Calendar,
  MessageCircle,
  Puzzle,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scan,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SiteModule {
  id: string;
  module_type: string;
  name: string;
  status: string;
  auto_detected: boolean;
  config: Record<string, any>;
  stats: Record<string, any>;
  last_checked_at: string | null;
}

const MODULE_ICONS: Record<string, any> = {
  jobs: Briefcase,
  shop: ShoppingCart,
  giftcard: Gift,
  forms: FileText,
  mail: Mail,
  blog: BookOpen,
  booking: Calendar,
  forum: MessageCircle,
  custom: Puzzle,
};

const MODULE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  jobs: { border: "border-blue-500/20", bg: "bg-blue-500/10", text: "text-blue-400" },
  shop: { border: "border-green-500/20", bg: "bg-green-500/10", text: "text-green-400" },
  giftcard: { border: "border-pink-500/20", bg: "bg-pink-500/10", text: "text-pink-400" },
  forms: { border: "border-purple-500/20", bg: "bg-purple-500/10", text: "text-purple-400" },
  mail: { border: "border-orange-500/20", bg: "bg-orange-500/10", text: "text-orange-400" },
  blog: { border: "border-cyan-500/20", bg: "bg-cyan-500/10", text: "text-cyan-400" },
  booking: { border: "border-yellow-500/20", bg: "bg-yellow-500/10", text: "text-yellow-400" },
  forum: { border: "border-indigo-500/20", bg: "bg-indigo-500/10", text: "text-indigo-400" },
  custom: { border: "border-white/10", bg: "bg-white/5", text: "text-white/50" },
};

export default function PortalModulesPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [modules, setModules] = useState<SiteModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) { router.replace("/portal/login"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.replace("/portal/login"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    loadModules();
  }, [session]);

  async function loadModules() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/projects/${session.tenant_id}/modules`, { cache: "no-store" });
      if (r.ok) setModules(await r.json());
    } catch {}
    setLoading(false);
  }

  async function scanSite() {
    setScanning(true);
    setScanResult(null);
    try {
      const r = await fetch(`${API_URL}/api/portal/projects/${session.tenant_id}/modules/detect`, { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        setScanResult(data);
        await loadModules();
      }
    } catch {}
    setScanning(false);
  }

  if (!session) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Modules</h1>
          <p className="mt-0.5 text-sm text-white/40">
            Actieve functies op {session.domain}
          </p>
        </div>
        <button
          onClick={scanSite}
          disabled={scanning}
          className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-4 py-2 text-xs font-medium text-brand-400 transition hover:bg-brand-500/20 disabled:opacity-50"
        >
          {scanning ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Scan className="h-3.5 w-3.5" />
          )}
          {scanning ? "Scannen..." : "Site Scannen"}
        </button>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <div className="mt-4 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <p className="text-xs font-semibold text-brand-400">
            Scan voltooid: {scanResult.detected} modules gedetecteerd
            {scanResult.new_modules_created > 0 && `, ${scanResult.new_modules_created} nieuw toegevoegd`}
          </p>
          {scanResult.all_detected?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scanResult.all_detected.map((d: any) => (
                <span key={d.module_type} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                  {d.name} ({Math.round(d.confidence * 100)}%)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Laden...</span>
        </div>
      ) : modules.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Puzzle className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Nog geen modules gedetecteerd.</p>
          <p className="mt-1 text-xs text-white/25">
            Klik op &quot;Site Scannen&quot; om automatisch te detecteren welke functies actief zijn.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = MODULE_ICONS[m.module_type] || Puzzle;
            const colors = MODULE_COLORS[m.module_type] || MODULE_COLORS.custom;
            const StatusIcon = m.status === "active" ? CheckCircle : m.status === "error" ? XCircle : AlertTriangle;
            const statusColor = m.status === "active" ? "text-green-400" : m.status === "error" ? "text-red-400" : "text-yellow-400";

            return (
              <div key={m.id} className={`rounded-xl border p-5 ${colors.border} ${colors.bg}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg}`}>
                      <Icon className={`h-5 w-5 ${colors.text}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{m.name}</h3>
                      <p className="text-[10px] text-white/30">{m.module_type}</p>
                    </div>
                  </div>
                  <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                </div>

                {/* Stats */}
                {Object.keys(m.stats).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {Object.entries(m.stats).slice(0, 3).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-[10px]">
                        <span className="text-white/30">{key.replace(/_/g, " ")}</span>
                        <span className="font-medium">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Config hints */}
                {m.config?.mailboxes && (
                  <div className="mt-3 space-y-0.5">
                    {(m.config.mailboxes as string[]).slice(0, 3).map((mb: string) => (
                      <p key={mb} className="text-[10px] text-white/30">📧 {mb}</p>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  {m.auto_detected && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-white/25">Auto-detected</span>
                  )}
                  {m.last_checked_at && (
                    <span className="text-[9px] text-white/20">
                      {new Date(m.last_checked_at).toLocaleDateString("nl-BE")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
