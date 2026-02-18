"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PortalSession {
  tenant_id: string;
  tenant_name: string;
  domain: string;
  plan: string;
}

export interface PlanFeatures {
  plan: string;
  plan_label: string;
  price: string;
  limits: {
    monthly_chat_limit: number;
    knowledge_pages_limit: number;
    events_max_hours: number;
  };
  features: {
    monitoring_uptime: boolean;
    monitoring_ssl: boolean;
    monitoring_dns: boolean;
    monitoring_performance: boolean;
    monitoring_server: boolean;
    analytics_basic: boolean;
    analytics_advanced: boolean;
    proactive_help: boolean;
    push_notifications: boolean;
    priority_support: boolean;
    custom_branding: boolean;
  };
  upgrade_url: string;
}

export function usePortalSession() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check for SSO auto-login: ?sso=tenant_id:timestamp:signature
    const params = new URLSearchParams(window.location.search);
    const sso = params.get("sso");
    if (sso) {
      const parts = sso.split(":");
      if (parts.length >= 3) {
        const tenantId = parts[0];
        const token = parts.slice(1).join(":");
        fetch(`${API_URL}/api/portal/verify?tenant_id=${tenantId}&token=${encodeURIComponent(token)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.verified) {
              const sess: PortalSession = {
                tenant_id: data.tenant_id,
                tenant_name: data.tenant_name,
                domain: data.domain,
                plan: data.plan,
              };
              sessionStorage.setItem("te_portal_session", JSON.stringify(sess));
              setSession(sess);
              window.history.replaceState({}, "", "/portal");
            } else {
              router.replace("/portal/login");
            }
          })
          .catch(() => router.replace("/portal/login"));
        return;
      }
    }

    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) {
      router.replace("/portal/login");
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      router.replace("/portal/login");
    }
  }, [router]);

  // Load plan features when session is available
  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/portal/features/${session.tenant_id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setFeatures(data);
      })
      .catch(() => {});
  }, [session]);

  return { session, features };
}
