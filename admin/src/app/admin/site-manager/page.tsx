"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe, ShoppingCart, FileText, Languages, Mail, RefreshCw,
  Package, TrendingUp, DollarSign, BarChart3, Users, Clock,
  CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  Eye, Send, Inbox, ArrowUpRight, ShieldCheck, Zap, Box,
} from "lucide-react";
import {
  getTenants, getWpCapabilities, getWpShopStats, getWpProducts,
  getWpOrders, getWpForms, getWpFormSubmissions, getWpmlLanguages,
  getWpMailStatus,
} from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; plan: string; environment?: string; }

export default function SiteManagerPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [activeTab, setActiveTab] = useState<"shop" | "forms" | "wpml" | "mail">("shop");
  const [caps, setCaps] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Shop state
  const [shopStats, setShopStats] = useState<any>(null);
  const [products, setProducts] = useState<any>(null);
  const [orders, setOrders] = useState<any>(null);
  const [shopDays, setShopDays] = useState(30);

  // Forms state
  const [forms, setForms] = useState<any>(null);
  const [selectedForm, setSelectedForm] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<any>(null);

  // WPML state
  const [wpml, setWpml] = useState<any>(null);

  // Mail state
  const [mailStatus, setMailStatus] = useState<any>(null);

  useEffect(() => {
    getTenants().then((ts) => {
      const prod = ts.filter((t: Tenant) => t.environment !== "staging");
      setTenants(prod);
      if (prod.length > 0) setSelectedTenant(prod[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    loadCapabilities();
  }, [selectedTenant]);

  useEffect(() => {
    if (!selectedTenant) return;
    if (activeTab === "shop") loadShop();
    if (activeTab === "forms") loadForms();
    if (activeTab === "wpml") loadWpml();
    if (activeTab === "mail") loadMail();
  }, [selectedTenant, activeTab, shopDays]);

  async function loadCapabilities() {
    try { const c = await getWpCapabilities(selectedTenant); setCaps(c); } catch { setCaps(null); }
  }

  async function loadShop() {
    try {
      const [stats, prods, ords] = await Promise.all([
        getWpShopStats(selectedTenant, shopDays).catch(() => null),
        getWpProducts(selectedTenant).catch(() => null),
        getWpOrders(selectedTenant).catch(() => null),
      ]);
      setShopStats(stats);
      setProducts(prods);
      setOrders(ords);
    } catch {}
  }

  async function loadForms() {
    try {
      const f = await getWpForms(selectedTenant);
      setForms(f);
      setSelectedForm(null);
      setSubmissions(null);
    } catch { setForms(null); }
  }

  async function loadFormSubs(formId: number) {
    setSelectedForm(formId);
    try {
      const s = await getWpFormSubmissions(selectedTenant, formId);
      setSubmissions(s);
    } catch { setSubmissions(null); }
  }

  async function loadWpml() {
    try { const w = await getWpmlLanguages(selectedTenant); setWpml(w); } catch { setWpml(null); }
  }

  async function loadMail() {
    try { const m = await getWpMailStatus(selectedTenant); setMailStatus(m); } catch { setMailStatus(null); }
  }

  const tenant = tenants.find(t => t.id === selectedTenant);

  const tabs = [
    { key: "shop" as const, label: "Webshop", icon: ShoppingCart, color: "brand" },
    { key: "forms" as const, label: "Formulieren", icon: FileText, color: "green" },
    { key: "wpml" as const, label: "Talen", icon: Languages, color: "purple" },
    { key: "mail" as const, label: "E-mail", icon: Mail, color: "blue" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="h-6 w-6 text-brand-400" /> Site Manager
          </h1>
          <p className="mt-0.5 text-sm text-white/40">WooCommerce, Formulieren, Talen & E-mail beheer</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none"
          >
            {tenants.map(t => <option key={t.id} value={t.id} className="bg-brand-950">{t.name} — {t.domain}</option>)}
          </select>
          {tenant?.domain && (
            <a href={`https://${tenant.domain}/wp-admin`} target="_blank" rel="noopener"
              className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white">
              <ArrowUpRight className="h-3 w-3" /> WP Admin
            </a>
          )}
        </div>
      </div>

      {/* Capabilities Banner */}
      {caps && !caps.error && (
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: "woocommerce", label: "WooCommerce", v: caps.woo_version },
            { key: "wpml", label: "WPML" },
            { key: "fluent_forms", label: "Fluent Forms" },
            { key: "fluent_smtp", label: "FluentSMTP" },
            { key: "wp_mail_smtp", label: "WP Mail SMTP" },
            { key: "elementor", label: "Elementor" },
            { key: "yoast", label: "Yoast SEO" },
            { key: "job_manager", label: "Job Manager" },
          ].filter(c => caps[c.key]).map(c => (
            <span key={c.key} className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-medium text-green-400">
              <CheckCircle className="h-2.5 w-2.5" /> {c.label} {c.v ? `v${c.v}` : ""}
            </span>
          ))}
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/30">
            WP {caps.version} · PHP {caps.php} · {caps.plugin_count} plugins
          </span>
        </div>
      )}
      {caps?.error && (
        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-400">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
          Connector v3 niet bereikbaar — installeer de TinyEclipse Connector plugin op {tenant?.domain}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-5 flex gap-1.5 border-b border-white/5 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-xs font-medium transition ${
              activeTab === tab.key
                ? "bg-white/5 text-white border-b-2 border-brand-500"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.02]"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-5">
        {activeTab === "shop" && <ShopTab stats={shopStats} products={products} orders={orders} days={shopDays} setDays={setShopDays} />}
        {activeTab === "forms" && <FormsTab forms={forms} selectedForm={selectedForm} submissions={submissions} onSelectForm={loadFormSubs} />}
        {activeTab === "wpml" && <WpmlTab data={wpml} />}
        {activeTab === "mail" && <MailTab data={mailStatus} />}
      </div>
    </div>
  );
}

/* ─── Shop Tab ─── */
function ShopTab({ stats, products, orders, days, setDays }: any) {
  if (!stats && !products) {
    return <EmptyState icon={ShoppingCart} text="WooCommerce data niet beschikbaar" sub="Zorg dat de Connector plugin actief is en WooCommerce geïnstalleerd" />;
  }
  if (stats?.active === false) {
    return <EmptyState icon={ShoppingCart} text="WooCommerce niet geïnstalleerd" sub="Installeer WooCommerce op deze site" />;
  }

  return (
    <div>
      {/* Period selector */}
      <div className="flex gap-1.5 mb-4">
        {[7, 30, 90, 365].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${days === d ? "bg-brand-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
            {d}d
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
          <StatCard icon={DollarSign} label="Omzet" value={`€${(stats.revenue || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2 })}`} color="green" />
          <StatCard icon={ShoppingCart} label="Bestellingen" value={stats.order_count || 0} sub={`Gem. €${(stats.avg_order_value || 0).toFixed(2)}`} color="brand" />
          <StatCard icon={Package} label="Producten" value={stats.product_count || 0} color="purple" />
          <StatCard icon={TrendingUp} label="Gem. bestelling" value={`€${(stats.avg_order_value || 0).toFixed(2)}`} color="blue" />
        </div>
      )}

      {/* Top Products */}
      {stats?.top_products?.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Top Producten</h3>
          <div className="space-y-1.5">
            {stats.top_products.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-400">#{i + 1}</span>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span>{p.quantity}x verkocht</span>
                  <span>{p.orders} orders</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {orders?.orders?.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Recente Bestellingen</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-left text-white/30">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Klant</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Totaal</th>
                  <th className="pb-2 pr-4">Items</th>
                  <th className="pb-2">Datum</th>
                </tr>
              </thead>
              <tbody>
                {orders.orders.slice(0, 20).map((o: any) => (
                  <tr key={o.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 pr-4 font-mono text-white/50">#{o.id}</td>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{o.customer}</div>
                      <div className="text-[10px] text-white/30">{o.email}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        o.status === "completed" ? "bg-green-500/20 text-green-400"
                        : o.status === "processing" ? "bg-blue-500/20 text-blue-400"
                        : o.status === "on-hold" ? "bg-yellow-500/20 text-yellow-400"
                        : o.status === "refunded" ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 text-white/40"
                      }`}>{o.status}</span>
                    </td>
                    <td className="py-2 pr-4 font-semibold">€{parseFloat(o.total).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-white/40">{o.items_count}</td>
                    <td className="py-2 text-white/30">{new Date(o.created_at).toLocaleDateString("nl-BE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {products?.products?.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">Alle Producten ({products.total})</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {products.products.slice(0, 30).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                {p.image && <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover bg-white/5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-bold text-brand-400">€{p.price}</span>
                    {p.sale_price && <span className="text-[10px] text-white/30 line-through">€{p.regular_price}</span>}
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                      p.stock_status === "instock" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}>{p.stock_status === "instock" ? "Op voorraad" : "Uitverkocht"}</span>
                  </div>
                  <p className="text-[10px] text-white/25 mt-0.5">{p.total_sales}x verkocht</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Forms Tab ─── */
function FormsTab({ forms, selectedForm, submissions, onSelectForm }: any) {
  if (!forms || forms?.active === false) {
    return <EmptyState icon={FileText} text="Fluent Forms niet beschikbaar" sub="Installeer Fluent Forms op deze WordPress site" />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Forms List */}
      <div className="lg:col-span-2 space-y-1.5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/25">Formulieren ({forms.total})</h3>
        {forms.forms?.map((f: any) => (
          <button
            key={f.id}
            onClick={() => onSelectForm(f.id)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              selectedForm === f.id ? "border-green-500/30 bg-green-500/5" : "border-white/5 bg-white/[0.02] hover:border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold">{f.title}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                f.status === "published" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/30"
              }`}>{f.status}</span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-[10px] text-white/30">
              <span>{f.submissions} inzendingen</span>
              {f.last_submission && <span>Laatste: {new Date(f.last_submission).toLocaleDateString("nl-BE")}</span>}
            </div>
          </button>
        ))}
        {(!forms.forms || forms.forms.length === 0) && (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
            <FileText className="mx-auto h-5 w-5 text-white/15" />
            <p className="mt-2 text-[11px] text-white/30">Geen formulieren gevonden</p>
          </div>
        )}
      </div>

      {/* Submissions */}
      <div className="lg:col-span-3">
        {submissions ? (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">
              Inzendingen ({submissions.total})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {submissions.submissions?.map((s: any) => (
                <div key={s.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-white/30">#{s.serial || s.id}</span>
                    <span className="text-[10px] text-white/25">{new Date(s.created_at).toLocaleString("nl-BE")}</span>
                  </div>
                  <div className="grid gap-1">
                    {Object.entries(s.fields || {}).slice(0, 8).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex gap-2 text-[11px]">
                        <span className="text-white/30 min-w-[80px] truncate">{key}:</span>
                        <span className="text-white/70 truncate">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-white/10">
            <div className="text-center">
              <FileText className="mx-auto h-6 w-6 text-white/10" />
              <p className="mt-2 text-xs text-white/25">Selecteer een formulier</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── WPML Tab ─── */
function WpmlTab({ data }: { data: any }) {
  if (!data || data?.active === false) {
    return <EmptyState icon={Languages} text="WPML niet geïnstalleerd" sub="Installeer WPML om meertaligheid te beheren vanuit Eclipse" />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-semibold">Actieve talen: {data.total}</span>
        <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-medium text-purple-400">
          Standaard: {data.default_language?.toUpperCase()}
        </span>
        {data.total > 3 && (
          <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-medium text-yellow-400">
            <AlertTriangle className="mr-1 inline h-2.5 w-2.5" /> Max 3 talen aanbevolen
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.languages?.map((lang: any) => (
          <div key={lang.code} className={`rounded-xl border p-4 ${
            lang.code === data.default_language
              ? "border-purple-500/20 bg-purple-500/5"
              : lang.active ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-50"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{lang.code.toUpperCase()}</span>
                <span className="text-sm text-white/60">{lang.name}</span>
              </div>
              {lang.code === data.default_language && (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-400">DEFAULT</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-white/30">{lang.english_name}</p>
            {lang.missing > 0 && (
              <p className="mt-2 text-[11px] text-yellow-400">
                <AlertTriangle className="mr-1 inline h-3 w-3" /> {lang.missing} ontbrekende vertalingen
              </p>
            )}
            {lang.url && (
              <a href={lang.url} target="_blank" rel="noopener" className="mt-2 flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300">
                <ArrowUpRight className="h-2.5 w-2.5" /> {lang.url}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Mail Tab ─── */
function MailTab({ data }: { data: any }) {
  if (!data) {
    return <EmptyState icon={Mail} text="Mail status niet beschikbaar" sub="Connector plugin niet bereikbaar" />;
  }

  return (
    <div>
      {/* SMTP Status */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            data.smtp_active ? "bg-green-500/10" : "bg-red-500/10"
          }`}>
            {data.smtp_active
              ? <CheckCircle className="h-5 w-5 text-green-400" />
              : <XCircle className="h-5 w-5 text-red-400" />}
          </div>
          <div>
            <h3 className="text-sm font-bold">
              {data.smtp_active ? "SMTP Actief" : "Geen SMTP geconfigureerd"}
            </h3>
            <p className="text-[11px] text-white/40">
              {data.smtp_plugin || "WordPress standaard mail (niet betrouwbaar)"}
            </p>
          </div>
        </div>

        {!data.smtp_active && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-red-400" />
            Zonder SMTP plugin kunnen mails in spam belanden. Installeer FluentSMTP of WP Mail SMTP.
          </div>
        )}
      </div>

      {/* Email Addresses */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold">Admin E-mail</span>
          </div>
          <p className="text-sm font-mono text-white/70">{data.admin_email || "—"}</p>
        </div>
        {data.woo_email && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-brand-400" />
              <span className="text-xs font-semibold">WooCommerce E-mail</span>
            </div>
            <p className="text-sm font-mono text-white/70">{data.woo_email}</p>
          </div>
        )}
      </div>

      {/* SMTP Connections */}
      {data.smtp_connections?.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">SMTP Verbindingen</h3>
          <div className="space-y-2">
            {data.smtp_connections.map((conn: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <Send className="h-4 w-4 text-green-400" />
                  <div>
                    <p className="text-[11px] font-semibold">{conn.from_email || conn.sender}</p>
                    <p className="text-[10px] text-white/30">Provider: {conn.provider}</p>
                  </div>
                </div>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ─── */
function StatCard({ icon: Icon, label, value, sub, color = "brand" }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20",
    green: "from-green-500/10 to-green-600/5 border-green-500/20",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
  };
  const iconColors: Record<string, string> = {
    brand: "text-brand-500", green: "text-green-400", purple: "text-purple-400", blue: "text-blue-400",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 sm:p-4 ${colors[color]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColors[color]}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, text, sub }: { icon: any; text: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-white/15" />
      <p className="mt-3 text-sm text-white/40">{text}</p>
      <p className="mt-1 text-[11px] text-white/25">{sub}</p>
    </div>
  );
}
