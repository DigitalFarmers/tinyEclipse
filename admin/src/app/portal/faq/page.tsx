"use client";

import { useEffect, useState } from "react";
import {
  HelpCircle,
  Plus,
  Edit3,
  Trash2,
  GripVertical,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  order: number;
}

export default function FaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchFaq(s.tenant_id);
  }, []);

  async function fetchFaq(tid: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/portal/data/${tid}/faq`);
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || d.faq || []);
      }
    } catch {}
    setLoading(false);
  }

  async function deleteFaq(id: number) {
    if (!confirm("Deze FAQ verwijderen?")) return;
    await fetch(`${API}/api/portal/data/${tenantId}/faq/${id}/delete`, { method: "POST" });
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function saveFaq(data: Record<string, string | number>) {
    const id = editing?.id;
    const url = id
      ? `${API}/api/portal/data/${tenantId}/faq/${id}`
      : `${API}/api/portal/data/${tenantId}/faq/create`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      fetchFaq(tenantId);
      setEditing(null);
      setCreating(false);
    }
  }

  async function moveItem(id: number, direction: "up" | "down") {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newItems = [...items];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newItems.length) return;
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    setItems(newItems);
    const order = newItems.map((i, idx) => ({ id: i.id, order: idx }));
    await fetch(`${API}/api/portal/data/${tenantId}/faq/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">FAQ's</h1>
          <p className="mt-1 text-sm text-white/40">
            Veelgestelde vragen — je AI assistent gebruikt deze om bezoekers te helpen
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setCreating(true); setEditing(null); }}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            Nieuwe FAQ
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400" />
        <div>
          <p className="text-sm font-medium text-brand-400">AI-powered FAQ's</p>
          <p className="mt-0.5 text-xs text-white/40">
            Je FAQ's worden automatisch gebruikt door je AI assistent om bezoekers te helpen.
            Hoe meer FAQ's je toevoegt, hoe slimmer je assistent wordt.
          </p>
        </div>
      </div>

      {/* FAQ List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
          <HelpCircle className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-white/30">Nog geen FAQ's. Voeg je eerste vraag toe!</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-brand-500/10 px-4 py-2 text-sm text-brand-400 transition hover:bg-brand-500/20"
          >
            <Plus className="h-4 w-4" />
            Eerste FAQ toevoegen
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] transition hover:border-white/10"
            >
              <div className="flex items-center gap-3 p-4">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveItem(item.id, "up")}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-white/20 hover:text-white/50 disabled:opacity-20"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveItem(item.id, "down")}
                    disabled={idx === items.length - 1}
                    className="rounded p-0.5 text-white/20 hover:text-white/50 disabled:opacity-20"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Question */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <h3 className="text-sm font-medium text-white">{item.question}</h3>
                  {item.category && (
                    <span className="mt-1 inline-block rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
                      {item.category}
                    </span>
                  )}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditing(item)}
                    className="rounded-lg p-2 text-white/20 hover:bg-white/5 hover:text-white"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteFaq(item.id)}
                    className="rounded-lg p-2 text-white/20 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="rounded-lg p-2 text-white/20 hover:text-white"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition ${expanded.has(item.id) ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* Answer */}
              {expanded.has(item.id) && (
                <div className="border-t border-white/5 bg-white/[0.01] px-4 py-3 pl-12">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/50">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {(editing || creating) && (
        <FaqModal
          item={editing}
          onSave={saveFaq}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function FaqModal({
  item,
  onSave,
  onClose,
}: {
  item: FaqItem | null;
  onSave: (data: Record<string, string | number>) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState(item?.question || "");
  const [answer, setAnswer] = useState(item?.answer || "");
  const [category, setCategory] = useState(item?.category || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    await onSave({ question, answer, category });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {item ? "FAQ Bewerken" : "Nieuwe FAQ"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Vraag</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Bijv. Wat zijn jullie openingsuren?"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Antwoord</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="Het antwoord op de vraag..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/40">Categorie (optioneel)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Bijv. Algemeen, Bestellen, Levering"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/40 transition hover:text-white">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !question.trim() || !answer.trim()}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
