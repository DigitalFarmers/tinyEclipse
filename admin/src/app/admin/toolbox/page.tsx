"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Key, Package, Mail, Image } from "lucide-react";

const ApiKeysContent = dynamic(() => import("../apikeys/page"), { ssr: false });
const UpdaterContent = dynamic(() => import("../updater/page"), { ssr: false });
const DigestContent = dynamic(() => import("../digest/page"), { ssr: false });
const CompressorContent = dynamic(() => import("../compressor/page"), { ssr: false });

const tabs = [
  { id: "apikeys", label: "API Keys", icon: Key },
  { id: "updater", label: "Plugin Updater", icon: Package },
  { id: "digest", label: "Email Digest", icon: Mail },
  { id: "compressor", label: "Compressor", icon: Image },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function ToolboxPage() {
  const [active, setActive] = useState<TabId>("apikeys");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Toolbox</h1>
        <p className="mt-1 text-sm text-white/50">API sleutels, plugin updates, email digests & beeldcompressie</p>
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
        {active === "apikeys" && <ApiKeysContent />}
        {active === "updater" && <UpdaterContent />}
        {active === "digest" && <DigestContent />}
        {active === "compressor" && <CompressorContent />}
      </div>
    </div>
  );
}
