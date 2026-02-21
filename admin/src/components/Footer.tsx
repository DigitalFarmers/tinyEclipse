import Link from "next/link";
import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold">Tiny<span className="text-brand-500">Eclipse</span></span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-white/30">AI-powered website intelligence.<br />Gebouwd door Digital Farmers.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Product</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/#features" className="text-xs text-white/30 transition hover:text-white/60">Features</Link>
              <Link href="/#hub" className="text-xs text-white/30 transition hover:text-white/60">Eclipse HUB</Link>
              <Link href="/#plans" className="text-xs text-white/30 transition hover:text-white/60">Pakketten</Link>
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
  );
}
