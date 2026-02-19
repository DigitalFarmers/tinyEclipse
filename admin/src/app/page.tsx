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
  ShoppingCart,
  FileText,
  Languages,
  Mail,
  Brain,
  Eye,
  Bot,
  Database,
  Activity,
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
            <a href="#hub" className="text-sm text-white/50 transition hover:text-white">Eclipse HUB</a>
            <a href="#plans" className="text-sm text-white/50 transition hover:text-white">Pakketten</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/portal/login" className="hidden sm:block rounded-lg px-3 py-2 text-sm text-white/40 transition hover:text-white">
              Klant Portal
            </Link>
            <Link href="/admin/login" className="rounded-lg border border-white/10 bg-white/5 px-3 sm:px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              Hub Login
            </Link>
            <a href="#contact" className="rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-4 sm:px-5 py-2.5 text-sm font-medium transition hover:opacity-90">
              Start nu
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pt-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/4 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/8 blur-[150px]" />
          <div className="absolute right-1/4 top-2/3 h-[500px] w-[500px] rounded-full bg-purple-600/8 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-xs font-medium text-brand-300">AI-Powered Website Intelligence &mdash; by Digital Farmers</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-7xl">
            De complete{" "}
            <span className="bg-gradient-to-r from-brand-300 via-purple-300 to-pink-300 bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
              AI-hub
            </span>
            <br />
            voor jouw websites
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-white/45 sm:text-lg lg:text-xl">
            AI-chat, WooCommerce beheer, formulieren, meertaligheid, monitoring en analytics &mdash; 
            alles vanuit &eacute;&eacute;n krachtig dashboard. Eclipse is jouw digitale commandocentrum.
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
              Bekijk alle features
            </a>
          </div>

          {/* Trust bar */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-8">
            {[
              { icon: Bot, label: "AI Chat 24/7", sub: "Op elke site" },
              { icon: ShoppingCart, label: "WooCommerce", sub: "Volledig beheer" },
              { icon: Shield, label: "Monitoring", sub: "Uptime + SSL + DNS" },
              { icon: Languages, label: "Meertalig", sub: "WPML integratie" },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <t.icon className="h-5 w-5 text-brand-400" />
                <span className="text-xs font-semibold">{t.label}</span>
                <span className="text-[10px] text-white/30">{t.sub}</span>
              </div>
            ))}
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
              Van AI-chat tot shop management &mdash; Eclipse is de complete operating layer voor jouw WordPress sites.
            </p>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={Bot} title="AI Chat Assistent" description="Slimme chatbot getraind op jouw content. Beantwoordt vragen, genereert leads en escaleert wanneer nodig." color="brand" />
            <FeatureCard icon={ShoppingCart} title="WooCommerce Manager" description="Bestellingen, producten, omzet en top-sellers. Volledige shop analytics vanuit je Eclipse dashboard." color="green" />
            <FeatureCard icon={FileText} title="Formulieren Beheer" description="Fluent Forms inzendingen monitoren, SMTP status checken en mail templates beheren." color="purple" />
            <FeatureCard icon={Languages} title="WPML Taalcontrole" description="Beheer tot 3 talen vanuit Eclipse. Zie vertaalstatus per pagina en ontbrekende vertalingen." color="blue" />
            <FeatureCard icon={Mail} title="E-mail & SMTP" description="SMTP configuratie checken, mail delivery monitoren en WooCommerce + formulier mails afstemmen." color="yellow" />
            <FeatureCard icon={Shield} title="24/7 Monitoring" description="Uptime, SSL, performance en DNS. Automatische alerts bij problemen, resolve vanuit het dashboard." color="red" />
            <FeatureCard icon={Brain} title="AI Insights" description="Automatische analyses en aanbevelingen per site. Verkoopkansen, performance tips en actie-items." color="brand" />
            <FeatureCard icon={Eye} title="Superview" description="Helicopter view over al je sites. Klanten, domeinen, modules en stats in &eacute;&eacute;n overzicht." color="green" />
            <FeatureCard icon={Database} title="Knowledge Base" description="Automatische website scraping en indexering. Je AI leert continu bij uit jouw content." color="purple" />
          </div>
        </div>
      </section>

      {/* Hub Showcase */}
      <section id="hub" className="relative border-y border-white/5 bg-white/[0.01] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5">
              <Zap className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs font-medium text-purple-300">Eclipse HUB</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Jouw digitaal <span className="text-brand-400">commandocentrum</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/40">
              Beheer al je WordPress sites vanuit &eacute;&eacute;n krachtig dashboard. Real-time data, live AI testen, en volledige controle.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Activity, title: "Live Dashboard", desc: "Real-time stats, monitoring health bars en recente activiteit" },
              { icon: Bot, title: "AI Chat Tester", desc: "Test de AI-assistent van elke site direct vanuit de Hub" },
              { icon: MessageSquare, title: "Gesprekken Viewer", desc: "Alle chats over alle sites met confidence scores" },
              { icon: ShoppingCart, title: "Shop Manager", desc: "WooCommerce omzet, bestellingen en producten beheren" },
              { icon: FileText, title: "Forms Dashboard", desc: "Fluent Forms inzendingen bekijken en monitoren" },
              { icon: Users, title: "Klantprofielen", desc: "WHMCS-gekoppelde klantaccounts met alle projecten" },
            ].map((item) => (
              <div key={item.title} className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-brand-500/20 hover:bg-brand-500/5">
                <item.icon className="h-5 w-5 text-brand-400 transition group-hover:text-brand-300" />
                <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/35">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              In 3 stappen <span className="text-brand-400">live</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/40">
              Geen technische kennis nodig. Wij regelen alles.
            </p>
          </div>

          <div className="mt-16 space-y-6">
            <StepCard number="01" title="Wij scannen je website" description="Onze AI leest je hele website, detecteert modules (shop, forms, blog) en bouwt een kennisbank op." />
            <StepCard number="02" title="Plugin wordt geactiveerd" description="De TinyEclipse Connector plugin verbindt je WordPress site met de Hub. Chat widget, tracking en module events gaan automatisch live." />
            <StepCard number="03" title="Beheer vanuit de Hub" description="Vanaf nu beheer je alles vanuit Eclipse: AI-chat, bestellingen, formulieren, talen, monitoring en meer." />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="relative border-t border-white/5 bg-white/[0.01] px-6 py-24">
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
              price="Gratis"
              sub="voor altijd"
              description="Perfect om te starten"
              features={["AI Chat op je website", "50 berichten/maand", "5 kennisbronnen", "Uptime monitoring", "TinyEclipse branding"]}
            />
            <PlanCard
              name="Pro"
              price="&euro;9,99"
              sub="/maand"
              description="Voor groeiende bedrijven"
              featured
              features={["500 berichten/maand", "50 kennisbronnen", "Uptime + SSL + DNS monitoring", "Visitor analytics (7 dagen)", "Eigen branding", "Lead escalatie", "WooCommerce & Forms beheer"]}
            />
            <PlanCard
              name="Pro+"
              price="&euro;24,99"
              sub="/maand"
              description="Maximale controle"
              features={["Onbeperkt berichten", "Onbeperkt bronnen", "Alle monitoring incl. server", "Analytics (30 dagen)", "WPML taalcontrole", "Mail manager", "Multi-site management", "API toegang"]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="relative px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 via-purple-600/5 to-brand-500/10 p-8 sm:p-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Klaar om te starten?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/50">
              Neem contact op voor een gratis demo. Wij laten je zien hoe Eclipse jouw websites naar het volgende niveau tilt.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="mailto:info@digitalfarmers.be?subject=TinyEclipse%20Demo"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-8 py-4 text-base font-semibold transition hover:opacity-90"
              >
                Neem contact op
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </a>
              <Link
                href="/portal/login"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Klant Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold">Tiny<span className="text-brand-500">Eclipse</span></span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/30">AI-powered website intelligence.<br />Gebouwd door Digital Farmers.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Product</p>
              <div className="mt-3 flex flex-col gap-2">
                <a href="#features" className="text-xs text-white/30 transition hover:text-white/60">Features</a>
                <a href="#hub" className="text-xs text-white/30 transition hover:text-white/60">Eclipse HUB</a>
                <a href="#plans" className="text-xs text-white/30 transition hover:text-white/60">Pakketten</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Toegang</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/portal/login" className="text-xs text-white/30 transition hover:text-white/60">Klant Portal</Link>
                <Link href="/admin/login" className="text-xs text-white/30 transition hover:text-white/60">Eclipse HUB</Link>
                <a href="https://my.digitalfarmers.be" target="_blank" rel="noopener" className="text-xs text-white/30 transition hover:text-white/60">WHMCS Klantenzone</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Juridisch</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/terms" className="text-xs text-white/30 transition hover:text-white/60">Algemene Voorwaarden</Link>
                <Link href="/privacy" className="text-xs text-white/30 transition hover:text-white/60">Privacybeleid</Link>
                <a href="mailto:privacy@digitalfarmers.be" className="text-xs text-white/30 transition hover:text-white/60">privacy@digitalfarmers.be</a>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
            <p className="text-[11px] text-white/20">&copy; {new Date().getFullYear()} Digital Farmers BV. Alle rechten voorbehouden.</p>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="text-[11px] text-white/20 transition hover:text-white/40">Voorwaarden</Link>
              <Link href="/privacy" className="text-[11px] text-white/20 transition hover:text-white/40">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: any; title: string; description: string; color: string }) {
  const colors: Record<string, string> = {
    brand: "from-brand-500/10 to-brand-600/5 border-brand-500/20 group-hover:border-brand-500/40",
    green: "from-green-500/10 to-green-600/5 border-green-500/20 group-hover:border-green-500/40",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20 group-hover:border-purple-500/40",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20 group-hover:border-blue-500/40",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 group-hover:border-yellow-500/40",
    red: "from-red-500/10 to-red-600/5 border-red-500/20 group-hover:border-red-500/40",
  };
  const iconColors: Record<string, string> = {
    brand: "text-brand-400", green: "text-green-400", purple: "text-purple-400",
    blue: "text-blue-400", yellow: "text-yellow-400", red: "text-red-400",
  };
  return (
    <div className={`group rounded-2xl border bg-gradient-to-br p-5 transition ${colors[color]}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ${iconColors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-white/40">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-5 rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-white/10">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-base font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-white/40 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function PlanCard({ name, price, sub, description, features, featured = false }: { name: string; price: string; sub: string; description: string; features: string[]; featured?: boolean }) {
  return (
    <div className={`relative rounded-2xl border p-7 transition ${featured ? "border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-purple-600/5" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500 to-purple-600 px-4 py-1 text-[10px] font-bold uppercase tracking-wider">
          Populairst
        </div>
      )}
      <h3 className="text-xl font-bold">{name}</h3>
      <p className="mt-1 text-xs text-white/40">{description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold" dangerouslySetInnerHTML={{ __html: price }} />
        <span className="text-sm text-white/30">{sub}</span>
      </div>
      <ul className="mt-5 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-white/60">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
            {f}
          </li>
        ))}
      </ul>
      <a
        href="#contact"
        className={`mt-7 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
          featured ? "bg-gradient-to-r from-brand-500 to-purple-600 hover:opacity-90" : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {featured ? "Start nu" : "Meer info"}
        <ChevronRight className="h-4 w-4" />
      </a>
    </div>
  );
}
