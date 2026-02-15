/**
 * TinyEclipse React/Next.js Component
 * Drop-in component for any React or Next.js site.
 *
 * Usage:
 *   import { TinyEclipse } from '@/components/TinyEclipse';
 *   <TinyEclipse tenantId="your-tenant-id" />
 *
 * Or in Next.js layout.tsx:
 *   <TinyEclipse tenantId="xxx" color="#6C3CE1" name="My AI" lang="nl" />
 */
"use client";

import { useEffect } from "react";

interface TinyEclipseProps {
  tenantId: string;
  apiBase?: string;
  color?: string;
  name?: string;
  lang?: "nl" | "en" | "fr";
  position?: "bottom-right" | "bottom-left";
}

export function TinyEclipse({
  tenantId,
  apiBase = "https://api.tinyeclipse.digitalfarmers.be",
  color = "#6C3CE1",
  name = "AI Assistant",
  lang = "nl",
  position = "bottom-right",
}: TinyEclipseProps) {
  useEffect(() => {
    if (document.getElementById("tinyeclipse-widget-script")) return;

    const script = document.createElement("script");
    script.id = "tinyeclipse-widget-script";
    script.src = `${apiBase}/widget/v1/widget.js`;
    script.async = true;
    script.setAttribute("data-tenant", tenantId);
    script.setAttribute("data-api", apiBase);
    script.setAttribute("data-color", color);
    script.setAttribute("data-name", name);
    script.setAttribute("data-lang", lang);
    script.setAttribute("data-position", position);
    document.body.appendChild(script);

    return () => {
      const el = document.getElementById("tinyeclipse-widget-script");
      if (el) el.remove();
      const container = document.getElementById("te-widget-container");
      if (container) container.remove();
    };
  }, [tenantId, apiBase, color, name, lang, position]);

  return null;
}

export default TinyEclipse;
