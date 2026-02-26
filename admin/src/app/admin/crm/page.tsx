"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MessageSquare, UserPlus, Contact } from "lucide-react";

const ConversationsContent = dynamic(() => import("../conversations/page"), { ssr: false });
const LeadsContent = dynamic(() => import("../leads/page"), { ssr: false });
const ContactsContent = dynamic(() => import("../contacts/page"), { ssr: false });

const tabs = [
  { id: "conversations", label: "Gesprekken", icon: MessageSquare },
  { id: "leads", label: "Leads", icon: UserPlus },
  { id: "contacts", label: "Contacten", icon: Contact },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function CRMPage() {
  const [active, setActive] = useState<TabId>("conversations");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">CRM</h1>
        <p className="mt-1 text-sm text-white/50">Gesprekken, leads & contactbeheer</p>
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
        {active === "conversations" && <ConversationsContent />}
        {active === "leads" && <LeadsContent />}
        {active === "contacts" && <ContactsContent />}
      </div>
    </div>
  );
}
