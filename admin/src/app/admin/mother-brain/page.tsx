"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Brain, Wifi, WifiOff, ToggleLeft, ToggleRight, Palette, Globe,
  Shield, MessageSquare, Eye, Zap, Users, BookOpen, RefreshCw,
  Save, CheckCircle, AlertTriangle, Settings, Cpu, Radio,
} from "lucide-react";
import { getTenants, getMotherBrainConfig, updateTenantSettings, getPluginVersion } from "@/lib/api";

const FEATURE_META: Record<string, { label: string; description: string; icon: any }> = {
  chat: { label: "AI Chat", description: "Live AI chat widget on the website", icon: MessageSquare },
  tracking: { label: "Visitor Tracking", description: "Track pageviews, sessions, behavior", icon: Eye },
  monitoring: { label: "Site Monitoring", description: "Uptime & performance monitoring", icon: Shield },
  proactive_help: { label: "Proactive Help", description: "Auto-trigger chat on idle/exit/scroll", icon: Zap },
  self_review: { label: "AI Self-Review", description: "AI critically evaluates every response", icon: Brain },
  admin_identity: { label: "Admin Identity", description: "Recognize admins in the widget", icon: Users },
  update_guard: { label: "Update Guard", description: "Auto-rollback on broken WP updates", icon: Shield },
  knowledge_gaps: { label: "Knowledge Gaps", description: "Track unanswered questions", icon: BookOpen },
  visitor_profiles: { label: "Visitor Profiles", description: "Persistent cross-session visitor tracking", icon: Users },
  multi_language: { label: "Multi-Language", description: "WPML/Polylang-aware language detection", icon: Globe },
  escalation: { label: "Escalation", description: "Low-confidence auto-escalation", icon: AlertTriangle },
  consent_required: { label: "Consent Required", description: "Require GDPR consent before chat", icon: Shield },
};

export default function MotherBrainPage() {
  const searchParams = useSearchParams();
  const preselectedTenant = searchParams.get("tenant") || "";

  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState(preselectedTenant);
  const [config, setConfig] = useState<any>(null);
  const [pluginInfo, setPluginInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable state
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [widgetColor, setWidgetColor] = useState("#6C3CE1");
  const [widgetName, setWidgetName] = useState("");
  const [widgetPosition, setWidgetPosition] = useState("bottom-right");
  const [widgetLang, setWidgetLang] = useState("nl");
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    Promise.all([
      getTenants().catch(() => []),
      getPluginVersion().catch(() => null),
    ]).then(([t, p]) => {
      const list = Array.isArray(t) ? t : t?.tenants || [];
      setTenants(list);
      setPluginInfo(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    setLoading(true);
    getMotherBrainConfig(selectedTenant)
      .then((c) => {
        setConfig(c);
        setFeatures(c.features || {});
        setWidgetColor(c.widget?.color || "#6C3CE1");
        setWidgetName(c.widget?.name || "");
        setWidgetPosition(c.widget?.position || "bottom-right");
        setWidgetLang(c.default_language || "nl");
        setWidgetEnabled(c.widget?.enabled !== false);
        setWelcomeMessage(c.widget?.welcome_message || "");
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [selectedTenant]);

  async function handleSave() {
    if (!selectedTenant) return;
    setSaving(true);
    try {
      await updateTenantSettings(selectedTenant, {
        feature_flags: features,
        widget_color: widgetColor,
        widget_name: widgetName,
        widget_position: widgetPosition,
        widget_lang: widgetLang,
        widget_enabled: widgetEnabled,
        widget_welcome: welcomeMessage || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert("Failed to save: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggleFeature(key: string) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mother Brain</h1>
            <p className="text-sm text-white/50">Central live config — changes here affect all bots instantly</p>
          </div>
        </div>
        {pluginInfo && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
            <Radio className="w-3 h-3 text-green-400 animate-pulse" />
            Intelligence v{pluginInfo.intelligence_version} · Plugin v{pluginInfo.version}
          </div>
        )}
      </div>

      {/* Tenant selector */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <label className="text-sm font-medium text-white/70 block mb-2">Select Tenant</label>
        <select
          className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">— Choose a tenant —</option>
          {tenants.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.domain || "no domain"}) — {t.plan}
            </option>
          ))}
        </select>
      </div>

      {loading && selectedTenant && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      )}

      {config && !loading && (
        <>
          {/* Connection status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
              <Wifi className="w-3 h-3" /> Connected — {config.domain}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
              Plan: <span className="text-white font-medium">{config.plan}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
              Brain v{config.mother_brain?.version}
            </div>
          </div>

          {/* Widget Kill Switch */}
          <div
            className={`p-4 rounded-xl border ${widgetEnabled ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"} cursor-pointer`}
            onClick={() => setWidgetEnabled(!widgetEnabled)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {widgetEnabled ? <ToggleRight className="w-6 h-6 text-green-400" /> : <ToggleLeft className="w-6 h-6 text-red-400" />}
                <div>
                  <div className="text-sm font-medium text-white">Widget Active</div>
                  <div className="text-xs text-white/50">
                    {widgetEnabled ? "Widget is live on the site" : "Widget is hidden — kill switch active"}
                  </div>
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${widgetEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {widgetEnabled ? "ON" : "OFF"}
              </div>
            </div>
          </div>

          {/* Widget Appearance */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Palette className="w-4 h-4 text-purple-400" /> Widget Appearance
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 block mb-1">Bot Name</label>
                <input
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  value={widgetName}
                  onChange={(e) => setWidgetName(e.target.value)}
                  placeholder="AI Assistant"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Theme Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded border-0 cursor-pointer"
                    value={widgetColor}
                    onChange={(e) => setWidgetColor(e.target.value)}
                  />
                  <input
                    className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono"
                    value={widgetColor}
                    onChange={(e) => setWidgetColor(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Position</label>
                <select
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  value={widgetPosition}
                  onChange={(e) => setWidgetPosition(e.target.value)}
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Default Language</label>
                <select
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  value={widgetLang}
                  onChange={(e) => setWidgetLang(e.target.value)}
                >
                  <option value="nl">Nederlands</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Welcome Message (optional)</label>
              <input
                className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Leave empty for default"
              />
            </div>
          </div>

          {/* Feature Flags */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Settings className="w-4 h-4 text-blue-400" /> Feature Flags
            </div>
            <p className="text-xs text-white/40">Toggle features remotely. Changes take effect on next widget boot (page reload).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(FEATURE_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const enabled = features[key] !== false;
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      enabled
                        ? "bg-white/5 border-white/10 hover:bg-white/10"
                        : "bg-white/[0.02] border-white/5 opacity-60 hover:opacity-80"
                    }`}
                    onClick={() => toggleFeature(key)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${enabled ? "text-purple-400" : "text-white/30"}`} />
                      <div>
                        <div className="text-xs font-medium text-white">{meta.label}</div>
                        <div className="text-[10px] text-white/40">{meta.description}</div>
                      </div>
                    </div>
                    {enabled ? (
                      <ToggleRight className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-white/20 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/30">
              Changes are saved to the cloud and take effect on next widget boot.
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                saved
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-purple-500 text-white hover:bg-purple-600"
              }`}
            >
              {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : saved ? "Saved — Live!" : "Save & Push Live"}
            </button>
          </div>
        </>
      )}

      {!selectedTenant && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <Cpu className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">Select a tenant to configure the Mother Brain</p>
        </div>
      )}
    </div>
  );
}
