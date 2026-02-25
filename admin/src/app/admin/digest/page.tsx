"use client";

import { useEffect, useState } from "react";
import {
  Mail, RefreshCw, Send, Eye, Users, Globe, ShieldAlert,
  MessageSquare, CheckCircle2, AlertTriangle, Calendar,
} from "lucide-react";
import { StatSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

export default function DigestPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<number>(0);
  const [period, setPeriod] = useState(7);
  const [digest, setDigest] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adminDigest, setAdminDigest] = useState<any>(null);

  useEffect(() => {
    loadClients();
    loadAdminDigest();
  }, []);

  async function loadClients() {
    try {
      const r = await fetch(`${API_URL}/api/admin/whmcs/clients/`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        const data = await r.json();
        const list = data.clients || [];
        setClients(list);
        if (list.length > 0) {
          setSelectedClient(list[0].id || list[0].whmcs_client_id);
        }
      }
    } catch {}
    setLoading(false);
  }

  async function loadAdminDigest() {
    try {
      const r = await fetch(`${API_URL}/api/admin/server/digest/admin?period=${period}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) setAdminDigest(await r.json());
    } catch {}
  }

  async function loadClientDigest() {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/server/digest/client/${selectedClient}?period=${period}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        const data = await r.json();
        setDigest(data.digest);
        setHtmlPreview(data.html || "");
      }
    } catch {}
    setLoading(false);
  }

  async function sendDigest() {
    if (!selectedClient) return;
    setSending(true);
    try {
      await fetch(`${API_URL}/api/admin/server/digest/send/${selectedClient}?period=${period}`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
    } catch {}
    setSending(false);
  }

  useEffect(() => {
    if (selectedClient) loadClientDigest();
  }, [selectedClient, period]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Mail className="h-6 w-6 text-brand-400" /> Email Digest
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Vervangt Wordfence, Sucuri, WP Activity Log, Fluent Forms &amp; NitroPack mails
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 outline-none"
          >
            <option value={1} className="bg-brand-950">Dagelijks</option>
            <option value={7} className="bg-brand-950">Wekelijks</option>
            <option value={30} className="bg-brand-950">Maandelijks</option>
          </select>
          <button
            onClick={loadClientDigest}
            disabled={loading}
            className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Admin Overview */}
      {adminDigest && (
        <div className="mt-6 rounded-xl border border-brand-500/20 bg-brand-500/5 p-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-400">
            <Globe className="h-3.5 w-3.5" /> Platform Overzicht
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-bold">{adminDigest.total_sites}</p>
              <p className="text-[10px] text-white/30">Actieve Sites</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-400">{adminDigest.total_chats}</p>
              <p className="text-[10px] text-white/30">Gesprekken ({period}d)</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${adminDigest.total_open_alerts > 0 ? "text-red-400" : "text-green-400"}`}>
                {adminDigest.total_open_alerts}
              </p>
              <p className="text-[10px] text-white/30">Open Alerts</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${adminDigest.sites_with_issues?.length > 0 ? "text-yellow-400" : "text-green-400"}`}>
                {adminDigest.sites_with_issues?.length || 0}
              </p>
              <p className="text-[10px] text-white/30">Sites met Issues</p>
            </div>
          </div>
          {adminDigest.sites_with_issues?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {adminDigest.sites_with_issues.map((s: any, i: number) => (
                <span key={i} className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400">
                  {s.name} ({s.open_alerts} alerts)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Client Selector */}
      <div className="mt-6 flex items-center gap-3">
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(Number(e.target.value))}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/70 outline-none"
        >
          {clients.map((c: any) => (
            <option key={c.id || c.whmcs_client_id} value={c.id || c.whmcs_client_id} className="bg-brand-950">
              {c.companyname || c.company_name || `${c.firstname || ""} ${c.lastname || ""}`.trim() || `Klant #${c.id}`}
            </option>
          ))}
        </select>
        <button
          onClick={sendDigest}
          disabled={sending || !digest}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {sending ? "Verzenden..." : "Verstuur Digest"}
        </button>
      </div>

      {/* Digest Preview */}
      {loading ? (
        <div className="mt-6"><StatSkeleton count={4} /></div>
      ) : digest && !digest.skip ? (
        <div className="mt-6 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Sites</div>
              <p className="mt-1 text-2xl font-bold">{digest.totals?.sites}</p>
            </div>
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
              <div className="text-[10px] text-brand-400/60 uppercase tracking-wider">Gesprekken</div>
              <p className="mt-1 text-2xl font-bold text-brand-400">{digest.totals?.chats}</p>
            </div>
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div className="text-[10px] text-yellow-400/60 uppercase tracking-wider">Nieuwe Alerts</div>
              <p className="mt-1 text-2xl font-bold text-yellow-400">{digest.totals?.alerts_new}</p>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <div className="text-[10px] text-green-400/60 uppercase tracking-wider">Opgelost</div>
              <p className="mt-1 text-2xl font-bold text-green-400">{digest.totals?.alerts_resolved}</p>
            </div>
          </div>

          {/* HTML Preview */}
          {htmlPreview && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
                <span className="flex items-center gap-2 text-xs text-white/40">
                  <Eye className="h-3.5 w-3.5" /> Email Preview
                </span>
                <span className="text-[10px] text-white/20">{digest.client_name} · {digest.client_email || "geen e-mail"}</span>
              </div>
              <iframe
                srcDoc={htmlPreview}
                className="w-full border-0"
                style={{ height: "600px", background: "#0a0a1a" }}
                title="Email Preview"
              />
            </div>
          )}
        </div>
      ) : digest?.skip ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Mail className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-sm text-white/30">Geen actieve sites voor deze klant</p>
        </div>
      ) : null}
    </div>
  );
}
