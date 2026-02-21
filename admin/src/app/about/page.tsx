import Link from "next/link";
import Footer from "@/components/Footer";
import { Zap, ArrowRight, MessageSquare, Shield, BarChart3, Globe } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-brand-500/8 blur-[120px]" />
      </div>

      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-brand-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Tiny<span className="text-brand-500">Eclipse</span></span>
          </Link>
          <a href="/#contact" className="rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-5 py-2.5 text-sm font-medium transition hover:opacity-90">Start nu</a>
        </div>
      </nav>

      <main className="relative mx-auto max-w-4xl px-6 pt-32 pb-24">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-xs font-medium text-brand-300">Over TinyEclipse</span>
          </div>

          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            De slimme AI-laag voor{" "}
            <span className="bg-gradient-to-r from-brand-400 via-purple-400 to-brand-400 bg-clip-text text-transparent">jouw website</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50">
            TinyEclipse is ontwikkeld door Digital Farmers om elke website te voorzien van een intelligente AI-assistent. 
            Van chocolatier tot webshop &mdash; onze technologie past zich aan jouw bedrijf aan.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 to-brand-600/5 p-6">
            <MessageSquare className="h-6 w-6 text-brand-400" />
            <h3 className="mt-3 text-base font-semibold">AI Chat Assistent</h3>
            <p className="mt-2 text-sm text-white/40">Beantwoordt vragen van bezoekers 24/7, getraind op jouw website content.</p>
          </div>
          <div className="rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-6">
            <Shield className="h-6 w-6 text-green-400" />
            <h3 className="mt-3 text-base font-semibold">24/7 Monitoring</h3>
            <p className="mt-2 text-sm text-white/40">Uptime, SSL, performance en DNS checks. Altijd in de gaten.</p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-6">
            <BarChart3 className="h-6 w-6 text-purple-400" />
            <h3 className="mt-3 text-base font-semibold">Visitor Analytics</h3>
            <p className="mt-2 text-sm text-white/40">Begrijp je bezoekers en optimaliseer je conversie.</p>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-6">
            <Globe className="h-6 w-6 text-blue-400" />
            <h3 className="mt-3 text-base font-semibold">Multi-site Ready</h3>
            <p className="mt-2 text-sm text-white/40">Beheer meerdere websites vanuit één dashboard.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-white/40">Wil je TinyEclipse op jouw website?</p>
          <a href="/#contact" className="group mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-8 py-4 text-base font-semibold transition hover:opacity-90">
            Neem contact op <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
