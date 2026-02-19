"use client";

import { useEffect, useState, useRef } from "react";
import {
  Zap, Send, Globe, RefreshCw, ShoppingCart, FileText, Settings,
  Database, ArrowUpRight, CheckCircle, XCircle, Loader2, Terminal,
} from "lucide-react";
import {
  getTenants, getWpCapabilities, getWpContent, getWpProducts,
  getWpOrders, getWpShopStats, getSources, getContacts,
  triggerFullSync, updateWpPage, updateWpProduct, updateWpOrderStatus,
  getModuleEvents,
} from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; plan: string; environment?: string; }

interface CommandResult {
  type: "info" | "success" | "error" | "data";
  message: string;
  data?: any;
}

export default function CommanderPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ command: string; results: CommandResult[] }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTenants().then((ts) => {
      const prod = ts.filter((t: Tenant) => t.environment !== "staging");
      setTenants(prod);
      if (prod.length > 0) setSelectedTenant(prod[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  async function executeCommand() {
    if (!input.trim() || !selectedTenant || loading) return;
    const cmd = input.trim();
    setInput("");
    setLoading(true);

    const entry: { command: string; results: CommandResult[] } = { command: cmd, results: [] };
    const add = (r: CommandResult) => { entry.results.push(r); };

    try {
      const lower = cmd.toLowerCase();

      // ─── Status / Capabilities ───
      if (lower.includes("status") || lower.includes("capabilities") || lower.includes("info")) {
        add({ type: "info", message: "Site capabilities ophalen..." });
        const caps = await getWpCapabilities(selectedTenant).catch(() => null);
        if (caps && !caps.error) {
          add({ type: "success", message: `WordPress ${caps.version} | PHP ${caps.php} | Theme: ${caps.theme}` });
          add({ type: "data", message: `WooCommerce: ${caps.woocommerce ? "✅ " + (caps.woo_version || "") : "❌"} | WPML: ${caps.wpml ? "✅" : "❌"} | Forms: ${caps.fluent_forms ? "✅" : "❌"}` });
          add({ type: "data", message: `Plugins: ${caps.plugin_count} | Locale: ${caps.locale} | Timezone: ${caps.timezone}` });
        } else {
          add({ type: "error", message: "Connector niet bereikbaar — installeer TinyEclipse Connector v4 op de site" });
        }
      }
      // ─── Sync ───
      else if (lower.includes("sync") || lower.includes("synchron")) {
        add({ type: "info", message: "Full sync triggeren..." });
        const result = await triggerFullSync(selectedTenant).catch(() => null);
        if (result && !result.error) {
          add({ type: "success", message: `Sync voltooid: ${result.orders || 0} orders, ${result.customers || 0} klanten, ${result.form_submissions || 0} formulieren, ${result.users || 0} users, ${result.comments || 0} comments` });
        } else {
          add({ type: "error", message: "Sync mislukt — connector niet bereikbaar of niet v4" });
        }
      }
      // ─── Orders ───
      else if (lower.includes("order") || lower.includes("bestelling")) {
        add({ type: "info", message: "Bestellingen ophalen..." });
        const orders = await getWpOrders(selectedTenant, 20).catch(() => null);
        if (orders?.orders) {
          add({ type: "success", message: `${orders.total} bestellingen gevonden` });
          for (const o of orders.orders.slice(0, 8)) {
            add({ type: "data", message: `#${o.id} — ${o.customer} — €${o.total} — ${o.status} — ${o.created_at?.split("T")[0] || ""}` });
          }
        } else {
          add({ type: "error", message: "Geen bestellingen of WooCommerce niet actief" });
        }
      }
      // ─── Products ───
      else if (lower.includes("product")) {
        add({ type: "info", message: "Producten ophalen..." });
        const prods = await getWpProducts(selectedTenant, 50).catch(() => null);
        if (prods?.products) {
          add({ type: "success", message: `${prods.total} producten gevonden` });
          for (const p of prods.products.slice(0, 10)) {
            add({ type: "data", message: `${p.name} — €${p.price} — ${p.stock_status} — ${p.total_sales} verkocht` });
          }
        } else {
          add({ type: "error", message: "Geen producten of WooCommerce niet actief" });
        }
      }
      // ─── Revenue / Stats ───
      else if (lower.includes("omzet") || lower.includes("revenue") || lower.includes("stats")) {
        add({ type: "info", message: "Shop statistieken ophalen..." });
        const stats = await getWpShopStats(selectedTenant, 30).catch(() => null);
        if (stats?.active) {
          add({ type: "success", message: `Omzet (30d): €${stats.revenue} | Orders: ${stats.order_count} | Gem: €${stats.avg_order_value}` });
          add({ type: "data", message: `Producten: ${stats.product_count} | Top: ${stats.top_products?.slice(0, 3).map((p: any) => p.name).join(", ") || "—"}` });
        } else {
          add({ type: "error", message: "Shop stats niet beschikbaar" });
        }
      }
      // ─── Pages / Content ───
      else if (lower.includes("pagina") || lower.includes("page") || lower.includes("content")) {
        add({ type: "info", message: "Pagina's ophalen..." });
        const content = await getWpContent(selectedTenant, "page", 50).catch(() => null);
        if (content?.items) {
          add({ type: "success", message: `${content.total} pagina's gevonden` });
          for (const p of content.items.slice(0, 10)) {
            add({ type: "data", message: `[${p.id}] ${p.title} — ${p.status} — ${p.url}` });
          }
        } else {
          add({ type: "error", message: "Content niet beschikbaar — connector v4 nodig" });
        }
      }
      // ─── Knowledge Base ───
      else if (lower.includes("kennis") || lower.includes("knowledge") || lower.includes("bron")) {
        add({ type: "info", message: "Knowledge base ophalen..." });
        const sources = await getSources(selectedTenant).catch(() => []);
        const indexed = sources.filter((s: any) => s.status === "indexed").length;
        add({ type: "success", message: `${sources.length} bronnen totaal, ${indexed} geïndexeerd` });
      }
      // ─── Contacts ───
      else if (lower.includes("contact") || lower.includes("klant") || lower.includes("customer")) {
        const searchTerm = cmd.replace(/.*?(contact|klant|customer)\w*\s*/i, "").trim();
        add({ type: "info", message: searchTerm ? `Zoeken naar "${searchTerm}"...` : "Contacten ophalen..." });
        const contacts = await getContacts(selectedTenant, searchTerm || undefined, 10).catch(() => []);
        if (contacts.length > 0) {
          add({ type: "success", message: `${contacts.length} contacten gevonden` });
          for (const c of contacts) {
            add({ type: "data", message: `${c.name || "?"} — ${c.email || "?"} — ${c.phone || "?"} — ${c.total_orders} orders — €${(c.total_spent || 0).toFixed(0)}` });
          }
        } else {
          add({ type: "info", message: "Geen contacten gevonden" });
        }
      }
      // ─── Events ───
      else if (lower.includes("event") || lower.includes("activiteit") || lower.includes("timeline")) {
        add({ type: "info", message: "Module events ophalen..." });
        const events = await getModuleEvents(selectedTenant, 168).catch(() => []);
        if (Array.isArray(events) && events.length > 0) {
          add({ type: "success", message: `${events.length} events (7 dagen)` });
          for (const e of events.slice(0, 10)) {
            add({ type: "data", message: `${e.event_type} — ${e.title} — ${e.created_at?.split("T")[0] || ""}` });
          }
        } else {
          add({ type: "info", message: "Geen recente events" });
        }
      }
      // ─── Help ───
      else {
        add({ type: "info", message: "Beschikbare commando's:" });
        add({ type: "data", message: "status — Site capabilities en connector status" });
        add({ type: "data", message: "sync — Full data sync triggeren" });
        add({ type: "data", message: "orders — Recente bestellingen bekijken" });
        add({ type: "data", message: "products — Alle producten bekijken" });
        add({ type: "data", message: "omzet / revenue — Shop statistieken" });
        add({ type: "data", message: "paginas / content — Alle pagina's" });
        add({ type: "data", message: "kennis / knowledge — Knowledge base status" });
        add({ type: "data", message: "contact [zoekterm] — Contacten zoeken" });
        add({ type: "data", message: "events — Recente module events" });
      }
    } catch (e: any) {
      add({ type: "error", message: `Fout: ${e.message}` });
    }

    setHistory(prev => [...prev, entry]);
    setLoading(false);
  }

  const tenant = tenants.find(t => t.id === selectedTenant);

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Terminal className="h-6 w-6 text-brand-400" /> Site Commander
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Bestuur elke site met commando's — lees, schrijf, sync</p>
        </div>
        <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
          {tenants.map(t => <option key={t.id} value={t.id} className="bg-brand-950">{t.name} ({t.domain})</option>)}
        </select>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="mt-4 flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-black/30 p-4 font-mono text-xs">
        {history.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Terminal className="mx-auto h-10 w-10 text-brand-500/20" />
              <p className="mt-3 text-sm text-white/30">Eclipse Site Commander</p>
              <p className="mt-1 text-[11px] text-white/20">Typ een commando of "help" voor opties</p>
              {tenant && <p className="mt-2 text-[10px] text-brand-400/50">Verbonden met {tenant.name} ({tenant.domain})</p>}
            </div>
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i} className="mb-4">
            <div className="flex items-center gap-2 text-brand-400">
              <span className="text-white/30">$</span>
              <span className="font-semibold">{entry.command}</span>
            </div>
            {entry.results.map((r, j) => (
              <div key={j} className={`mt-1 pl-4 ${
                r.type === "success" ? "text-green-400" :
                r.type === "error" ? "text-red-400" :
                r.type === "data" ? "text-white/60" :
                "text-white/40"
              }`}>
                {r.type === "success" && <span className="mr-1">✓</span>}
                {r.type === "error" && <span className="mr-1">✗</span>}
                {r.type === "info" && <span className="mr-1">→</span>}
                {r.type === "data" && <span className="mr-1">  </span>}
                {r.message}
              </div>
            ))}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-white/30">
            <Loader2 className="h-3 w-3 animate-spin" /> Uitvoeren...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); executeCommand(); }} className="mt-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4">
          <span className="text-xs text-brand-400 font-mono">$</span>
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={`Commando voor ${tenant?.name || "site"}...`}
            className="flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder-white/20 font-mono"
            disabled={loading}
          />
        </div>
        <button type="submit" disabled={!input.trim() || loading}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-40">
          <Zap className="h-4 w-4" /> Execute
        </button>
      </form>
    </div>
  );
}
