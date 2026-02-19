"use client";

import { useEffect, useState } from "react";
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Globe,
  Zap,
  Crown,
  Shield,
  Database,
  MessageSquare,
  Activity,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Receipt,
  RefreshCw,
  Server,
  TrendingUp,
} from "lucide-react";
import { usePortalSession } from "@/lib/usePortalSession";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AccountData {
  account: {
    id: string | null;
    whmcs_client_id: number;
    name: string;
    email: string | null;
    company: string | null;
  };
  plan: {
    current: string;
    label: string;
    price: string;
    limits: {
      messages_month: number;
      pages: number;
      monitoring_types: string[];
      events_retention_days: number;
    };
  };
  usage: {
    messages_month: number;
    messages_limit: number;
    messages_pct: number;
    sources_indexed: number;
    sources_limit: number;
    sources_pct: number;
    tokens_in_month: number;
    tokens_out_month: number;
  };
  projects: Array<{
    tenant_id: string;
    name: string;
    domain: string;
    plan: string;
    status: string;
    environment: string;
    created_at: string;
    monitoring_ok: boolean | null;
    stats: { chats_month: number; sources: number; open_alerts: number };
    modules: Array<{ type: string; name: string }>;
  }>;
  whmcs: {
    available: boolean;
    client: {
      firstname: string;
      lastname: string;
      email: string;
      company: string;
      address: string;
      address2: string;
      city: string;
      postcode: string;
      country: string;
      phone: string;
      status: string;
      created_at: string;
    } | null;
    products: Array<{
      id: number;
      name: string;
      domain: string;
      status: string;
      billing_cycle: string;
      amount: string;
      next_due: string;
      eclipse_plan: string | null;
    }>;
    invoices: Array<{
      id: number;
      date: string;
      due_date: string;
      total: string;
      status: string;
    }>;
    domains: Array<{
      id: number;
      domain: string;
      status: string;
      expiry_date: string;
      registrar: string;
    }>;
  };
}

const PLAN_COLORS: Record<string, string> = {
  tiny: "from-zinc-500/20 to-zinc-600/20 border-zinc-500/20",
  pro: "from-brand-500/20 to-blue-500/20 border-brand-500/30",
  pro_plus: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
};
const PLAN_BADGE: Record<string, string> = {
  tiny: "bg-zinc-500/20 text-zinc-400",
  pro: "bg-brand-500/20 text-brand-400",
  pro_plus: "bg-purple-500/20 text-purple-400",
};

