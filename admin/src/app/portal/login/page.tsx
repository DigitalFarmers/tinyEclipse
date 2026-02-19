"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, ArrowRight, AlertCircle, Mail, Lock, KeyRound, CheckCircle, Eye, EyeOff } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type View = "login" | "set-password" | "forgot" | "reset";

export default function PortalLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Check for reset token in URL
  useEffect(() => {
    const resetToken = searchParams.get("reset");
    if (resetToken) setView("reset");
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await r.json();
      if (r.ok) {
        sessionStorage.setItem("te_portal_session", JSON.stringify({
          tenant_id: data.tenant_id,
          tenant_name: data.tenant_name,
          domain: data.domain,
          plan: data.plan,
          client_id: data.client_id,
          client_name: data.client_name,
          email: data.email,
          token: data.token,
        }));
        router.replace("/portal");
      } else {
        const detail = data.detail || "Inloggen mislukt.";
        if (r.status === 403 && detail.includes("wachtwoord ingesteld")) {
          setError("");
          setSuccess("Je hebt nog geen wachtwoord. Stel er nu een in.");
          setTimeout(() => setView("set-password"), 1500);
        } else {
          setError(detail);
        }
      }
    } catch { setError("Kan geen verbinding maken met de server."); }
    setLoading(false);
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    if (password !== confirmPassword) { setError("Wachtwoorden komen niet overeen."); setLoading(false); return; }
    try {
      const r = await fetch(`${API_URL}/api/portal/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, confirm_password: confirmPassword }),
      });
      const data = await r.json();
      if (r.ok) {
        setSuccess(data.message || "Wachtwoord ingesteld!");
        setPassword(""); setConfirmPassword("");
        setTimeout(() => { setView("login"); setSuccess(""); }, 2000);
      } else {
        setError(data.detail || "Er ging iets mis.");
      }
    } catch { setError("Kan geen verbinding maken met de server."); }
    setLoading(false);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/portal/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        setSuccess(data.message || "Check je e-mail voor de reset-link.");
      } else {
        setError(data.detail || "Er ging iets mis.");
      }
    } catch { setError("Kan geen verbinding maken met de server."); }
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    const token = searchParams.get("reset") || "";
    if (password !== confirmPassword) { setError("Wachtwoorden komen niet overeen."); setLoading(false); return; }
    try {
      const r = await fetch(`${API_URL}/api/portal/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
      });
      const data = await r.json();
      if (r.ok) {
        setSuccess(data.message || "Wachtwoord gewijzigd!");
        setTimeout(() => { setView("login"); setSuccess(""); router.replace("/portal/login"); }, 2000);
      } else {
        setError(data.detail || "Er ging iets mis.");
      }
    } catch { setError("Kan geen verbinding maken met de server."); }
    setLoading(false);
  }

  const titles: Record<View, { h: string; p: string }> = {
    login: { h: "Welkom terug", p: "Log in met je e-mailadres en wachtwoord" },
    "set-password": { h: "Wachtwoord instellen", p: "Stel je eerste wachtwoord in" },
    forgot: { h: "Wachtwoord vergeten", p: "Vul je e-mailadres in voor een reset-link" },
    reset: { h: "Nieuw wachtwoord", p: "Kies een nieuw wachtwoord" },
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/8 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {titles[view].h}
          </h1>
          <p className="mt-1 text-sm text-white/40">{titles[view].p}</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
            <span className="text-xs text-red-300">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2.5">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
            <span className="text-xs text-green-300">{success}</span>
          </div>
        )}

        {/* Login Form */}
        {view === "login" && (
          <form onSubmit={handleLogin} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50">
                <Mail className="h-3 w-3" /> E-mailadres
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoFocus required autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50">
                <Lock className="h-3 w-3" /> Wachtwoord
              </label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || !email.trim() || !password}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50">
              {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><span>Inloggen</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></>}
            </button>
            <div className="mt-4 flex items-center justify-between text-[11px]">
              <button type="button" onClick={() => { setView("set-password"); setError(""); setSuccess(""); }} className="text-white/30 transition hover:text-brand-400">Eerste keer? Wachtwoord instellen</button>
              <button type="button" onClick={() => { setView("forgot"); setError(""); setSuccess(""); }} className="text-white/30 transition hover:text-brand-400">Wachtwoord vergeten?</button>
            </div>
          </form>
        )}

        {/* Set Password Form */}
        {view === "set-password" && (
          <form onSubmit={handleSetPassword} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50"><Mail className="h-3 w-3" /> E-mailadres</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" required autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
              <p className="mt-1 text-[10px] text-white/20">Het e-mailadres dat gekoppeld is aan je Digital Farmers account.</p>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50"><KeyRound className="h-3 w-3" /> Nieuw wachtwoord</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimaal 8 tekens" required minLength={8} autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50"><KeyRound className="h-3 w-3" /> Bevestig wachtwoord</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Herhaal wachtwoord" required minLength={8} autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
            </div>
            <button type="submit" disabled={loading || !email.trim() || !password || !confirmPassword}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50">
              {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><span>Wachtwoord instellen</span><ArrowRight className="h-4 w-4" /></>}
            </button>
            <button type="button" onClick={() => { setView("login"); setError(""); setSuccess(""); }} className="mt-3 w-full text-center text-[11px] text-white/30 transition hover:text-brand-400">← Terug naar inloggen</button>
          </form>
        )}

        {/* Forgot Password Form */}
        {view === "forgot" && (
          <form onSubmit={handleForgot} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="mb-5">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50"><Mail className="h-3 w-3" /> E-mailadres</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoFocus required autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
            </div>
            <button type="submit" disabled={loading || !email.trim()}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50">
              {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><span>Reset-link versturen</span><ArrowRight className="h-4 w-4" /></>}
            </button>
            <button type="button" onClick={() => { setView("login"); setError(""); setSuccess(""); }} className="mt-3 w-full text-center text-[11px] text-white/30 transition hover:text-brand-400">← Terug naar inloggen</button>
          </form>
        )}

        {/* Reset Password Form */}
        {view === "reset" && (
          <form onSubmit={handleReset} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50"><KeyRound className="h-3 w-3" /> Nieuw wachtwoord</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimaal 8 tekens" required minLength={8} autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/50"><KeyRound className="h-3 w-3" /> Bevestig wachtwoord</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Herhaal wachtwoord" required minLength={8} autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" />
            </div>
            <button type="submit" disabled={loading || !password || !confirmPassword}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50">
              {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><span>Wachtwoord opslaan</span><ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[10px] text-white/15">
          <a href="/" className="transition hover:text-white/30">Home</a>
          <span>·</span>
          <a href="/terms" className="transition hover:text-white/30">Voorwaarden</a>
          <span>·</span>
          <a href="/privacy" className="transition hover:text-white/30">Privacy</a>
        </div>
        <p className="mt-3 text-center text-[10px] text-white/10">Powered by TinyEclipse · Digital Farmers</p>
      </div>
    </div>
  );
}
