"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Database, Wheat, ArrowLeftRight } from "lucide-react";

const SourcesContent = dynamic(() => import("../sources/page"), { ssr: false });
const ProductIntelContent = dynamic(() => import("../product-intelligence/page"), { ssr: false });
const SyncContent = dynamic(() => import("../sync/page"), { ssr: false });

const tabs = [
  { id: "sources", label: "Knowledge Base", icon: Database },
  { id: "product-intel", label: "Product Intel", icon: Wheat },
  { id: "sync", label: "Cross-Site Sync", icon: ArrowLeftRight },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function KnowledgePage() {
  const [active, setActive] = useState<TabId>("sources");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <p className="mt-1 text-sm text-white/50">Kennisbank, productintelligentie & cross-site synchronisatie</p>
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
        {active === "sources" && <SourcesContent />}
        {active === "product-intel" && <ProductIntelContent />}
        {active === "sync" && <SyncContent />}
      </div>
    </div>
  );
}
