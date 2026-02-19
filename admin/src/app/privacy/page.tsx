"use client";

import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/60">
        <ArrowLeft className="h-3 w-3" /> Terug
      </Link>

      <div className="flex items-center gap-3">
        <Lock className="h-6 w-6 text-brand-400" />
        <h1 className="text-2xl font-bold">Privacybeleid</h1>
      </div>
      <p className="mt-2 text-sm text-white/40">Laatst bijgewerkt: 19 februari 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-white/60">
        <Section title="1. Wie zijn wij?">
          <p>Digital Farmers is de verwerkingsverantwoordelijke voor het TinyEclipse platform. Wij zijn gevestigd in België en bereikbaar via <a href="mailto:info@digitalfarmers.be" className="text-brand-400 hover:underline">info@digitalfarmers.be</a>.</p>
        </Section>

        <Section title="2. Welke gegevens verzamelen wij?">
          <h3 className="mt-3 font-semibold text-white/70">2.1 Websitebezoekers (via de widget)</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>Geanonimiseerd IP-adres (laatste octet verwijderd)</li>
            <li>Browser type en versie (user agent)</li>
            <li>Bezochte pagina&apos;s en sessieduur</li>
            <li>Chatberichten (alleen na expliciete consent)</li>
            <li>Referrer URL</li>
            <li>Apparaattype (desktop/mobiel/tablet)</li>
          </ul>

          <h3 className="mt-3 font-semibold text-white/70">2.2 Klanten (via het portal)</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>Naam, e-mailadres en bedrijfsnaam (via WHMCS)</li>
            <li>Websitedomein en configuratie</li>
            <li>Facturatiegegevens (verwerkt via WHMCS)</li>
            <li>Inloggegevens voor het portal (SSO via WHMCS)</li>
          </ul>

          <h3 className="mt-3 font-semibold text-white/70">2.3 Wat wij NIET verzamelen</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>Wij gebruiken geen cookies voor tracking</li>
            <li>Wij verkopen nooit data aan derden</li>
            <li>Wij slaan geen wachtwoorden op (SSO via WHMCS)</li>
            <li>Wij tracken bezoekers niet over meerdere websites</li>
          </ul>
        </Section>

        <Section title="3. Waarom verzamelen wij deze gegevens?">
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 text-left font-semibold text-white/70">Doel</th>
                <th className="py-2 text-left font-semibold text-white/70">Rechtsgrond</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2">AI-chatbot antwoorden genereren</td><td className="py-2">Toestemming (consent widget)</td></tr>
              <tr><td className="py-2">Website monitoring & alerts</td><td className="py-2">Uitvoering overeenkomst</td></tr>
              <tr><td className="py-2">Bezoekersstatistieken tonen</td><td className="py-2">Gerechtvaardigd belang</td></tr>
              <tr><td className="py-2">Facturatie & accountbeheer</td><td className="py-2">Uitvoering overeenkomst</td></tr>
              <tr><td className="py-2">Platformverbetering</td><td className="py-2">Gerechtvaardigd belang</td></tr>
            </tbody>
          </table>
        </Section>

        <Section title="4. Consent voor chatgesprekken">
          <p>Voordat een bezoeker een chatgesprek kan starten met de AI-assistent, moet deze expliciet toestemming geven via de consent-widget. Zonder toestemming worden geen chatberichten opgeslagen.</p>
          <p>De consent wordt geregistreerd met:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Tijdstip van toestemming</li>
            <li>Versie van de voorwaarden</li>
            <li>Geanonimiseerd IP-adres</li>
            <li>Session ID (geen persoonlijke identificatie)</li>
          </ul>
        </Section>

        <Section title="5. Hoe lang bewaren wij data?">
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 text-left font-semibold text-white/70">Data</th>
                <th className="py-2 text-left font-semibold text-white/70">Bewaartermijn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2">Chatgesprekken</td><td className="py-2">12 maanden</td></tr>
              <tr><td className="py-2">Bezoekersstatistieken</td><td className="py-2">12 maanden</td></tr>
              <tr><td className="py-2">Monitoring resultaten</td><td className="py-2">12 maanden</td></tr>
              <tr><td className="py-2">Consent records</td><td className="py-2">5 jaar (wettelijke verplichting)</td></tr>
              <tr><td className="py-2">Klantgegevens</td><td className="py-2">Duur abonnement + 30 dagen</td></tr>
            </tbody>
          </table>
        </Section>

        <Section title="6. Waar wordt data opgeslagen?">
          <p>Alle data wordt opgeslagen op servers binnen de Europese Unie (OVH, Frankrijk). Wij maken gebruik van de volgende sub-verwerkers:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong className="text-white/80">OVH (Frankrijk)</strong> — Server hosting</li>
            <li><strong className="text-white/80">Groq (VS)</strong> — AI-taalmodel verwerking (alleen chatberichten, geen persoonlijke data)</li>
            <li><strong className="text-white/80">Cloudflare (VS)</strong> — DNS en DDoS-bescherming</li>
          </ul>
          <p>Voor verwerking buiten de EU (Groq) zijn passende waarborgen getroffen conform de GDPR.</p>
        </Section>

        <Section title="7. Uw rechten (GDPR)">
          <p>Als betrokkene heeft u de volgende rechten:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong className="text-white/80">Recht op inzage</strong> — Vraag welke gegevens wij van u verwerken</li>
            <li><strong className="text-white/80">Recht op rectificatie</strong> — Laat onjuiste gegevens corrigeren</li>
            <li><strong className="text-white/80">Recht op verwijdering</strong> — Vraag verwijdering van uw gegevens</li>
            <li><strong className="text-white/80">Recht op beperking</strong> — Beperk de verwerking van uw gegevens</li>
            <li><strong className="text-white/80">Recht op overdraagbaarheid</strong> — Ontvang uw gegevens in een gestructureerd formaat</li>
            <li><strong className="text-white/80">Recht van bezwaar</strong> — Maak bezwaar tegen verwerking op basis van gerechtvaardigd belang</li>
          </ul>
          <p>Neem contact op via <a href="mailto:privacy@digitalfarmers.be" className="text-brand-400 hover:underline">privacy@digitalfarmers.be</a> om uw rechten uit te oefenen. Wij reageren binnen 30 dagen.</p>
        </Section>

        <Section title="8. Beveiliging">
          <p>Wij nemen de volgende maatregelen om uw data te beschermen:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Versleutelde verbindingen (TLS/SSL) voor alle communicatie</li>
            <li>Versleutelde database opslag</li>
            <li>Toegangscontrole op basis van API-sleutels en SSO</li>
            <li>Regelmatige beveiligingsaudits</li>
            <li>Tenant-isolatie: data van verschillende klanten is strikt gescheiden</li>
          </ul>
        </Section>

        <Section title="9. Klachten">
          <p>Heeft u een klacht over onze gegevensverwerking? Neem eerst contact met ons op. U kunt ook een klacht indienen bij de Gegevensbeschermingsautoriteit (GBA): <a href="https://www.gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener" className="text-brand-400 hover:underline">www.gegevensbeschermingsautoriteit.be</a></p>
        </Section>

        <Section title="10. Wijzigingen">
          <p>Dit privacybeleid kan worden gewijzigd. Bij materiële wijzigingen informeren wij klanten per e-mail en bezoekers via een melding op de website.</p>
        </Section>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40">
            Vragen over privacy? Neem contact op via <a href="mailto:privacy@digitalfarmers.be" className="text-brand-400 hover:underline">privacy@digitalfarmers.be</a>
          </p>
          <p className="mt-2 text-xs text-white/40">
            Zie ook onze <Link href="/terms" className="text-brand-400 hover:underline">Algemene Voorwaarden</Link>.
          </p>
        </div>
      </div>
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
