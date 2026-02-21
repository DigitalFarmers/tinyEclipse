"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import { Shield, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/60">
          <ArrowLeft className="h-3 w-3" /> Terug
        </Link>

        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-brand-400" />
          <h1 className="text-2xl font-bold">Algemene Voorwaarden</h1>
        </div>
        <p className="mt-2 text-sm text-white/40">Laatst bijgewerkt: 19 februari 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-white/60">
          <Section title="1. Definities">
            <p><strong className="text-white/80">Digital Farmers</strong> — Digital Farmers, gevestigd te België, eigenaar en beheerder van het TinyEclipse platform.</p>
            <p><strong className="text-white/80">TinyEclipse</strong> — Het AI-gestuurde website intelligence platform ontwikkeld door Digital Farmers.</p>
            <p><strong className="text-white/80">Klant</strong> — De natuurlijke persoon of rechtspersoon die een overeenkomst aangaat met Digital Farmers voor het gebruik van TinyEclipse.</p>
            <p><strong className="text-white/80">Bezoeker</strong> — Een persoon die een website bezoekt waarop de TinyEclipse widget actief is.</p>
            <p><strong className="text-white/80">Portal</strong> — Het klantportaal waar de Klant inzicht krijgt in websitedata, AI-gesprekken, monitoring en rapporten.</p>
          </Section>

          <Section title="2. Dienstverlening">
            <p>TinyEclipse biedt de volgende diensten aan, afhankelijk van het gekozen abonnement:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>AI-chatbot voor websitebezoekers (kennisbank-gebaseerd)</li>
              <li>Website monitoring (uptime, SSL, DNS, performance)</li>
              <li>Bezoekersanalyse en gedragstracking</li>
              <li>Module-detectie en event tracking</li>
              <li>AI-gegenereerde rapporten en inzichten</li>
              <li>E-mail monitoring en deliverability checks</li>
            </ul>
          </Section>

          <Section title="3. Abonnementen & Prijzen">
            <p>TinyEclipse is beschikbaar in drie abonnementsvormen:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong className="text-white/80">Tiny (Gratis)</strong> — 50 berichten/maand, 5 kennispagina&apos;s, basis uptime monitoring</li>
              <li><strong className="text-white/80">Pro (€9,99/maand)</strong> — 500 berichten/maand, 50 kennispagina&apos;s, uitgebreide monitoring, 7 dagen events</li>
              <li><strong className="text-white/80">Pro+ (€24,99/maand)</strong> — Onbeperkt berichten, alle monitoring inclusief server, 30 dagen events, prioriteit support</li>
            </ul>
            <p>Prijzen zijn exclusief BTW. Facturatie verloopt via WHMCS. Abonnementen worden maandelijks gefactureerd en zijn op elk moment opzegbaar.</p>
          </Section>

          <Section title="4. Gebruik van de AI-chatbot">
            <p>De AI-chatbot van TinyEclipse:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Antwoordt uitsluitend op basis van goedgekeurde kennisbronnen van de Klant</li>
              <li>Verzint nooit informatie en geeft geen juridisch, financieel of medisch advies</li>
              <li>Kan gesprekken escaleren naar het team van de Klant wanneer de AI onzeker is</li>
              <li>Slaat gesprekken op voor kwaliteitsverbetering en inzicht</li>
            </ul>
            <p>De Klant is verantwoordelijk voor de juistheid van de kennisbronnen die aan TinyEclipse worden aangeleverd.</p>
          </Section>

          <Section title="5. Data & Privacy">
            <p>Zie ons <Link href="/privacy" className="text-brand-400 hover:underline">Privacybeleid</Link> voor volledige details over gegevensverwerking.</p>
            <p>Samengevat:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Bezoekersdata wordt geanonimiseerd opgeslagen (geen persoonlijke identificatie)</li>
              <li>Chatgesprekken worden opgeslagen per tenant en zijn alleen toegankelijk voor de Klant</li>
              <li>Bezoekers moeten consent geven voordat een chatgesprek start</li>
              <li>Data wordt opgeslagen op servers binnen de EU</li>
              <li>Digital Farmers verwerkt data als verwerker namens de Klant (verwerkersovereenkomst beschikbaar op aanvraag)</li>
            </ul>
          </Section>

          <Section title="6. Beschikbaarheid & SLA">
            <p>Digital Farmers streeft naar een uptime van 99,5% voor het TinyEclipse platform. Bij gepland onderhoud wordt de Klant minimaal 24 uur vooraf geïnformeerd.</p>
            <p>De monitoring dienst controleert websites van de Klant op beschikbaarheid, maar Digital Farmers is niet verantwoordelijk voor de hosting of beschikbaarheid van de website van de Klant zelf.</p>
          </Section>

          <Section title="7. Intellectueel Eigendom">
            <p>Het TinyEclipse platform, inclusief alle software, ontwerpen, algoritmes en documentatie, is eigendom van Digital Farmers. De Klant krijgt een niet-exclusief, niet-overdraagbaar gebruiksrecht voor de duur van het abonnement.</p>
            <p>Kennisbronnen en content die door de Klant worden aangeleverd, blijven eigendom van de Klant.</p>
          </Section>

          <Section title="8. Aansprakelijkheid">
            <p>Digital Farmers is niet aansprakelijk voor:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Onjuiste antwoorden van de AI-chatbot gebaseerd op door de Klant aangeleverde kennisbronnen</li>
              <li>Schade als gevolg van downtime van de website van de Klant</li>
              <li>Indirecte schade, gevolgschade of gederfde winst</li>
            </ul>
            <p>De totale aansprakelijkheid van Digital Farmers is beperkt tot het bedrag dat de Klant in de afgelopen 12 maanden aan abonnementskosten heeft betaald.</p>
          </Section>

          <Section title="9. Beëindiging">
            <p>Het abonnement kan op elk moment worden opgezegd. Bij opzegging:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Wordt de dienst aan het einde van de lopende facturatieperiode stopgezet</li>
              <li>Worden alle data binnen 30 dagen na beëindiging verwijderd</li>
              <li>Kan de Klant een export van zijn data aanvragen vóór beëindiging</li>
            </ul>
          </Section>

          <Section title="10. Toepasselijk Recht">
            <p>Op deze overeenkomst is Belgisch recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechtbank te België.</p>
          </Section>

          <Section title="11. Wijzigingen">
            <p>Digital Farmers behoudt zich het recht voor deze voorwaarden te wijzigen. Klanten worden minimaal 30 dagen vooraf geïnformeerd over materiële wijzigingen.</p>
          </Section>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/40">
              Door gebruik te maken van TinyEclipse gaat u akkoord met deze Algemene Voorwaarden.
              Vragen? Neem contact op via <a href="mailto:info@digitalfarmers.be" className="text-brand-400 hover:underline">info@digitalfarmers.be</a>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-white/90">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
