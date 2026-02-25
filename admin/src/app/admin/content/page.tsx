"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText, Globe, RefreshCw, Search, AlertTriangle, CheckCircle,
  ExternalLink, Copy, Languages, Eye, ChevronDown, ChevronRight,
  Trash2, Filter,
} from "lucide-react";
import { getTenants } from "@/lib/api";
import { StatSkeleton, ListRowSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface WPPage {
  id: number;
  title: { rendered: string };
  slug: string;
  link: string;
  status: string;
  modified: string;
  template?: string;
  menu_order?: number;
}

interface WPPost {
  id: number;
  title: { rendered: string };
  slug: string;
  link: string;
  status: string;
  modified: string;
  categories?: number[];
}

interface DuplicateGroup {
  slug: string;
  items: (WPPage | WPPost)[];
  type: "exact_slug" | "similar_title";
}

export default function ContentManagerPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [pages, setPages] = useState<WPPage[]>([]);
  const [posts, setPosts] = useState<WPPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState<"pages" | "posts">("pages");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [intelligence, setIntelligence] = useState<any>(null);

  useEffect(() => {
    getTenants().then((t) => {
      setTenants(t);
      if (t.length > 0) {
        setSelectedTenant(t[0].id);
        loadContent(t[0].id);
      }
    });
  }, []);

  async function loadContent(tid: string) {
    setLoading(true);
    try {
      const headers = { "X-Admin-Key": ADMIN_KEY };
      const [pagesRes, postsRes, intelRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/wp/${tid}/pages`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/admin/wp/${tid}/posts`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/portal/data/${tid}/intelligence/scan`).then(r => r.ok ? r.json() : null),
      ]);
      setPages(Array.isArray(pagesRes) ? pagesRes : []);
      setPosts(Array.isArray(postsRes) ? postsRes : []);
      setIntelligence(intelRes);
    } catch {}
    setLoading(false);
  }

  function switchTenant(tid: string) {
    setSelectedTenant(tid);
    loadContent(tid);
  }

  // Duplicate detection
  function findDuplicates(items: (WPPage | WPPost)[]): DuplicateGroup[] {
    const slugMap: Record<string, (WPPage | WPPost)[]> = {};
    const titleMap: Record<string, (WPPage | WPPost)[]> = {};

    items.forEach(item => {
      const slug = item.slug.toLowerCase().replace(/-\d+$/, ""); // strip trailing -2, -3 etc
      if (!slugMap[slug]) slugMap[slug] = [];
      slugMap[slug].push(item);

      const title = item.title.rendered.toLowerCase().trim();
      if (!titleMap[title]) titleMap[title] = [];
      titleMap[title].push(item);
    });

    const groups: DuplicateGroup[] = [];
    const seen = new Set<number>();

    // Exact slug duplicates (e.g. "about" and "about-2")
    Object.entries(slugMap).forEach(([slug, items]) => {
      if (items.length > 1) {
        groups.push({ slug, items, type: "exact_slug" });
        items.forEach(i => seen.add(i.id));
      }
    });

    // Similar title duplicates (not already caught by slug)
    Object.entries(titleMap).forEach(([title, items]) => {
      const unseen = items.filter(i => !seen.has(i.id));
      if (items.length > 1 && unseen.length > 0) {
        groups.push({ slug: title, items, type: "similar_title" });
      }
    });

    return groups;
  }

  const currentItems = contentType === "pages" ? pages : posts;
  const duplicates = findDuplicates(currentItems);
  const duplicateIds = new Set(duplicates.flatMap(g => g.items.map(i => i.id)));

  const filtered = currentItems.filter(item => {
    if (showDuplicatesOnly && !duplicateIds.has(item.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.rendered.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q);
    }
    return true;
  });

  const tenant = tenants.find(t => t.id === selectedTenant);
  const contentUnits = intelligence?.content?.total_content_units;
  const wpTotal = intelligence?.content?.total_wp_posts;
  const hasWpml = intelligence?.content?.wpml_grouped;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="h-6 w-6 text-brand-400" /> Content Manager
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Pagina&apos;s & berichten beheren — duplicaten detecteren
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedTenant}
            onChange={(e) => switchTenant(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id} className="bg-brand-950">{t.name}</option>
            ))}
          </select>
          <button
            onClick={() => loadContent(selectedTenant)}
            disabled={loading}
            className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mt-6"><StatSkeleton count={4} cols="grid-cols-2 sm:grid-cols-4" /></div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Pagina&apos;s</div>
            <p className="mt-1 text-2xl font-bold">{pages.length}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Berichten</div>
            <p className="mt-1 text-2xl font-bold">{posts.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${duplicates.length > 0 ? "border-yellow-500/20 bg-yellow-500/5" : "border-green-500/20 bg-green-500/5"}`}>
            <div className={`text-[10px] uppercase tracking-wider ${duplicates.length > 0 ? "text-yellow-400/60" : "text-green-400/60"}`}>Duplicaten</div>
            <p className={`mt-1 text-2xl font-bold ${duplicates.length > 0 ? "text-yellow-400" : "text-green-400"}`}>{duplicates.length}</p>
          </div>
          {hasWpml && contentUnits && (
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
              <div className="text-[10px] text-brand-400/60 uppercase tracking-wider">Unieke Content</div>
              <p className="mt-1 text-2xl font-bold text-brand-400">{contentUnits}</p>
              {wpTotal && wpTotal !== contentUnits && (
                <p className="text-[9px] text-white/20">{wpTotal} in WP (meertalig)</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duplicate Alert */}
      {!loading && duplicates.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-400">{duplicates.length} mogelijke duplicaten gevonden</h3>
              <p className="mt-1 text-xs text-white/40">
                {duplicates.filter(d => d.type === "exact_slug").length} slug-duplicaten,{" "}
                {duplicates.filter(d => d.type === "similar_title").length} titel-duplicaten.
                {hasWpml && " Let op: WPML-vertalingen zijn geen duplicaten."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {duplicates.slice(0, 5).map((d, i) => (
                  <span key={i} className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400">
                    &quot;{d.slug}&quot; ({d.items.length}×)
                  </span>
                ))}
                {duplicates.length > 5 && <span className="text-[10px] text-white/30">+{duplicates.length - 5} meer</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            placeholder="Zoek op titel of slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/30"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setContentType("pages")}
            className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${contentType === "pages" ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"}`}
          >
            Pagina&apos;s ({pages.length})
          </button>
          <button
            onClick={() => setContentType("posts")}
            className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${contentType === "posts" ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"}`}
          >
            Berichten ({posts.length})
          </button>
          <button
            onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
            className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${showDuplicatesOnly ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"}`}
          >
            <Filter className="mr-1 inline h-3 w-3" />
            Duplicaten
          </button>
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="mt-6"><ListRowSkeleton count={8} /></div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-sm text-white/30">Geen content gevonden</p>
        </div>
      ) : (
        <div className="mt-6 space-y-1.5">
          {filtered.map(item => {
            const isDuplicate = duplicateIds.has(item.id);
            const title = item.title.rendered.replace(/&amp;/g, "&").replace(/&#8217;/g, "'").replace(/&quot;/g, '"');
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  isDuplicate
                    ? "border-yellow-500/15 bg-yellow-500/[0.02] hover:bg-yellow-500/[0.04]"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                {/* Status dot */}
                <div className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  item.status === "publish" ? "bg-green-500" : item.status === "draft" ? "bg-yellow-500" : "bg-white/20"
                }`} title={item.status} />

                {/* Title + slug */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{title}</span>
                    {isDuplicate && (
                      <span className="flex-shrink-0 rounded-full bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">
                        duplicaat
                      </span>
                    )}
                    {item.status !== "publish" && (
                      <span className="flex-shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/40">{item.status}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/25 truncate">/{item.slug}</p>
                </div>

                {/* Modified date */}
                <span className="hidden text-[10px] text-white/20 sm:block">
                  {new Date(item.modified).toLocaleDateString("nl-BE")}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg bg-white/5 p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white"
                      title="Bekijk pagina"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {tenant?.domain && (
                    <a
                      href={`https://${tenant.domain}/wp-admin/post.php?post=${item.id}&action=edit`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg bg-brand-500/10 p-1.5 text-brand-400 transition hover:bg-brand-500/20"
                      title="Bewerk in WP Admin"
                    >
                      <FileText className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="mt-6 text-center text-[10px] text-white/15">
          {filtered.length} van {currentItems.length} {contentType === "pages" ? "pagina's" : "berichten"} ·{" "}
          {tenant?.name} ({tenant?.domain})
        </p>
      )}
    </div>
  );
}
