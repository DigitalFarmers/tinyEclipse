"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Globe, Check, Plus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Project {
  tenant_id: string;
  name: string;
  domain: string;
  plan: string;
  is_current: boolean;
}

export function ProjectSwitcher({ currentTenantId }: { currentTenantId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentTenantId) return;
    fetch(`${API_URL}/api/portal/projects/by-tenant/${currentTenantId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.projects) setProjects(data.projects);
      })
      .catch(() => {});
  }, [currentTenantId]);

  if (projects.length <= 1) return null;

  const current = projects.find((p) => p.is_current);

  function switchProject(project: Project) {
    const sess = {
      tenant_id: project.tenant_id,
      tenant_name: project.name,
      domain: project.domain,
      plan: project.plan,
    };
    sessionStorage.setItem("te_portal_session", JSON.stringify(sess));
    setOpen(false);
    window.location.href = "/portal";
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10"
      >
        <Globe className="h-3 w-3 text-brand-400" />
        <span className="max-w-[120px] truncate font-medium">{current?.domain || current?.name}</span>
        <ChevronDown className={`h-3 w-3 text-white/40 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-white/10 bg-brand-950 p-1 shadow-2xl">
            <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/25">
              Mijn Projecten
            </p>
            {projects.map((p) => (
              <button
                key={p.tenant_id}
                onClick={() => switchProject(p)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                  p.is_current ? "bg-brand-500/10" : "hover:bg-white/5"
                }`}
              >
                <Globe className={`h-3.5 w-3.5 ${p.is_current ? "text-brand-400" : "text-white/30"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <p className="truncate text-[10px] text-white/30">{p.domain}</p>
                </div>
                {p.is_current && <Check className="h-3 w-3 text-brand-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
