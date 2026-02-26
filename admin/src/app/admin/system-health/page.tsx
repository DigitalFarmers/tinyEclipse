"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Shield } from "lucide-react";

const RegistryContent = dynamic(() => import("../registry/page"), { ssr: false });
const HardeningContent = dynamic(() => import("../hardening/page"), { ssr: false });

const tabs = [
  { id: "registry", label: "Tech Registry", icon: Activity },
  { id: "hardening", label: "Hardening", icon: Shield },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function SystemHealthPage() {
  const [active, setActive] = useState<TabId>("registry");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="mt-1 text-sm text-white/50">Technisch register, beveiligingsaudits & systeemoptimalisatie</p>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              active === tab.id
                ? "bg-brand-500/20 text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {active === "registry" && <RegistryContent />}
        {active === "hardening" && <HardeningContent />}
      </div>
    </div>
  );
}
