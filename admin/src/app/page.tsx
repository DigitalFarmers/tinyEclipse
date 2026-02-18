import Link from "next/link";
import {
  Zap,
  MessageSquare,
  Shield,
  BarChart3,
  Globe,
  ArrowRight,
  CheckCircle,
  Users,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-brand-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600">
              <Zap className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Tiny<span className="text-brand-500">Eclipse</span>
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-white/50 transition hover:text-white">Features</a>
            <a href="#plans" className="text-sm text-white/50 transition hover:text-white">Pakketten</a>
            <a href="#about" className="text-sm text-white/50 transition hover:text-white">Over ons</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-lg px-4 py-2 text-sm text-white/60 transition hover:text-white">
              Login
            </Link>
            <a href="#contact" className="rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-5 py-2.5 text-sm font-medium transition hover:opacity-90">
              Start nu
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pt-16">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
          <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-xs font-medium text-brand-300">Powered by AI &mdash; Built by Digital Farmers</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Jouw website verdient een{" "}
            <span className="bg-gradient-to-r from-brand-400 via-purple-400 to-brand-400 bg-clip-text text-transparent">
              slimme assistent
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50 sm:text-xl">
            TinyEclipse plaatst een AI-chatassistent op jouw website die je bezoekers 24/7 helpt, 
            vragen beantwoordt en leads omzet in klanten. Volledig op maat, volledig geautomatiseerd.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="#contact"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-8 py-4 text-base font-semibold transition hover:opacity-90"
            >
              Gratis demo aanvragen
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
            <a
              href="#features"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Ontdek de features
            </a>
          </div>

          {/* Social proof */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/20">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium">Actief op 50+ websites</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs font-medium">10.000+ gesprekken/maand</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium">99.9% uptime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Alles wat je nodig hebt,{" "}
              <span className="text-brand-400">in &eacute;&eacute;n platform</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/40">
              Van slimme chatbot tot 24/7 monitoring &mdash; TinyEclipse is de complete AI-laag voor jouw online business.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={MessageSquare}
              title="AI Chat Assistent"
              description="Een slimme chatbot die jouw bezoekers helpt met vragen over producten, diensten en meer. Getraind op jouw content."
              color="brand"
            />
            <FeatureCard
              icon={Shield}
              title="24/7 Monitoring"
              description="Uptime, SSL, performance en DNS checks. Wij houden je site in de gaten zodat jij kunt slapen."
              color="green"
            />
            <FeatureCard
              icon={BarChart3}
              title="Visitor Analytics"
              description="Begrijp je bezoekers. Zie welke pagina's populair zijn, waar ze vandaan komen en hoe ze converteren."
              color="purple"
            />
            <FeatureCard
              icon={Users}
              title="Lead Tracking"
              description="Volg het complete traject van elke bezoeker. Van eerste klik tot conversie, alles in je dashboard."
              color="blue"
            />
            <FeatureCard
              icon={TrendingUp}
              title="Conversie Optimalisatie"
              description="Proactieve berichten op het juiste moment. Verhoog je conversieratio met slimme triggers."
              color="yellow"
            />
            <FeatureCard
              icon={Clock}
              title="Altijd Beschikbaar"
              description="Je AI-assistent werkt 24/7, 365 dagen per jaar. Geen wachttijden, altijd een antwoord."
              color="red"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative border-y border-white/5 bg-white/[0.01] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              In 3 stappen <span className="text-brand-400">live</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/40">
              Geen technische kennis nodig. Wij regelen alles.
            </p>
          </div>

          <div className="mt-16 space-y-8">
            <StepCard
              number="01"
              title="Wij scannen je website"
              description="Onze AI leest je hele website en leert alles over je producten, diensten en veelgestelde vragen."
            />
            <StepCard
              number="02"
              title="Widget wordt geplaatst"
              description="Met een simpele WordPress plugin of een regel code verschijnt de chatbot op je site. Volledig in jouw huisstijl."
            />
            <StepCard
              number="03"
              title="Je assistent gaat live"
              description="Vanaf nu beantwoordt je AI-assistent vragen, volgt bezoekers en stuurt leads door. Jij ziet alles in je dashboard."
            />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Een pakket voor elke <span className="text-brand-400">ambitie</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/40">
              Start klein, groei mee. Upgrade wanneer je wilt.
            </p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            <PlanCard
              name="Tiny"
              price="Gratis*"
              description="Perfect om te starten"
              features={[
                "AI Chat op je website",
                "Basis FAQ beantwoording",
                "Tot 500 berichten/maand",
                "TinyEclipse branding",
              ]}
            />
            <PlanCard
              name="Pro"
              price="Op aanvraag"
              description="Voor groeiende bedrijven"
              featured
              features={[
                "Alles van Tiny +",
                "Volledige kennisbank (RAG)",
                "Visitor tracking & analytics",
                "Lead scoring & escalatie",
                "Eigen branding",
                "24/7 site monitoring",
              ]}
            />
            <PlanCard
              name="Pro+"
              price="Op aanvraag"
              description="Enterprise & agencies"
              features={[
                "Alles van Pro +",
                "Geavanceerde analytics",
                "Multi-site management",
                "API toegang",
                "Dedicated support",
                "Custom integraties",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="relative px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 via-purple-600/5 to-brand-500/10 p-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Klaar om te starten?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/50">
              Neem contact op voor een gratis demo. Wij laten je zien hoe TinyEclipse jouw website slimmer maakt.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="mailto:info@digitalfarmers.be?subject=TinyEclipse%20Demo"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-8 py-4 text-base font-semibold transition hover:opacity-90"
              >
                Neem contact op
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </a>
              <a
                href="tel:+32468123456"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Bel ons
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold">
              Tiny<span className="text-brand-500">Eclipse</span>
            </span>
          </div>
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Digital Farmers. Alle rechten voorbehouden.
          </p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-xs text-white/30 transition hover:text-white/60">Privacy</a>
            <a href="/terms" className="text-xs text-white/30 transition hover:text-white/60">Voorwaarden</a>
            <Link href="/admin" className="text-xs text-white/30 transition hover:text-white/60">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: any;
  title: string;
  description: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20 group-hover:border-brand-500/40",
    green: "from-green-500/10 to-green-600/5 border-green-500/20 group-hover:border-green-500/40",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20 group-hover:border-purple-500/40",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20 group-hover:border-blue-500/40",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 group-hover:border-yellow-500/40",
    red: "from-red-500/10 to-red-600/5 border-red-500/20 group-hover:border-red-500/40",
  };
  const iconColors: Record<string, string> = {
    brand: "text-brand-400",
    green: "text-green-400",
    purple: "text-purple-400",
    blue: "text-blue-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  };

  return (
    <div className={`group rounded-2xl border bg-gradient-to-br p-6 transition ${colors[color]}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ${iconColors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/40">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition hover:border-white/10">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-lg font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-white/40">{description}</p>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  description,
  features,
  featured = false,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-8 transition ${
        featured
          ? "border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-purple-600/5"
          : "border-white/5 bg-white/[0.02] hover:border-white/10"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500 to-purple-600 px-4 py-1 text-[10px] font-bold uppercase tracking-wider">
          Populairst
        </div>
      )}
      <h3 className="text-xl font-bold">{name}</h3>
      <p className="mt-1 text-sm text-white/40">{description}</p>
      <p className="mt-4 text-3xl font-extrabold">{price}</p>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-white/60">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-400" />
            {f}
          </li>
        ))}
      </ul>
      <a
        href="#contact"
        className={`mt-8 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
          featured
            ? "bg-gradient-to-r from-brand-500 to-purple-600 hover:opacity-90"
            : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {featured ? "Start nu" : "Meer info"}
        <ChevronRight className="h-4 w-4" />
      </a>
    </div>
  );
}
