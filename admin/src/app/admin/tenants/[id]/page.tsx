"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Globe, Shield, MessageSquare, Database, Users, Eye, Clock,
  ArrowUpRight, RefreshCw, Copy, Check, TrendingUp,
  Briefcase, ShoppingCart, Gift, FileText, Mail, BookOpen,
  Calendar, MessageCircle, Puzzle, Scan, CheckCircle, XCircle,
  AlertTriangle, Link2,
} from "lucide-react";
import {
  getTenant, getMonitoringDashboard, getAnalytics,
  getConversations, getSources, getEmbedConfig, setupMonitoring,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

const MODULE_ICONS: Record<string, any> = {
  jobs: Briefcase, shop: ShoppingCart, giftcard: Gift, forms: FileText,
  mail: Mail, blog: BookOpen, booking: Calendar, forum: MessageCircle, custom: Puzzle,
};
const MODULE_COLORS: Record<string, string> = {
  jobs: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  shop: "border-green-500/20 bg-green-500/10 text-green-400",
  giftcard: "border-pink-500/20 bg-pink-500/10 text-pink-400",
  forms: "border-purple-500/20 bg-purple-500/10 text-purple-400",
  mail: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  blog: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  booking: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
  forum: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
  custom: "border-white/10 bg-white/5 text-white/50",
};

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tenant, setTenant] = useState<any>(null);
  const [monitor, setMonitor] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [embedConfig, setEmbedConfig] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, m, a, c, s, e] = await Promise.all([
        getTenant(id).catch(() => null),
        getMonitoringDashboard(id).catch(() => null),
        getAnalytics(id, 24).catch(() => null),
        getConversations(id).catch(() => []),
        getSources(id).catch(() => []),
        getEmbedConfig(id).catch(() => null),
      ]);
      setTenant(t); setMonitor(m); setAnalytics(a); setConversations(c); setSources(s); setEmbedConfig(e);

      // Load modules and sibling projects
      fetch(`${API_URL}/api/portal/projects/${id}/modules`).then(r => r.ok ? r.json() : []).then(setModules).catch(() => {});
      fetch(`${API_URL}/api/portal/projects/by-tenant/${id}`).then(r => r.ok ? r.json() : null).then(d => { if (d?.projects) setSiblings(d.projects); }).catch(() => {});
    } finally { setLoading(false); }
  }

  async function scanModules() {
    setScanning(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/projects/${id}/modules/detect`, { method: "POST" });
      if (r.ok) {
        const mods = await fetch(`${API_URL}/api/portal/projects/${id}/modules`);
        if (mods.ok) setModules(await mods.json());
      }
    } catch {} finally { setScanning(false); }
  }

  function copyId(text: string) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  if (loading) return <div className="mt-12 flex items-center justify-center gap-3 text-white/40"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" /><span className="text-sm">Loading...</span></div>;
  if (!tenant) return <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center"><Globe className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 text-sm text-white/40">Tenant niet gevonden</p><Link href="/admin/tenants" className="mt-4 inline-flex text-xs text-brand-400">← Terug</Link></div>;

  const planBadge: Record<string, string> = { tiny: "bg-white/10 text-white/50", pro: "bg-brand-500/20 text-brand-400", pro_plus: "bg-purple-500/20 text-purple-400" };
  const sum = analytics?.summary;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`h-3 w-3 rounded-full ${tenant.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <div className="mt-0.5 flex items-center gap-3">
              <span className="text-sm text-white/40">{tenant.domain || "Geen domein"}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${planBadge[tenant.plan] || planBadge.tiny}`}>{tenant.plan?.toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenant.domain && <a href={`https://${tenant.domain}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"><ArrowUpRight className="h-3 w-3" /> Bezoek</a>}
          <button onClick={loadAll} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"><RefreshCw className="h-3 w-3" /></button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Tenant ID</p><p className="mt-1 font-mono text-xs text-white/60">{tenant.id}</p></div>
          <button onClick={() => copyId(tenant.id)} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-[10px] text-white/40 transition hover:bg-white/10">{copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}{copied ? "Gekopieerd!" : "Kopieer"}</button>
        </div>
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Widget Embed Code</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-black/30 p-3 text-[11px] text-green-400/80 leading-relaxed select-all">{`<script src="${API_URL}/widget/v1/widget.js"\n  data-tenant="${tenant.id}"\n  data-api="${API_URL}"\n  data-color="${tenant.settings?.widget_color || '#6C3CE1'}"\n  data-name="${tenant.settings?.widget_name || tenant.name + ' AI'}"\n  data-lang="${tenant.settings?.widget_lang || 'nl'}"\n  data-position="${tenant.settings?.widget_position || 'bottom-right'}"\n  defer><\/script>`}</pre>
          <button onClick={() => { navigator.clipboard.writeText(`<script src="${API_URL}/widget/v1/widget.js" data-tenant="${tenant.id}" data-api="${API_URL}" data-color="${tenant.settings?.widget_color || '#6C3CE1'}" data-name="${tenant.settings?.widget_name || tenant.name + ' AI'}" data-lang="${tenant.settings?.widget_lang || 'nl'}" data-position="${tenant.settings?.widget_position || 'bottom-right'}" defer><\/script>`); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-1.5 text-[10px] font-medium text-brand-400 transition hover:bg-brand-500/20">{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Gekopieerd!" : "Kopieer embed code"}</button>
          <p className="mt-2 text-[10px] text-white/20">Plak in WordPress: Appearance → Theme Header, of gebruik de eclipse-ai plugin settings.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MC icon={Users} label="Sessies (24h)" value={sum?.total_sessions || 0} />
        <MC icon={Eye} label="Pageviews (24h)" value={sum?.total_pageviews || 0} />
        <MC icon={MessageSquare} label="Gesprekken" value={conversations.length} />
        <MC icon={Database} label="Kennisbronnen" value={sources.length} />
      </div>

      <Sec title="Monitoring" icon={Shield}>
        {monitor ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {monitor.checks?.map((c: any) => (
              <div key={c.id} className={`rounded-lg border p-3 ${c.status === "ok" ? "border-green-500/20 bg-green-500/5" : c.status === "warning" ? "border-yellow-500/20 bg-yellow-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase">{c.type}</span><span className={`text-[10px] font-bold uppercase ${c.status === "ok" ? "text-green-400" : c.status === "warning" ? "text-yellow-400" : "text-red-400"}`}>{c.status}</span></div>
                {c.response_time_ms && <p className="mt-1 text-sm font-bold">{c.response_time_ms}ms</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center"><p className="text-xs text-white/30">Geen monitoring</p><button onClick={async () => { await setupMonitoring(id); await loadAll(); }} className="mt-2 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-medium transition hover:bg-brand-500">Activeer</button></div>
        )}
      </Sec>

      <Sec title="Recente Gesprekken" icon={MessageSquare}>
        {conversations.length > 0 ? (
          <div className="space-y-2">{conversations.slice(0, 5).map((c: any) => (
            <Link key={c.id} href={`/admin/conversations?id=${c.id}`} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.04]">
              <div><p className="text-xs font-medium">{c.visitor_id?.slice(0, 12) || "Anoniem"}...</p><p className="text-[10px] text-white/30">{c.message_count || 0} berichten</p></div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.status === "escalated" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/40"}`}>{c.status}</span>
            </Link>
          ))}</div>
        ) : <p className="py-4 text-center text-xs text-white/30">Nog geen gesprekken</p>}
      </Sec>

      <Sec title="Modules" icon={Puzzle}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] text-white/30">{modules.length} module{modules.length !== 1 ? "s" : ""} actief</p>
          <button onClick={scanModules} disabled={scanning} className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-1.5 text-[10px] font-medium text-brand-400 transition hover:bg-brand-500/20 disabled:opacity-50">
            {scanning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Scan className="h-3 w-3" />}
            {scanning ? "Scannen..." : "Scan Site"}
          </button>
        </div>
        {modules.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m: any) => {
              const Icon = MODULE_ICONS[m.module_type] || Puzzle;
              const colors = MODULE_COLORS[m.module_type] || MODULE_COLORS.custom;
              const StatusIcon = m.status === "active" ? CheckCircle : m.status === "error" ? XCircle : AlertTriangle;
              const statusColor = m.status === "active" ? "text-green-400" : m.status === "error" ? "text-red-400" : "text-yellow-400";
              return (
                <div key={m.id} className={`rounded-lg border p-3 ${colors}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold">{m.name}</span>
                    </div>
                    <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                  </div>
                  {m.auto_detected && <p className="mt-1 text-[9px] text-white/25">Auto-detected</p>}
                </div>
              );
            })}
          </div>
        ) : <p className="py-4 text-center text-xs text-white/30">Geen modules — klik &quot;Scan Site&quot; om te detecteren</p>}
      </Sec>

      {siblings.length > 1 && (
        <Sec title="Zuster Projecten" icon={Link2}>
          <div className="grid gap-2 sm:grid-cols-2">
            {siblings.filter((s: any) => s.tenant_id !== id).map((s: any) => (
              <Link key={s.tenant_id} href={`/admin/tenants/${s.tenant_id}`} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.04]">
                <Globe className="h-4 w-4 text-white/30" />
                <div>
                  <p className="text-xs font-medium">{s.name}</p>
                  <p className="text-[10px] text-white/30">{s.domain}</p>
                </div>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-medium ${s.plan === "pro" ? "bg-brand-500/20 text-brand-400" : s.plan === "pro_plus" ? "bg-purple-500/20 text-purple-400" : "bg-white/10 text-white/40"}`}>{s.plan}</span>
              </Link>
            ))}
          </div>
        </Sec>
      )}

      <Sec title="Kennisbronnen" icon={Database}>
        {sources.length > 0 ? (
          <div className="space-y-2">{sources.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div><p className="text-xs font-medium">{s.title}</p><p className="text-[10px] text-white/30">{s.type} · {s.url || "Handmatig"}</p></div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.status === "indexed" ? "bg-green-500/20 text-green-400" : s.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{s.status}</span>
            </div>
          ))}</div>
        ) : <p className="py-4 text-center text-xs text-white/30">Geen kennisbronnen</p>}
      </Sec>
    </div>
  );
}

function Sec({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return <div className="mt-8"><div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-white/30" /><h2 className="text-sm font-semibold uppercase tracking-widest text-white/25">{title}</h2></div>{children}</div>;
}

function MC({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4"><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-white/30" /><span className="text-[10px] font-medium uppercase tracking-wider text-white/30">{label}</span></div><p className="mt-2 text-xl font-bold">{value}</p></div>;
}
