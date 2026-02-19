"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, AlertCircle, User, Lock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PortalLoginPage() {
  const [tenantId, setTenantId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/sites/verify/${tenantId.trim()}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem(
          "te_portal_session",
          JSON.stringify({
            tenant_id: data.tenant_id,
            tenant_name: data.tenant_name,
            domain: data.domain,
            plan: data.plan,
          })
        );
        router.replace("/portal");
      } else {
        setError("Ongeldige Tenant ID. Controleer je instellingen.");
      }
    } catch {
      setError("Kan geen verbinding maken met de server.");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/8 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Mijn <span className="text-brand-500">Website</span>
          </h1>
          <p className="mt-1 text-sm text-white/40">
            Bekijk je AI, monitoring & analytics
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-white/50">
              <User className="mr-1 inline h-3 w-3" />
              Tenant ID
            </label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoFocus
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
            />
            <p className="mt-1.5 text-[10px] text-white/25">
              Je vindt dit in de TinyEclipse plugin op je WordPress site.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !tenantId.trim()}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                Bekijk mijn dashboard
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] text-white/20">of</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          <a
            href="https://my.digitalfarmers.be/clientarea.php"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white/70"
          >
            <Lock className="h-3 w-3" />
            Login via Digital Farmers (WHMCS)
          </a>
          <p className="text-[10px] text-white/20">
            Geen Tenant ID? Vraag het aan via{" "}
            <a href="mailto:info@digitalfarmers.be" className="text-brand-400 hover:underline">info@digitalfarmers.be</a>
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[10px] text-white/15">
          <a href="/" className="transition hover:text-white/30">Home</a>
          <span>·</span>
          <a href="/terms" className="transition hover:text-white/30">Voorwaarden</a>
          <span>·</span>
          <a href="/privacy" className="transition hover:text-white/30">Privacy</a>
        </div>

        <p className="mt-3 text-center text-[10px] text-white/10">
          Powered by TinyEclipse · Digital Farmers
        </p>
      </div>
    </div>
  );
}