export default function PortalAccountPage() {
  const { session } = usePortalSession();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    loadData();
  }, [session]);

  async function loadData() {
    if (!session) return;
    setLoading(true);
    try {
      const sibRes = await fetch(`${API_URL}/api/portal/projects/by-tenant/${session.tenant_id}`, { cache: "no-store" });
      if (!sibRes.ok) { setLoading(false); return; }
      const sibData = await sibRes.json();
      const whmcsId = sibData.whmcs_client_id;

      const res = await fetch(`${API_URL}/api/portal/account/${whmcsId}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  if (!session) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/40">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
        <span className="mt-3 text-sm">Account laden...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-white/40">Kon account niet laden.</div>;
  }

  const plan = data.plan;
  const usage = data.usage;
  const whmcs = data.whmcs;
  const client = whmcs.client;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Mijn Account</h1>
          <p className="mt-1 text-sm text-white/40">
            Alles over je pakket, facturatie en projecten
          </p>
        </div>
        <a
          href="https://my.digitalfarmers.be/clientarea.php"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          WHMCS Portaal <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Plan Card */}
      <div className={`rounded-2xl border bg-gradient-to-br p-5 sm:p-6 ${PLAN_COLORS[plan.current] || PLAN_COLORS.tiny}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {plan.current === "pro_plus" ? (
                <Crown className="h-5 w-5 text-purple-400" />
              ) : plan.current === "pro" ? (
                <Zap className="h-5 w-5 text-brand-400" />
              ) : (
                <Package className="h-5 w-5 text-zinc-400" />
              )}
              <h2 className="text-lg font-bold">TinyEclipse {plan.label}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${PLAN_BADGE[plan.current] || PLAN_BADGE.tiny}`}>
                {plan.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/40">{plan.price}</p>
          </div>
          {plan.current !== "pro_plus" && (
            <a
              href="https://my.digitalfarmers.be/cart.php?a=add&pid=1"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <TrendingUp className="h-4 w-4" /> Upgraden
            </a>
          )}
        </div>

        {/* Usage Meters */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <UsageMeter
            label="AI Berichten"
            icon={MessageSquare}
            used={usage.messages_month}
            limit={usage.messages_limit}
            pct={usage.messages_pct}
          />
          <UsageMeter
            label="Kennisbronnen"
            icon={Database}
            used={usage.sources_indexed}
            limit={usage.sources_limit}
            pct={usage.sources_pct}
          />
        </div>

        {/* Plan Limits */}
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Monitoring: {plan.limits.monitoring_types.join(", ")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Events: {plan.limits.events_retention_days}d retentie
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Tokens: {((usage.tokens_in_month + usage.tokens_out_month) / 1000).toFixed(1)}k deze maand
          </span>
        </div>
      </div>

      {/* Two Column: Client Info + Billing */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Client Info */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-brand-400" /> Klantgegevens
          </h3>
          {client ? (
            <div className="space-y-3 text-sm">
              <InfoRow icon={User} label="Naam" value={`${client.firstname} ${client.lastname}`} />
              {client.company && <InfoRow icon={Building2} label="Bedrijf" value={client.company} />}
              <InfoRow icon={Mail} label="E-mail" value={client.email} />
              {client.phone && <InfoRow icon={Phone} label="Telefoon" value={client.phone} />}
              {client.address && (
                <InfoRow
                  icon={MapPin}
                  label="Adres"
                  value={[client.address, client.address2, `${client.postcode} ${client.city}`, client.country].filter(Boolean).join(", ")}
                />
              )}
              <InfoRow icon={Clock} label="Klant sinds" value={client.created_at} />
              <div className="flex items-center gap-2 pt-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${client.status === "Active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {client.status === "Active" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {client.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/30">WHMCS niet beschikbaar</p>
          )}
        </div>

        {/* Products / Services */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 text-purple-400" /> Producten & Services
          </h3>
          {whmcs.products.length > 0 ? (
            <div className="space-y-3">
              {whmcs.products.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.domain && <p className="text-xs text-white/40">{p.domain}</p>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.status === "Active" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/30">
                    {p.billing_cycle && <span>{p.billing_cycle}</span>}
                    {p.amount && <span>€{p.amount}</span>}
                    {p.next_due && <span>Volgende: {p.next_due}</span>}
                    {p.eclipse_plan && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${PLAN_BADGE[p.eclipse_plan] || ""}`}>
                        Eclipse {p.eclipse_plan}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/30">Geen producten gevonden</p>
          )}
        </div>
      </div>

      {/* Projects */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Globe className="h-4 w-4 text-cyan-400" /> Projecten ({data.projects.length})
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.projects.map((p) => (
            <div key={p.tenant_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-white/40">{p.domain}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.environment === "staging" && (
                    <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">STAGING</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.status === "active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {p.status}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/30">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {p.stats.chats_month} chats/mo
                </span>
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" /> {p.stats.sources} bronnen
                </span>
                {p.stats.open_alerts > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="h-3 w-3" /> {p.stats.open_alerts} alerts
                  </span>
                )}
                {p.monitoring_ok !== null && (
                  <span className={`flex items-center gap-1 ${p.monitoring_ok ? "text-green-400" : "text-red-400"}`}>
                    <Shield className="h-3 w-3" /> {p.monitoring_ok ? "Online" : "Issue"}
                  </span>
                )}
              </div>
              {p.modules.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.modules.map((m) => (
                    <span key={m.type} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/30">
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Two Column: Invoices + Domains */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invoices */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Receipt className="h-4 w-4 text-green-400" /> Facturen
          </h3>
          {whmcs.invoices.length > 0 ? (
            <div className="space-y-2">
              {whmcs.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">#{inv.id}</p>
                    <p className="text-[10px] text-white/30">{inv.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">€{inv.total}</p>
                    <span className={`text-[10px] font-semibold ${inv.status === "Paid" ? "text-green-400" : inv.status === "Unpaid" ? "text-red-400" : "text-yellow-400"}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
              <a
                href="https://my.digitalfarmers.be/clientarea.php?action=invoices"
                target="_blank"
                rel="noopener"
                className="mt-2 flex items-center gap-1 text-xs text-brand-400 transition hover:text-brand-300"
              >
                Alle facturen bekijken <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-white/30">Geen facturen gevonden</p>
          )}
        </div>

        {/* Domains */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 text-blue-400" /> Domeinen
          </h3>
          {whmcs.domains.length > 0 ? (
            <div className="space-y-2">
              {whmcs.domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">{d.domain}</p>
                    <p className="text-[10px] text-white/30">{d.registrar}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-semibold ${d.status === "Active" ? "text-green-400" : "text-yellow-400"}`}>
                      {d.status}
                    </span>
                    {d.expiry_date && <p className="text-[10px] text-white/30">Verloopt: {d.expiry_date}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/30">Geen domeinen gevonden</p>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageMeter({ label, icon: Icon, used, limit, pct }: { label: string; icon: any; used: number; limit: number; pct: number }) {
  const unlimited = limit < 0;
  const barPct = unlimited ? 0 : Math.min(pct, 100);
  const barColor = barPct > 90 ? "bg-red-500" : barPct > 70 ? "bg-yellow-500" : "bg-brand-500";

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="text-xs font-semibold">
          {used.toLocaleString()} / {unlimited ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
        </div>
      )}
      {unlimited && (
        <p className="mt-1 text-[10px] text-white/30">Onbeperkt</p>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white/20" />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/25">{label}</p>
        <p className="text-sm text-white/70">{value}</p>
      </div>
    </div>
  );
}
