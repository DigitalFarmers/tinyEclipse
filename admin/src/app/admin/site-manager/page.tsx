"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Globe, ShoppingCart, FileText, Languages, Mail, RefreshCw,
  Package, TrendingUp, DollarSign, BarChart3, Users, Clock,
  CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  Eye, Send, Inbox, ArrowUpRight, ShieldCheck, Zap, Box,
  Search, Shield, Activity, Brain, Cpu, Link2, EyeOff,
  Settings, LayoutGrid, Palette, Star, ExternalLink, Image,
  Database, WifiOff,
} from "lucide-react";
import {
  getTenants, getTenant, getWpCapabilities, getWpShopStats, getWpProducts,
  getWpOrders, getWpForms, getWpFormSubmissions, getWpmlLanguages,
  getWpMailStatus, getWpContent, getMonitoringDashboard, getMonitoringChecks,
  getBrainHealth, getBrainGaps, getSources, getMotherBrainConfig,
  getDeepAnalytics, getSelfReviewStats, getSecurityAudit,
  triggerFullSync, runMonitoringChecks, scrapeSite,
} from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; plan: string; environment?: string; status?: string; client_account_id?: string; }
type TabKey = "overview" | "shop" | "content" | "languages" | "seo" | "monitoring" | "intelligence" | "settings";

