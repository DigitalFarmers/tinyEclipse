"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Globe, Shield, MessageSquare, Database, Users, Eye, Clock,
  ArrowUpRight, RefreshCw, Copy, Check, TrendingUp,
} from "lucide-react";
import {
  getTenant, getMonitoringDashboard, getAnalytics,
  getConversations, getSources, getEmbedConfig, setupMonitoring,
} from "@/lib/api";

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tenant, setTenant] = useState<any>(null);
  const [monitor, setMonitor] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [embedConfig, setEmbedConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
    } finally { setLoading(false); }
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
        {embedConfig && <div className="mt-3 border-t border-white/5 pt-3"><p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Widget Embed</p><pre className="mt-1 overflow-x-auto rounded-lg bg-black/30 p-2 text-[10px] text-white/50">{`<script src="${embedConfig.widget_url}" data-tenant="${tenant.id}"></script>`}</pre></div>}
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
