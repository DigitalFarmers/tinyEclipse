"use client";

import { useEffect, useState } from "react";
import {
  Key, RefreshCw, Copy, CheckCircle, Globe, Search,
  ShieldCheck, AlertTriangle, RotateCcw, Eye, EyeOff,
} from "lucide-react";
import { getTenants } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface ApiKeyData {
  tenant_id: string;
  name: string;
  domain: string;
  api_key: string;
  hub_url: string;
  api_base: string;
}

export default function ApiKeysPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [keys, setKeys] = useState<Record<string, ApiKeyData>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const t = await getTenants();
      setTenants(t);
      // Fetch keys for all tenants in parallel
      const keyResults = await Promise.all(
        t.map((tenant: any) =>
          fetch(`${API_URL}/api/admin/server/apikeys/${tenant.id}`, {
            headers: { "X-Admin-Key": ADMIN_KEY },
          }).then(r => r.ok ? r.json() : null).catch(() => null)
        )
      );
      const keyMap: Record<string, ApiKeyData> = {};
      keyResults.forEach((k) => {
        if (k) keyMap[k.tenant_id] = k;
      });
      setKeys(keyMap);
    } catch {}
    setLoading(false);
  }

  async function regenerateKey(tenantId: string) {
    setRegenerating(tenantId);
    try {
      const r = await fetch(`${API_URL}/api/admin/server/apikeys/${tenantId}/regenerate`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        const data = await r.json();
        setKeys(prev => ({ ...prev, [tenantId]: { ...prev[tenantId], api_key: data.api_key } }));
        setRevealed(prev => new Set(Array.from(prev).concat(tenantId)));
      }
    } catch {}
    setRegenerating(null);
  }

  function copyKey(tenantId: string, key: string) {
    navigator.clipboard.writeText(key);
    setCopied(tenantId);
    setTimeout(() => setCopied(null), 2000);
  }

  function copySnippet(tenantId: string) {
    const k = keys[tenantId];
    if (!k) return;
    const snippet = `// WordPress wp-config.php\ndefine('TINYECLIPSE_TENANT_ID', '${k.tenant_id}');\ndefine('TINYECLIPSE_API_KEY', '${k.api_key}');\ndefine('TINYECLIPSE_HUB_URL', '${k.hub_url}');\ndefine('TINYECLIPSE_API_BASE', '${k.api_base}');`;
    navigator.clipboard.writeText(snippet);
    setCopied(`snippet-${tenantId}`);
    setTimeout(() => setCopied(null), 2000);
  }

  function toggleReveal(tenantId: string) {
    setRevealed(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  }

  const filtered = tenants.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.domain?.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Key className="h-6 w-6 text-brand-400" /> Hub API Keys
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Genereer & beheer API keys voor elke website
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Vernieuwen
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="text-[10px] text-brand-400/60 uppercase tracking-wider">Totaal Sites</div>
          <p className="mt-1 text-2xl font-bold text-brand-400">{tenants.length}</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <div className="text-[10px] text-green-400/60 uppercase tracking-wider">Keys Gegenereerd</div>
          <p className="mt-1 text-2xl font-bold text-green-400">{Object.keys(keys).length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Zonder Key</div>
          <p className="mt-1 text-2xl font-bold">{tenants.length - Object.keys(keys).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          placeholder="Zoek op naam of domein..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/30"
        />
      </div>

      {/* Keys List */}
      {loading ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-36 rounded bg-white/5" />
                  <div className="h-2.5 w-52 rounded bg-white/[0.03]" />
                </div>
                <div className="h-7 w-24 rounded-lg bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {filtered.map((tenant) => {
            const k = keys[tenant.id];
            const isRevealed = revealed.has(tenant.id);
            const isCopied = copied === tenant.id;
            const isSnippetCopied = copied === `snippet-${tenant.id}`;
            const isRegen = regenerating === tenant.id;

            return (
              <div
                key={tenant.id}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10"
              >
                <div className="flex items-center gap-3">
                  {/* Site info */}
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10">
                    <Globe className="h-4 w-4 text-brand-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{tenant.name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${
                        tenant.plan === "pro_plus" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        tenant.plan === "pro" ? "bg-brand-500/10 text-brand-400 border-brand-500/20" :
                        "bg-white/5 text-white/30 border-white/10"
                      }`}>{tenant.plan?.toUpperCase()}</span>
                    </div>
                    <p className="text-[10px] text-white/25 truncate">{tenant.domain}</p>
                  </div>

                  {/* API Key display */}
                  {k ? (
                    <div className="flex items-center gap-2">
                      <code className="rounded-lg bg-black/30 px-3 py-1.5 font-mono text-[11px] text-brand-400/80 select-all">
                        {isRevealed ? k.api_key : `te-${"•".repeat(24)}`}
                      </code>
                      <button
                        onClick={() => toggleReveal(tenant.id)}
                        className="rounded-lg bg-white/5 p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white"
                        title={isRevealed ? "Verberg" : "Toon"}
                      >
                        {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => copyKey(tenant.id, k.api_key)}
                        className="rounded-lg bg-white/5 p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white"
                        title="Kopieer key"
                      >
                        {isCopied ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => copySnippet(tenant.id)}
                        className="rounded-lg bg-brand-500/10 px-2 py-1.5 text-[10px] font-medium text-brand-400 transition hover:bg-brand-500/20"
                        title="Kopieer wp-config snippet"
                      >
                        {isSnippetCopied ? "✓ Gekopieerd" : "wp-config"}
                      </button>
                      <button
                        onClick={() => regenerateKey(tenant.id)}
                        disabled={isRegen}
                        className="rounded-lg bg-red-500/10 p-1.5 text-red-400/60 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                        title="Regenereer key (oude wordt ongeldig!)"
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${isRegen ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-white/20">Laden...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[10px] text-white/15">
        {filtered.length} sites · Keys worden deterministisch gegenereerd op basis van tenant ID
      </p>
    </div>
  );
}
