import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TinyEclipse — AI-Powered Intelligence by Digital Farmers",
  description: "Slimme AI-chatassistenten voor jouw website. Meer conversies, betere klantenservice, 24/7 beschikbaar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className="dark">
      <body className="min-h-screen bg-brand-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
