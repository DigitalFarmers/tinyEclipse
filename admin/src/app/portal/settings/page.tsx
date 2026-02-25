"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Palette,
  Image,
  Save,
  CheckCircle2,
  Lock,
  Crown,
  Sparkles,
  Globe,
  Bell,
  Shield,
  Upload,
  X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HubConfig {
  custom_logo: string;
  company_name: string;
  primary_color: string;
  accent_color: string;
  sidebar_style: string;
  welcome_message: string;
  notifications_email: string;
  language: string;
}

interface PlanInfo {
  plan: string;
  label: string;
  custom_branding: boolean;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<HubConfig>({
    custom_logo: "",
    company_name: "",
    primary_color: "#6C3CE1",
    accent_color: "#10B981",
    sidebar_style: "default",
    welcome_message: "",
    notifications_email: "",
    language: "nl",
  });
  const [plan, setPlan] = useState<PlanInfo>({ plan: "tiny", label: "Tiny", custom_branding: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"branding" | "general" | "notifications">("branding");
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchSettings(s.tenant_id);
  }, []);

  async function fetchSettings(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/features/${tid}`);
      if (r.ok) {
        const d = await r.json();
        setPlan({
          plan: d.plan || "tiny",
          label: d.plan_label || "Tiny",
          custom_branding: d.features?.custom_branding || false,
        });
        if (d.hub_config) {
          setConfig((prev) => ({ ...prev, ...d.hub_config }));
        }
      }
    } catch {}
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch(`${API}/api/portal/features/${tenantId}/hub-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const isPro = plan.plan === "pro" || plan.plan === "pro_plus";
  const isProPlus = plan.plan === "pro_plus";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Instellingen</h1>
          <p className="mt-1 text-sm text-white/40">
            Hub configuratie en branding · Plan: <span className="font-medium text-brand-400">{plan.label}</span>
          </p>
        </div>
      </div>

      {/* Plan Banner */}
      {!isProPlus && (
        <div className="flex items-start gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <Crown className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-400">
              {isPro ? "Upgrade naar Pro+ voor volledige branding" : "Upgrade naar Pro voor meer functies"}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              {isPro
                ? "Met Pro+ kun je je eigen logo, kleuren en welkomstbericht instellen."
                : "Met Pro krijg je toegang tot geavanceerde monitoring, SEO tools en meer."}
            </p>
          </div>
          <a
            href="https://digitalfarmers.be/eclipse-pro"
            target="_blank"
            rel="noopener"
            className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-400 transition hover:bg-purple-500/30"
          >
            Upgraden
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
        {[
          { key: "branding" as const, label: "Branding", icon: Palette },
          { key: "general" as const, label: "Algemeen", icon: Settings },
          { key: "notifications" as const, label: "Meldingen", icon: Bell },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === key ? "bg-brand-500/10 text-brand-400" : "text-white/40 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "branding" && (
        <div className="space-y-6">
          {/* Logo */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/60">Logo & Bedrijfsnaam</h2>
              {!isProPlus && (
                <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                  <Lock className="h-3 w-3" /> Pro+
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Bedrijfsnaam</label>
                <input
                  type="text"
                  value={config.company_name}
                  onChange={(e) => setConfig({ ...config, company_name: e.target.value })}
                  disabled={!isProPlus}
                  placeholder="Wordt getoond in de sidebar"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50 disabled:opacity-40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Logo URL</label>
                <input
                  type="url"
                  value={config.custom_logo}
                  onChange={(e) => setConfig({ ...config, custom_logo: e.target.value })}
                  disabled={!isProPlus}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50 disabled:opacity-40"
                />
              </div>
            </div>
            {config.custom_logo && isProPlus && (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-white/5">
                  <img src={config.custom_logo} alt="Logo" className="h-full w-full object-contain" />
                </div>
                <span className="text-xs text-white/30">Preview</span>
              </div>
            )}
          </section>

          {/* Colors */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/60">Kleuren</h2>
              {!isProPlus && (
                <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                  <Lock className="h-3 w-3" /> Pro+
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Primaire kleur</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    disabled={!isProPlus}
                    className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent disabled:opacity-40"
                  />
                  <input
                    type="text"
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    disabled={!isProPlus}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:opacity-40"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Accent kleur</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.accent_color}
                    onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                    disabled={!isProPlus}
                    className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent disabled:opacity-40"
                  />
                  <input
                    type="text"
                    value={config.accent_color}
                    onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                    disabled={!isProPlus}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Welcome Message */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">Welkomstbericht</h2>
            <textarea
              value={config.welcome_message}
              onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
              disabled={!isProPlus}
              rows={3}
              placeholder="Welkom bij je dashboard! Hier beheer je alles."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50 disabled:opacity-40"
            />
            <p className="mt-1 text-[10px] text-white/20">Wordt getoond bovenaan je dashboard</p>
          </section>
        </div>
      )}

      {activeTab === "general" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">Taal & Regio</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Taal</label>
                <select
                  value={config.language}
                  onChange={(e) => setConfig({ ...config, language: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="nl">Nederlands</option>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Sidebar stijl</label>
                <select
                  value={config.sidebar_style}
                  onChange={(e) => setConfig({ ...config, sidebar_style: e.target.value })}
                  disabled={!isProPlus}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:opacity-40"
                >
                  <option value="default">Standaard</option>
                  <option value="compact">Compact</option>
                  <option value="minimal">Minimaal</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">Beveiliging</h2>
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-sm font-medium text-white">Twee-factor authenticatie</p>
                  <p className="text-xs text-white/30">Extra beveiliging voor je account</p>
                </div>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/30">Binnenkort</span>
            </div>
          </section>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">E-mail meldingen</h2>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Meldingen e-mail</label>
              <input
                type="email"
                value={config.notifications_email}
                onChange={(e) => setConfig({ ...config, notifications_email: e.target.value })}
                placeholder="je@email.com"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
              />
              <p className="mt-1 text-[10px] text-white/20">Ontvang meldingen over orders, leads en alerts</p>
            </div>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">Melding types</h2>
            <div className="space-y-3">
              {[
                { label: "Nieuwe orders", desc: "Ontvang een melding bij elke nieuwe bestelling", enabled: true },
                { label: "Nieuwe leads", desc: "Wanneer een bezoeker contact opneemt via de chat", enabled: true },
                { label: "Monitoring alerts", desc: "Downtime, SSL of security waarschuwingen", enabled: true },
                { label: "Wekelijks rapport", desc: "Samenvatting van je week", enabled: false },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div>
                    <p className="text-sm text-white">{n.label}</p>
                    <p className="text-[10px] text-white/30">{n.desc}</p>
                  </div>
                  <div className={`h-5 w-9 rounded-full ${n.enabled ? "bg-brand-500" : "bg-white/10"} relative cursor-pointer transition`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${n.enabled ? "left-[18px]" : "left-0.5"}`} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Opgeslagen!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {saving ? "Opslaan..." : "Instellingen Opslaan"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
