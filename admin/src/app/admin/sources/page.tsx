"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCw, Plus, Globe, FileText, ExternalLink } from "lucide-react";
import { getTenants, getSources, createSource, triggerIngest, scrapeSite } from "@/lib/api";

interface Tenant { id: string; name: string; domain: string; }
interface Source { id: string; tenant_id: string; type: string; url: string | null; title: string; status: string; last_indexed_at: string | null; created_at: string; }

export default function SourcesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);

  useEffect(() => { getTenants().then((t) => { setTenants(t); if (t.length > 0) setSelectedTenant(t[0].id); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selectedTenant) loadSources(); }, [selectedTenant]);

  async function loadSources() {
    try { const s = await getSources(selectedTenant); setSources(s); } catch { setSources([]); }
  }

  async function handleScrape() {
    if (!scrapeUrl) return;
    setScraping(true);
    try { await scrapeSite(selectedTenant, scrapeUrl); setScrapeUrl(""); setTimeout(loadSources, 3000); } catch {} finally { setScraping(false); }
  }

  async function handleIngest(sourceId: string) {
    await triggerIngest(sourceId);
    setTimeout(loadSources, 3000);
  }

  const statusColor = (s: string) => s === "indexed" ? "bg-green-500/20 text-green-400" : s === "failed" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="mt-0.5 text-sm text-white/40">Kennisbronnen voor AI-assistenten</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none">
            {tenants.map((t) => <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>)}
          </select>
          <button onClick={loadSources} className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Scrape Site */}
      <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs font-medium text-white/40 mb-2">Website scrapen (alle pagina&apos;s via sitemap)</p>
        <div className="flex gap-2">
          <input type="url" placeholder="https://example.com" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          <button onClick={handleScrape} disabled={scraping || !scrapeUrl} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium transition hover:bg-brand-500 disabled:opacity-50">
            {scraping ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />} Scrape
          </button>
        </div>
      </div>

      {/* Sources List */}
      <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">Bronnen ({sources.length})</h2>
      {sources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Database className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Geen kennisbronnen — scrape een website of voeg handmatig toe</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
              <div className="flex items-center gap-3 min-w-0">
                {s.type === "url" ? <Globe className="h-4 w-4 flex-shrink-0 text-white/30" /> : <FileText className="h-4 w-4 flex-shrink-0 text-white/30" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{s.title}</p>
                  <p className="text-[10px] text-white/30 truncate">{s.url || "Handmatige content"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(s.status)}`}>{s.status}</span>
                <button onClick={() => handleIngest(s.id)} className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-white/40 transition hover:bg-white/10 hover:text-white">Re-index</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