export default function SiteManagerPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [caps, setCaps] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tenantDetail, setTenantDetail] = useState<any>(null);

  useEffect(() => {
    getTenants().then((ts: Tenant[]) => {
      setTenants(ts);
      if (ts.length > 0) setSelectedTenant(ts[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    getWpCapabilities(selectedTenant).then(setCaps).catch(() => setCaps(null));
    getTenant(selectedTenant).then(setTenantDetail).catch(() => setTenantDetail(null));
  }, [selectedTenant]);

  const tenant = tenants.find(t => t.id === selectedTenant);
  const siblings = tenants.filter(t => t.client_account_id && t.client_account_id === tenant?.client_account_id && t.id !== selectedTenant);

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "Overzicht", icon: LayoutGrid },
    { key: "shop", label: "Shop", icon: ShoppingCart },
    { key: "content", label: "Content", icon: FileText },
    { key: "languages", label: "Talen", icon: Languages },
    { key: "seo", label: "SEO & Security", icon: Shield },
    { key: "monitoring", label: "Uptime", icon: Activity },
    { key: "intelligence", label: "AI & Brain", icon: Brain },
    { key: "settings", label: "Instellingen", icon: Settings },
  ];

  if (loading) return <div className="flex min-h-[400px] items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Zap className="h-6 w-6 text-brand-400" /> Site Manager</h1>
          <p className="mt-0.5 text-sm text-white/40">Beheer alles — shop, content, talen, SEO, monitoring & AI</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedTenant} onChange={(e) => { setSelectedTenant(e.target.value); setActiveTab("overview"); }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none focus:border-brand-500/50">
            {tenants.map(t => <option key={t.id} value={t.id} className="bg-brand-950">{t.name} — {t.domain}{t.environment === "staging" ? " (staging)" : ""}</option>)}
          </select>
          {tenant?.domain && <>
            <a href={`https://${tenant.domain}`} target="_blank" rel="noopener" className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"><ExternalLink className="h-3 w-3" /> Live</a>
            <a href={`https://${tenant.domain}/wp-admin`} target="_blank" rel="noopener" className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"><ArrowUpRight className="h-3 w-3" /> WP</a>
          </>}
        </div>
      </div>

      {/* Quick Info Bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {tenant?.environment === "staging"
          ? <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1 text-[10px] font-bold text-yellow-400"><EyeOff className="h-2.5 w-2.5" /> STAGING</span>
          : <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-400"><Globe className="h-2.5 w-2.5" /> PRODUCTIE</span>}
        <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[10px] font-bold text-brand-400 uppercase">{tenant?.plan || "—"}</span>
        {caps && !caps.error && [
          { key: "woocommerce", label: "WooCommerce", v: caps.woo_version },
          { key: "wpml", label: "WPML" }, { key: "fluent_forms", label: "Forms" }, { key: "yoast", label: "Yoast" },
        ].filter(c => caps[c.key]).map(c => (
          <span key={c.key} className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40"><CheckCircle className="h-2.5 w-2.5 text-green-400" /> {c.label}{c.v ? ` v${c.v}` : ""}</span>
        ))}
        {caps?.error && <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] text-red-400"><WifiOff className="h-2.5 w-2.5" /> Connector offline</span>}
        {siblings.length > 0 && <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] text-purple-400"><Link2 className="h-2.5 w-2.5" /> {siblings.length} zustersite{siblings.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-0.5 overflow-x-auto border-b border-white/5 pb-0 scrollbar-hide">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3.5 py-2.5 text-[11px] font-medium transition whitespace-nowrap ${
              activeTab === tab.key ? "bg-white/5 text-white border-b-2 border-brand-500" : "text-white/35 hover:text-white/60 hover:bg-white/[0.02]"
            }`}><tab.icon className="h-3.5 w-3.5" /> {tab.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-5">
        {activeTab === "overview" && <OverviewTab tenantId={selectedTenant} tenant={tenant} siblings={siblings} caps={caps} />}
        {activeTab === "shop" && <ShopTab tenantId={selectedTenant} />}
        {activeTab === "content" && <ContentTab tenantId={selectedTenant} />}
        {activeTab === "languages" && <LanguagesTab tenantId={selectedTenant} />}
        {activeTab === "seo" && <SeoMonitorTab tenantId={selectedTenant} />}
        {activeTab === "monitoring" && <UptimeTab tenantId={selectedTenant} />}
        {activeTab === "intelligence" && <IntelligenceTab tenantId={selectedTenant} tenants={tenants} />}
        {activeTab === "settings" && <SettingsTab tenantId={selectedTenant} tenant={tenant} caps={caps} />}
      </div>
    </div>
  );
}

/* ═══ TAB 1: OVERVIEW ═══ */
function OverviewTab({ tenantId, tenant, siblings, caps }: { tenantId: string; tenant: any; siblings: Tenant[]; caps: any }) {
  const [health, setHealth] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [brainHealth, setBrainHealth] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    if (!tenantId) return;
    getMonitoringDashboard(tenantId).then(setHealth).catch(() => setHealth(null));
    getDeepAnalytics(tenantId, "7d").then(setAnalytics).catch(() => setAnalytics(null));
    getBrainHealth(tenantId).then(setBrainHealth).catch(() => setBrainHealth(null));
  }, [tenantId]);
  const uptimePercent = health?.uptime_24h ?? health?.uptime ?? null;
  const alertCount = health?.open_alerts ?? health?.alerts?.length ?? 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setSyncing(true); triggerFullSync(tenantId).catch(() => {}).finally(() => setSyncing(false)); }} disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600/20 px-3 py-2 text-[11px] font-medium text-brand-400 transition hover:bg-brand-600/30 disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing..." : "Sync Nu"}
        </button>
        <button onClick={() => runMonitoringChecks(tenantId).catch(() => {})}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-medium text-white/50 transition hover:bg-white/10">
          <Shield className="h-3 w-3" /> Run Checks
        </button>
        {tenant?.domain && <a href={`https://${tenant.domain}`} target="_blank" rel="noopener"
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-medium text-white/50 transition hover:bg-white/10"><Eye className="h-3 w-3" /> Bekijk Site</a>}
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniCard icon={Activity} label="Uptime" value={uptimePercent != null ? `${uptimePercent.toFixed(1)}%` : "—"} color={uptimePercent != null && uptimePercent >= 99 ? "green" : "yellow"} />
        <MiniCard icon={AlertTriangle} label="Alerts" value={alertCount} color={alertCount === 0 ? "green" : "red"} />
        <MiniCard icon={Users} label="Sessies (7d)" value={analytics?.summary?.total_sessions ?? "—"} color="brand" />
        <MiniCard icon={Brain} label="AI Health" value={brainHealth?.health_score != null ? `${brainHealth.health_score}/100` : "—"} color={brainHealth?.health_score >= 70 ? "green" : "brand"} />
      </div>
      {siblings.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/25"><Link2 className="h-3 w-3" /> Zuster Sites</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {siblings.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.environment === "staging" ? "bg-yellow-500/10" : "bg-green-500/10"}`}>
                    {s.environment === "staging" ? <EyeOff className="h-4 w-4 text-yellow-400" /> : <Globe className="h-4 w-4 text-green-400" />}
                  </div>
                  <div><p className="text-[11px] font-semibold">{s.name}</p><p className="text-[10px] text-white/30">{s.domain}</p></div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${s.status === "active" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/30"}`}>{s.status || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {caps && !caps.error && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Technische Stack</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "woocommerce", label: "WooCommerce", v: caps.woo_version, icon: ShoppingCart },
              { key: "wpml", label: "WPML", icon: Languages },
              { key: "fluent_forms", label: "Fluent Forms", icon: FileText },
              { key: "fluent_smtp", label: "FluentSMTP", icon: Mail },
              { key: "wp_mail_smtp", label: "WP Mail SMTP", icon: Send },
              { key: "elementor", label: "Elementor", icon: Palette },
              { key: "yoast", label: "Yoast SEO", icon: Search },
              { key: "job_manager", label: "Job Manager", icon: Users },
            ].map(c => (
              <div key={c.key} className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${caps[c.key] ? "border-green-500/10 bg-green-500/5" : "border-white/5 bg-white/[0.01] opacity-40"}`}>
                <c.icon className={`h-4 w-4 ${caps[c.key] ? "text-green-400" : "text-white/20"}`} />
                <div><p className="text-[11px] font-medium">{c.label}</p><p className="text-[9px] text-white/30">{caps[c.key] ? (c.v ? `v${c.v}` : "Actief") : "Niet actief"}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 2: SHOP ═══ */
function ShopTab({ tenantId }: { tenantId: string }) {
  const [subTab, setSubTab] = useState<"stats" | "products" | "orders">("stats");
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any>(null);
  const [orders, setOrders] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [searchQ, setSearchQ] = useState("");
  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      getWpShopStats(tenantId, days).catch(() => null),
      getWpProducts(tenantId).catch(() => null),
      getWpOrders(tenantId).catch(() => null),
    ]).then(([s, p, o]) => { setStats(s); setProducts(p); setOrders(o); });
  }, [tenantId, days]);

  if (!stats && !products) return <EmptyState icon={ShoppingCart} text="WooCommerce data niet beschikbaar" sub="Connector plugin niet bereikbaar of WooCommerce niet actief" />;

  const filteredProducts = products?.products?.filter((p: any) => !searchQ || p.name.toLowerCase().includes(searchQ.toLowerCase())) || [];
  const filteredOrders = orders?.orders?.filter((o: any) => !searchQ || o.customer?.toLowerCase().includes(searchQ.toLowerCase()) || String(o.id).includes(searchQ)) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(["stats", "products", "orders"] as const).map(k => (
            <button key={k} onClick={() => { setSubTab(k); setSearchQ(""); }}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${subTab === k ? "bg-brand-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
              {k === "stats" ? "Dashboard" : k === "products" ? `Producten (${products?.total || 0})` : `Bestellingen (${orders?.orders?.length || 0})`}
            </button>
          ))}
        </div>
        {subTab !== "stats" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/20" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Zoek..."
              className="rounded-lg border border-white/10 bg-white/5 py-1.5 pl-7 pr-3 text-[11px] text-white/70 outline-none placeholder:text-white/20 w-48" />
          </div>
        )}
      </div>
      {subTab === "stats" && stats && (
        <div>
          <div className="flex gap-1.5 mb-4">
            {[7, 30, 90, 365].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${days === d ? "bg-brand-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>{d}d</button>
            ))}
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
            <StatCard icon={DollarSign} label="Omzet" value={`€${(stats.revenue || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2 })}`} color="green" />
            <StatCard icon={ShoppingCart} label="Bestellingen" value={stats.order_count || 0} sub={`Gem. €${(stats.avg_order_value || 0).toFixed(2)}`} color="brand" />
            <StatCard icon={Package} label="Producten" value={stats.product_count || 0} color="purple" />
            <StatCard icon={TrendingUp} label="Gem. bestelling" value={`€${(stats.avg_order_value || 0).toFixed(2)}`} color="blue" />
          </div>
          {stats.top_products?.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Top Producten</h3>
              <div className="space-y-1.5">
                {stats.top_products.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-400">#{i + 1}</span>
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <span className="text-xs text-white/40">{p.quantity}x · {p.orders} orders</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {subTab === "products" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.slice(0, 60).map((p: any) => (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-white/10 transition">
              {p.image ? <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover bg-white/5 flex-shrink-0" />
                : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 flex-shrink-0"><Image className="h-5 w-5 text-white/15" /></div>}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-brand-400">€{p.price}</span>
                  {p.sale_price && <span className="text-[10px] text-white/30 line-through">€{p.regular_price}</span>}
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${p.stock_status === "instock" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {p.stock_status === "instock" ? "Op voorraad" : "Uitverkocht"}
                  </span>
                </div>
                <p className="text-[10px] text-white/25 mt-0.5">{p.total_sales || 0}x verkocht</p>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && <div className="col-span-full text-center text-xs text-white/25 py-8">Geen producten gevonden</div>}
        </div>
      )}
      {subTab === "orders" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-white/5 text-left text-white/30">
              <th className="pb-2 pr-4">#</th><th className="pb-2 pr-4">Klant</th><th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Totaal</th><th className="pb-2 pr-4">Items</th><th className="pb-2">Datum</th>
            </tr></thead>
            <tbody>
              {filteredOrders.slice(0, 50).map((o: any) => (
                <tr key={o.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-2 pr-4 font-mono text-white/50">#{o.id}</td>
                  <td className="py-2 pr-4"><div className="font-medium">{o.customer}</div><div className="text-[10px] text-white/30">{o.email}</div></td>
                  <td className="py-2 pr-4"><OrderBadge status={o.status} /></td>
                  <td className="py-2 pr-4 font-semibold">€{parseFloat(o.total || 0).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-white/40">{o.items_count}</td>
                  <td className="py-2 text-white/30">{new Date(o.created_at).toLocaleDateString("nl-BE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && <div className="text-center text-xs text-white/25 py-8">Geen bestellingen</div>}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 3: CONTENT ═══ */
function ContentTab({ tenantId }: { tenantId: string }) {
  const [contentType, setContentType] = useState<"page" | "post" | "product">("page");
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    getWpContent(tenantId, contentType).then(setContent).catch(() => setContent(null)).finally(() => setLoading(false));
  }, [tenantId, contentType]);
  return (
    <div>
      <div className="flex gap-1 mb-4">
        {([["page", "Pagina's"], ["post", "Berichten"], ["product", "Producten"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setContentType(key)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${contentType === key ? "bg-brand-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>{label}</button>
        ))}
      </div>
      {loading ? <Spinner /> : content?.items?.length > 0 ? (
        <div className="space-y-1.5">
          {content.items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 hover:border-white/10 transition">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-semibold truncate">{item.title || "(Geen titel)"}</p>
                  {item.language && <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold text-purple-400 uppercase">{item.language}</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                  <span>{item.status || "published"}</span>
                  {item.slug && <span className="font-mono">/{item.slug}</span>}
                  {item.modified && <span>{new Date(item.modified).toLocaleDateString("nl-BE")}</span>}
                </div>
              </div>
              {item.link && <a href={item.link} target="_blank" rel="noopener" className="rounded-lg p-1.5 text-white/20 hover:bg-white/5 hover:text-white/60 transition"><ExternalLink className="h-3 w-3" /></a>}
            </div>
          ))}
        </div>
      ) : <EmptyState icon={FileText} text="Geen content gevonden" sub="Connector niet bereikbaar of geen content" />}
    </div>
  );
}

/* ═══ TAB 4: LANGUAGES (WPML + Forms + Mail) ═══ */
function LanguagesTab({ tenantId }: { tenantId: string }) {
  const [wpml, setWpml] = useState<any>(null);
  const [forms, setForms] = useState<any>(null);
  const [mailStatus, setMailStatus] = useState<any>(null);
  const [subTab, setSubTab] = useState<"wpml" | "forms" | "mail">("wpml");
  const [selectedForm, setSelectedForm] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<any>(null);
  useEffect(() => {
    if (!tenantId) return;
    getWpmlLanguages(tenantId).then(setWpml).catch(() => setWpml(null));
    getWpForms(tenantId).then(setForms).catch(() => setForms(null));
    getWpMailStatus(tenantId).then(setMailStatus).catch(() => setMailStatus(null));
  }, [tenantId]);
  async function loadSubs(formId: number) { setSelectedForm(formId); try { setSubmissions(await getWpFormSubmissions(tenantId, formId)); } catch { setSubmissions(null); } }
  return (
    <div>
      <div className="flex gap-1 mb-4">
        {([["wpml", "WPML / Talen"], ["forms", `Formulieren (${forms?.total || 0})`], ["mail", "E-mail"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSubTab(k as any)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${subTab === k ? "bg-brand-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>{l}</button>
        ))}
      </div>
      {/* WPML */}
      {subTab === "wpml" && (wpml && wpml.active !== false ? (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm font-semibold">Actieve talen: {wpml.total}</span>
            <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-medium text-purple-400">Standaard: {wpml.default_language?.toUpperCase()}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {wpml.languages?.map((lang: any) => (
              <div key={lang.code} className={`rounded-xl border p-4 ${lang.code === wpml.default_language ? "border-purple-500/20 bg-purple-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="text-lg font-bold">{lang.code.toUpperCase()}</span><span className="text-sm text-white/60">{lang.name}</span></div>
                  {lang.code === wpml.default_language && <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-400">DEFAULT</span>}
                </div>
                {lang.missing > 0 && <p className="mt-2 text-[11px] text-yellow-400"><AlertTriangle className="mr-1 inline h-3 w-3" /> {lang.missing} ontbrekend</p>}
                {lang.url && <a href={lang.url} target="_blank" rel="noopener" className="mt-2 flex items-center gap-1 text-[10px] text-brand-400"><ExternalLink className="h-2.5 w-2.5" /> {lang.url}</a>}
              </div>
            ))}
          </div>
        </div>
      ) : <EmptyState icon={Languages} text="WPML niet geïnstalleerd" sub="Installeer WPML om meertaligheid te beheren" />)}
      {/* Forms */}
      {subTab === "forms" && (forms && forms.active !== false ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-1.5">
            {forms.forms?.map((f: any) => (
              <button key={f.id} onClick={() => loadSubs(f.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedForm === f.id ? "border-green-500/30 bg-green-500/5" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold">{f.title}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${f.status === "published" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/30"}`}>{f.status}</span>
                </div>
                <p className="mt-1 text-[10px] text-white/30">{f.submissions} inzendingen</p>
              </button>
            ))}
          </div>
          <div className="lg:col-span-3">
            {submissions ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {submissions.submissions?.map((s: any) => (
                  <div key={s.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-white/30">#{s.serial || s.id}</span>
                      <span className="text-[10px] text-white/25">{new Date(s.created_at).toLocaleString("nl-BE")}</span>
                    </div>
                    <div className="grid gap-1">
                      {Object.entries(s.fields || {}).slice(0, 8).map(([key, val]: [string, any]) => (
                        <div key={key} className="flex gap-2 text-[11px]"><span className="text-white/30 min-w-[80px] truncate">{key}:</span><span className="text-white/70 truncate">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="flex h-full min-h-[250px] items-center justify-center rounded-xl border border-dashed border-white/10"><p className="text-xs text-white/25">Selecteer een formulier</p></div>}
          </div>
        </div>
      ) : <EmptyState icon={FileText} text="Fluent Forms niet beschikbaar" sub="Installeer Fluent Forms" />)}
      {/* Mail */}
      {subTab === "mail" && (mailStatus ? (
        <div>
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${mailStatus.smtp_active ? "bg-green-500/10" : "bg-red-500/10"}`}>
              {mailStatus.smtp_active ? <CheckCircle className="h-5 w-5 text-green-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
            </div>
            <div><h3 className="text-sm font-bold">{mailStatus.smtp_active ? "SMTP Actief" : "Geen SMTP"}</h3><p className="text-[11px] text-white/40">{mailStatus.smtp_plugin || "WordPress standaard mail"}</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs font-semibold mb-1">Admin E-mail</p><p className="text-sm font-mono text-white/70">{mailStatus.admin_email || "—"}</p></div>
            {mailStatus.woo_email && <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs font-semibold mb-1">WooCommerce E-mail</p><p className="text-sm font-mono text-white/70">{mailStatus.woo_email}</p></div>}
          </div>
          {mailStatus.smtp_connections?.length > 0 && (
            <div className="mt-4 space-y-2">
              {mailStatus.smtp_connections.map((conn: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-3"><Send className="h-4 w-4 text-green-400" /><div><p className="text-[11px] font-semibold">{conn.from_email || conn.sender}</p><p className="text-[10px] text-white/30">{conn.provider}</p></div></div>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : <EmptyState icon={Mail} text="Mail status niet beschikbaar" sub="Connector niet bereikbaar" />)}
    </div>
  );
}

/* ═══ TAB 5: SEO & SECURITY ═══ */
function SeoMonitorTab({ tenantId }: { tenantId: string }) {
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    getSecurityAudit(tenantId).then(setAudit).catch(() => setAudit(null)).finally(() => setLoading(false));
  }, [tenantId]);
  if (loading) return <Spinner />;
  if (!audit) return <EmptyState icon={Shield} text="Audit niet beschikbaar" sub="Geen security audit data" />;
  const score = audit.score ?? audit.security_score ?? 0;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <ScoreRing score={score} size={80} />
        <div><h3 className="text-lg font-bold">Security & SEO Audit</h3><p className="text-xs text-white/40">{audit.findings?.length || 0} bevindingen · Grade: {gradeLetter(score)}</p></div>
      </div>
      {audit.findings?.length > 0 && (
        <div className="space-y-2">
          {audit.findings.map((f: any, i: number) => (
            <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${f.severity === "critical" ? "border-red-500/20 bg-red-500/5" : f.severity === "warning" ? "border-yellow-500/20 bg-yellow-500/5" : "border-white/5 bg-white/[0.02]"}`}>
              {f.severity === "critical" ? <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" /> : f.severity === "warning" ? <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" /> : <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />}
              <div><p className="text-[12px] font-semibold">{f.title || f.check || f.name}</p><p className="text-[11px] text-white/40 mt-0.5">{f.description || f.detail || f.message}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 6: UPTIME ═══ */
function UptimeTab({ tenantId }: { tenantId: string }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [checks, setChecks] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    Promise.all([getMonitoringDashboard(tenantId).catch(() => null), getMonitoringChecks(tenantId).catch(() => null)])
      .then(([d, c]) => { setDashboard(d); setChecks(c); }).finally(() => setLoading(false));
  }, [tenantId]);
  if (loading) return <Spinner />;
  if (!dashboard && !checks) return <EmptyState icon={Activity} text="Monitoring niet geconfigureerd" sub="Setup monitoring via het Monitoring menu" />;
  return (
    <div className="space-y-6">
      {dashboard && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <MiniCard icon={Activity} label="Uptime 24h" value={`${(dashboard.uptime_24h ?? 0).toFixed(1)}%`} color={dashboard.uptime_24h >= 99 ? "green" : "yellow"} />
          <MiniCard icon={Clock} label="Response" value={`${dashboard.avg_response_ms ?? 0}ms`} color="brand" />
          <MiniCard icon={AlertTriangle} label="Alerts" value={dashboard.open_alerts ?? 0} color={dashboard.open_alerts === 0 ? "green" : "red"} />
          <MiniCard icon={Shield} label="Checks" value={checks?.length || 0} color="blue" />
        </div>
      )}
      {checks?.length > 0 && (
        <div className="space-y-1.5">
          {checks.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-3">
                {c.status === "healthy" || c.status === "up" ? <CheckCircle className="h-4 w-4 text-green-400" /> : c.status === "degraded" ? <AlertTriangle className="h-4 w-4 text-yellow-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                <div><p className="text-[12px] font-semibold">{c.name || c.type}</p><p className="text-[10px] text-white/30">{c.url || c.target || ""}</p></div>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${c.status === "healthy" || c.status === "up" ? "bg-green-500/20 text-green-400" : c.status === "degraded" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>{c.status}</span>
                {c.response_time_ms && <p className="text-[10px] text-white/25 mt-0.5">{c.response_time_ms}ms</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 7: INTELLIGENCE ═══ */
function IntelligenceTab({ tenantId, tenants }: { tenantId: string; tenants: Tenant[] }) {
  const [subTab, setSubTab] = useState<"health" | "gaps" | "sources" | "review">("health");
  const [brainHealth, setBrainHealth] = useState<any>(null);
  const [gaps, setGaps] = useState<any>(null);
  const [sources, setSources] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    Promise.all([getBrainHealth(tenantId).catch(() => null), getBrainGaps(tenantId).catch(() => null), getSources(tenantId).catch(() => null), getSelfReviewStats(tenantId).catch(() => null)])
      .then(([h, g, s, r]) => { setBrainHealth(h); setGaps(g); setSources(s); setReview(r); }).finally(() => setLoading(false));
  }, [tenantId]);
  if (loading) return <Spinner />;
  const gapList = Array.isArray(gaps) ? gaps : gaps?.gaps || [];
  const sourceList = Array.isArray(sources) ? sources : sources?.sources || [];
  const openGaps = gapList.filter((g: any) => g.status === "open" || !g.status).length;
  const domain = tenants.find(t => t.id === tenantId)?.domain || "";
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {([["health", "Health"], ["gaps", `Lacunes (${openGaps})`], ["sources", `Bronnen (${sourceList.length})`], ["review", "Self-Review"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSubTab(k as any)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${subTab === k ? "bg-brand-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>{l}</button>
          ))}
        </div>
        {domain && <button onClick={() => scrapeSite(tenantId, `https://${domain}`).catch(() => {})}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600/20 px-3 py-1.5 text-[11px] font-medium text-brand-400 hover:bg-brand-600/30 transition"><RefreshCw className="h-3 w-3" /> Re-scrape</button>}
      </div>
      {subTab === "health" && (brainHealth ? (
        <div className="flex items-center gap-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <ScoreRing score={brainHealth.health_score || 0} size={80} />
          <div>
            <h3 className="text-lg font-bold">AI Brain Health</h3>
            <p className="text-xs text-white/40">{gradeLetter(brainHealth.health_score || 0)}</p>
            {brainHealth.suggestions?.slice(0, 3).map((s: string, i: number) => <p key={i} className="text-[11px] text-white/50 mt-1">• {s}</p>)}
          </div>
        </div>
      ) : <EmptyState icon={Brain} text="AI Brain niet beschikbaar" sub="Geen brain data" />)}
      {subTab === "gaps" && (
        <div className="space-y-2">
          {gapList.length > 0 ? gapList.slice(0, 30).map((g: any) => (
            <div key={g.id} className="flex items-start justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold">{g.question || g.topic || g.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${g.status === "open" ? "bg-red-500/20 text-red-400" : g.status === "resolved" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/30"}`}>{g.status || "open"}</span>
                  {g.category && <span className="text-[10px] text-white/25">{g.category}</span>}
                  {g.frequency && <span className="text-[10px] text-white/25">{g.frequency}x</span>}
                </div>
              </div>
            </div>
          )) : <div className="text-center text-xs text-white/25 py-8">Geen kennislacunes</div>}
        </div>
      )}
      {subTab === "sources" && (
        <div className="space-y-2">
          {sourceList.length > 0 ? sourceList.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Database className="h-4 w-4 text-brand-400 flex-shrink-0" />
                <div className="min-w-0"><p className="text-[12px] font-semibold truncate">{s.title || s.url || "(Untitled)"}</p><p className="text-[10px] text-white/30 truncate">{s.type} · {s.chunk_count || 0} chunks</p></div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${s.status === "active" || s.status === "indexed" ? "bg-green-500/20 text-green-400" : s.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/30"}`}>{s.status || "—"}</span>
            </div>
          )) : <EmptyState icon={Database} text="Geen kennisbronnen" sub="Scrape de website of voeg handmatig bronnen toe" />}
        </div>
      )}
      {subTab === "review" && review && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MiniCard icon={Star} label="Gem. Score" value={review.avg_score != null ? `${review.avg_score.toFixed(0)}/100` : "—"} color="brand" />
            <MiniCard icon={Brain} label="Reviews" value={review.total_reviews || 0} color="blue" />
            <MiniCard icon={AlertTriangle} label="Escalaties" value={review.escalation_rate != null ? `${(review.escalation_rate * 100).toFixed(0)}%` : "—"} color="yellow" />
            <MiniCard icon={Languages} label="Taal Issues" value={review.language_issue_rate != null ? `${(review.language_issue_rate * 100).toFixed(0)}%` : "—"} color="purple" />
          </div>
          {review.top_improvements?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/25">Top Verbeterpunten</h4>
              {review.top_improvements.slice(0, 5).map((imp: any, i: number) => <p key={i} className="text-[11px] text-white/50 mb-1">• {typeof imp === "string" ? imp : imp.improvement || JSON.stringify(imp)}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 8: SETTINGS ═══ */
function SettingsTab({ tenantId, tenant, caps }: { tenantId: string; tenant: any; caps: any }) {
  const [mbConfig, setMbConfig] = useState<any>(null);
  useEffect(() => { if (tenantId) getMotherBrainConfig(tenantId).then(setMbConfig).catch(() => setMbConfig(null)); }, [tenantId]);
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-bold mb-3">Site Informatie</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Naam" value={tenant?.name} />
          <InfoRow label="Domein" value={tenant?.domain} />
          <InfoRow label="Plan" value={tenant?.plan?.toUpperCase()} />
          <InfoRow label="Status" value={tenant?.status || "active"} />
          <InfoRow label="Omgeving" value={tenant?.environment || "production"} />
          <InfoRow label="Tenant ID" value={tenantId} mono />
        </div>
      </div>
      {mbConfig && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-brand-400" /> Mother Brain</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Widget Actief" value={mbConfig.widget?.enabled !== false ? "Ja" : "Nee"} />
            <InfoRow label="Widget Kleur" value={mbConfig.widget?.color || "—"} />
            <InfoRow label="Widget Naam" value={mbConfig.widget?.name || "—"} />
            <InfoRow label="Talen" value={mbConfig.languages?.join(", ")?.toUpperCase() || "—"} />
            <InfoRow label="Intelligence" value={mbConfig.mother_brain?.intelligence_version || "—"} />
            <InfoRow label="Plugin Versie" value={mbConfig.mother_brain?.plugin_version || "—"} />
          </div>
          {mbConfig.features && (
            <div className="mt-4">
              <p className="text-xs font-semibold mb-2 text-white/40">Feature Flags</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(mbConfig.features).map(([key, val]: [string, any]) => (
                  <span key={key} className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${val ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/20"}`}>{val ? "✓" : "✗"} {key.replace(/_/g, " ")}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-bold mb-3">Widget Embed Code</h3>
        <div className="rounded-lg bg-black/30 p-3 font-mono text-[11px] text-green-400 overflow-x-auto break-all">
          {`<script src="https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js" data-tenant="${tenantId}" data-api="https://api.tinyeclipse.digitalfarmers.be" data-color="${mbConfig?.widget?.color || "#6C3CE1"}" data-name="${mbConfig?.widget?.name || tenant?.name || "AI"}" data-lang="${mbConfig?.default_language || "nl"}" async></script>`}
        </div>
      </div>
      {caps && !caps.error && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold mb-3">Technische Stack</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="WordPress" value={caps.version} />
            <InfoRow label="PHP" value={caps.php} />
            <InfoRow label="Plugins" value={caps.plugin_count} />
            <InfoRow label="WooCommerce" value={caps.woo_version || "Niet actief"} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ SHARED COMPONENTS ═══ */

function StatCard({ icon: Icon, label, value, sub, color = "brand" }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = { brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20", green: "from-green-500/10 to-green-600/5 border-green-500/20", purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20", blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20" };
  const iconColors: Record<string, string> = { brand: "text-brand-500", green: "text-green-400", purple: "text-purple-400", blue: "text-blue-400" };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 sm:p-4 ${colors[color]}`}>
      <div className="flex items-center gap-1.5"><Icon className={`h-3.5 w-3.5 ${iconColors[color]}`} /><span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span></div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

function MiniCard({ icon: Icon, label, value, color = "brand" }: { icon: any; label: string; value: string | number; color?: string }) {
  const bg: Record<string, string> = { brand: "border-brand-500/20 bg-brand-500/5", green: "border-green-500/20 bg-green-500/5", yellow: "border-yellow-500/20 bg-yellow-500/5", red: "border-red-500/20 bg-red-500/5", blue: "border-blue-500/20 bg-blue-500/5", purple: "border-purple-500/20 bg-purple-500/5" };
  const ic: Record<string, string> = { brand: "text-brand-400", green: "text-green-400", yellow: "text-yellow-400", red: "text-red-400", blue: "text-blue-400", purple: "text-purple-400" };
  return (
    <div className={`rounded-xl border p-3 ${bg[color] || bg.brand}`}>
      <div className="flex items-center gap-1.5"><Icon className={`h-3.5 w-3.5 ${ic[color] || ic.brand}`} /><span className="text-[10px] font-medium text-white/40">{label}</span></div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function OrderBadge({ status }: { status: string }) {
  const m: Record<string, string> = { completed: "bg-green-500/20 text-green-400", processing: "bg-blue-500/20 text-blue-400", "on-hold": "bg-yellow-500/20 text-yellow-400", refunded: "bg-red-500/20 text-red-400", cancelled: "bg-red-500/20 text-red-400" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m[status] || "bg-white/10 text-white/40"}`}>{status}</span>;
}

function InfoRow({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2">
      <span className="text-[11px] text-white/40">{label}</span>
      <span className={`text-[11px] font-medium ${mono ? "font-mono text-[10px]" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#eab308" : pct >= 40 ? "#f97316" : "#ef4444";
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="white" fontSize={size * 0.25} fontWeight="bold">{Math.round(pct)}</text>
    </svg>
  );
}

function gradeLetter(score: number): string {
  if (score >= 95) return "A+"; if (score >= 85) return "A"; if (score >= 75) return "B+";
  if (score >= 65) return "B"; if (score >= 50) return "C"; if (score >= 35) return "D"; return "F";
}

function Spinner() { return <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" /></div>; }

function EmptyState({ icon: Icon, text, sub }: { icon: any; text: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-white/15" />
      <p className="mt-3 text-sm text-white/40">{text}</p>
      <p className="mt-1 text-[11px] text-white/25">{sub}</p>
    </div>
  );
}
