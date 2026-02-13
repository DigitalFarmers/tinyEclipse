"use client";

import { useEffect, useState } from "react";
import { getTenants, getSources, createSource, triggerIngest, scrapeSite } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
}

interface Source {
  id: string;
  tenant_id: string;
  type: string;
  url: string | null;
  title: string;
  status: string;
  last_indexed_at: string | null;
  created_at: string;
}

export default function SourcesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [sources, setSources] = useState<Source[]>([]);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTenants()
      .then((t: Tenant[]) => {
        setTenants(t);
        if (t.length > 0) setSelectedTenant(t[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      getSources(selectedTenant)
        .then(setSources)
        .catch((e: Error) => setError(e.message));
    }
  }, [selectedTenant]);

  const handleScrape = async () => {
    if (!scrapeUrl || !selectedTenant) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await scrapeSite(selectedTenant, scrapeUrl);
      setMessage(`Scraping started: ${result.sources_created} pages found`);
      setScrapeUrl("");
      // Refresh sources after a delay
      setTimeout(() => {
        getSources(selectedTenant).then(setSources);
      }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async (sourceId: string) => {
    try {
      await triggerIngest(sourceId);
      setMessage("Re-indexing started");
      setTimeout(() => {
        getSources(selectedTenant).then(setSources);
      }, 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Sources</h1>
      <p className="mt-1 text-sm text-white/50">Knowledge base management per tenant</p>

      {/* Tenant selector */}
      <div className="mt-6">
        <label className="block text-xs font-medium text-white/50">Select Tenant</label>
        <select
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Scrape site */}
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-semibold">Scrape Website</h3>
        <p className="mt-1 text-xs text-white/40">
          Enter a URL to automatically scrape and index all pages via sitemap
        </p>
        <div className="mt-3 flex gap-3">
          <input
            type="url"
            placeholder="https://example.com"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            onClick={handleScrape}
            disabled={loading || !scrapeUrl}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Scraping..." : "Scrape & Index"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Sources list */}
      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-white/50">Title</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Type</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Status</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Last Indexed</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sources.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium truncate max-w-[200px]">{s.title}</div>
                  {s.url && (
                    <div className="text-xs text-white/30 truncate max-w-[200px]">{s.url}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-white/60">{s.type}</td>
                <td className="px-4 py-3">
                  <SourceStatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-xs text-white/40">
                  {s.last_indexed_at
                    ? new Date(s.last_indexed_at).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleReindex(s.id)}
                    className="text-xs text-brand-500 hover:text-brand-400"
                  >
                    Re-index
                  </button>
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/30">
                  No sources yet. Scrape a website or add sources manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    indexed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  );
}
