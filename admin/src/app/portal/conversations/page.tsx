"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, User, Bot, Clock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Conversation {
  id: string;
  session_id: string;
  status: string;
  message_count: number;
  created_at: string;
  last_message_at: string;
}

export default function PortalConversationsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) { router.replace("/portal/login"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.replace("/portal/login"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/admin/conversations/?tenant_id=${session.tenant_id}`, {
      headers: { "X-Admin-Key": "" },
      cache: "no-store",
    })
      .then((r) => r.ok ? r.json() : [])
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  async function loadConversation(id: string) {
    try {
      const r = await fetch(`${API_URL}/api/admin/conversations/${id}`, {
        headers: { "X-Admin-Key": "" },
        cache: "no-store",
      });
      if (r.ok) setSelected(await r.json());
    } catch {}
  }

  if (!session) return null;

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Gesprekken</h1>
      <p className="mt-0.5 text-sm text-white/40">Bekijk wat bezoekers aan je AI vragen.</p>

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
          <span className="text-sm">Laden...</span>
        </div>
      ) : conversations.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Nog geen gesprekken.</p>
          <p className="mt-1 text-xs text-white/25">Gesprekken verschijnen hier zodra bezoekers de AI chatbot gebruiken.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {/* Conversation List */}
          <div className="space-y-2 lg:col-span-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.id === c.id
                    ? "border-brand-500/30 bg-brand-500/10"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{c.message_count} berichten</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                    c.status === "active" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
                  }`}>
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-white/30">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(c.created_at).toLocaleString("nl-BE")}
                </p>
              </button>
            ))}
          </div>

          {/* Conversation Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-xs font-medium text-white/50">Gesprek {selected.id?.slice(0, 8)}</span>
                  <span className="text-[10px] text-white/30">{new Date(selected.created_at).toLocaleString("nl-BE")}</span>
                </div>
                <div className="space-y-3">
                  {(selected.messages || []).map((msg: any, i: number) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role !== "user" && (
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/20">
                          <Bot className="h-3 w-3 text-brand-400" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                        msg.role === "user" ? "bg-brand-500/20 text-white/80" : "bg-white/5 text-white/60"
                      }`}>
                        {msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                          <User className="h-3 w-3 text-white/50" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 p-12">
                <p className="text-xs text-white/30">Selecteer een gesprek om de berichten te bekijken.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
