"use client";

import { useEffect, useState } from "react";
import { getConversations, getConversation } from "@/lib/api";

interface ConversationSummary {
  id: string;
  tenant_id: string;
  session_id: string;
  channel: string;
  status: string;
  created_at: string;
  message_count: number;
}

interface MessageDetail {
  id: string;
  role: string;
  content: string;
  confidence: number | null;
  sources_used: any[] | null;
  escalated: boolean;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  tenant_id: string;
  session_id: string;
  channel: string;
  status: string;
  created_at: string;
  messages: MessageDetail[];
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConversations(undefined, filter || undefined)
      .then(setConversations)
      .catch((e) => setError(e.message));
  }, [filter]);

  const openConversation = async (id: string) => {
    try {
      const detail = await getConversation(id);
      setSelected(detail);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="mt-1 text-sm text-white/50">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {["", "active", "escalated", "closed"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === s ? "bg-brand-600 text-white" : "border border-white/10 text-white/50 hover:bg-white/5"}`}>{s || "All"}</button>
          ))}
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {conversations.map((c) => (
            <button key={c.id} onClick={() => openConversation(c.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === c.id ? "border-brand-500 bg-brand-500/10" : "border-white/10 hover:bg-white/5"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">{c.channel}</span>
                <span className={`text-xs font-medium ${c.status === "escalated" ? "text-red-400" : c.status === "active" ? "text-emerald-400" : "text-white/40"}`}>{c.status}</span>
              </div>
              <p className="mt-1 text-sm font-medium truncate">Session: {c.session_id.slice(0, 16)}...</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
                <span>{c.message_count} messages</span>
                <span>{new Date(c.created_at).toLocaleString("nl-BE")}</span>
              </div>
            </button>
          ))}
          {conversations.length === 0 && <div className="rounded-xl border border-white/10 p-8 text-center text-white/30">Geen gesprekken gevonden.</div>}
        </div>

        {selected && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-semibold">Conversation Detail</h3>
                <p className="text-xs text-white/40">{new Date(selected.created_at).toLocaleString("nl-BE")} — {selected.status}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white">&times;</button>
            </div>
            <div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto">
              {selected.messages.map((m) => (
                <div key={m.id} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "ml-8 bg-brand-900 text-white" : m.escalated ? "mr-8 border-l-2 border-red-500 bg-white/5" : "mr-8 bg-white/5"}`}>
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span className="font-medium uppercase">{m.role}</span>
                    {m.confidence !== null && <span>Confidence: {Math.round(m.confidence * 100)}%</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
                  {m.escalated && <span className="mt-2 inline-block rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">Escalated</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
