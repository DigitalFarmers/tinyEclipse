"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Lock, ArrowRight, AlertCircle, Shield, Globe, BarChart3, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const success = await login(password);
    if (success) {
      router.replace("/admin");
    } else {
      setError("Ongeldig wachtwoord. Probeer opnieuw.");
    }
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-brand-500/[0.07] blur-[150px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute -right-32 -bottom-32 h-[500px] w-[500px] rounded-full bg-purple-600/[0.06] blur-[130px] animate-pulse" style={{ animationDuration: "12s" }} />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-[100px] animate-pulse" style={{ animationDuration: "10s" }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">TinyEclipse</span>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Jouw websites.{" "}
            <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
              Eén command center.
            </span>
          </h2>
          <p className="mt-4 text-base text-white/40 leading-relaxed">
            Beheer al je WordPress sites, monitor performance, chat met bezoekers en optimaliseer met AI — allemaal vanuit één plek.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { icon: Globe, label: "Sites", desc: "Multi-site beheer" },
              { icon: Shield, label: "Security", desc: "Realtime monitoring" },
              { icon: MessageSquare, label: "AI Chat", desc: "Slimme bezoekers" },
              { icon: BarChart3, label: "Analytics", desc: "Live inzichten" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                  <f.icon className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold">{f.label}</p>
                  <p className="text-[10px] text-white/30">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-white/20">
          <span>© {new Date().getFullYear()} Digital Farmers</span>
          <span>·</span>
          <span>v5.0</span>
          <span>·</span>
          <span>{time}</span>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="relative w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/25">
              <Zap className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Eclipse <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">HUB</span>
            </h1>
            <p className="mt-1 text-sm text-white/40">Digital Farmers Command Center</p>
          </div>

          {/* Desktop heading */}
          <div className="mb-8 hidden lg:block">
            <h1 className="text-2xl font-bold tracking-tight">Welkom terug</h1>
            <p className="mt-1 text-sm text-white/40">Log in om je command center te openen</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl shadow-2xl shadow-black/20">
            <div className="mb-5">
              <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/50">
                <Lock className="h-3 w-3" />
                Admin Wachtwoord
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoFocus
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm outline-none transition placeholder:text-white/15 focus:border-brand-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                <span className="text-xs text-red-300">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 py-3.5 text-sm font-semibold shadow-lg shadow-brand-500/20 transition hover:shadow-brand-500/30 hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Inloggen
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[10px] text-white/15">
            🔒 Beveiligd door TinyEclipse · End-to-end encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
