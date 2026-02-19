"use client";

import { useEffect, useState } from "react";
import {
  Gauge, MapPin, Clock, Globe, RefreshCw, Zap, Database, ShoppingCart, Compass, CheckCircle, XCircle,
} from "lucide-react";
import { getTenants, getCalibration, getCalibrations, enrichTenantGeo, updateTenantGeo } from "@/lib/api";

export default function CalibrationPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [calibrations, setCalibrations] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [geoForm, setGeoForm] = useState({ city: "", country: "BE", postcode: "", business_type: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [ts, cals] = await Promise.all([
        getTenants().catch(() => []),
        getCalibrations().catch(() => []),
      ]);
      setTenants(ts.filter((t: any) => t.environment !== "staging"));
      setCalibrations(cals);
    } finally { setLoading(false); }
  }

  async function selectTenant(id: string) {
    setSelected(id);
    try {
      const d = await getCalibration(id);
      setDetail(d);
      setGeoForm({ city: d.city || "", country: d.country || "BE", postcode: d.postcode || "", business_type: "" });
    } catch { }
  }

  async function runEnrich() {
    if (!selected) return;
    setEnriching(true);
    try {
      await enrichTenantGeo(selected);
      const d = await getCalibration(selected);
      setDetail(d);
      await loadData();
    } finally { setEnriching(false); }
  }

  async function saveGeo() {
    if (!selected) return;
    setEnriching(true);
    try {
      await updateTenantGeo(selected, geoForm);
      const d = await getCalibration(selected);
      setDetail(d);
      await loadData();
    } finally { setEnriching(false); }
  }

  const scoreColor = (s: number) => s >= 0.7 ? "text-green-400" : s >= 0.4 ? "text-yellow-400" : "text-red-400";
  const scoreBg = (s: number) => s >= 0.7 ? "bg-green-500" : s >= 0.4 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gauge className="h-6 w-6 text-brand-400" /> Calibratie
          </h1>
          <p className="mt-0.5 text-sm text-white/40">Hoe goed kent Eclipse elke site — locatie, tijd, buurt, kennis</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 hover:bg-white/10">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Overview Grid */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {calibrations.map((c: any) => (
          <button key={c.tenant_id} onClick={() => selectTenant(c.tenant_id)}
            className={`w-full text-left rounded-xl border p-4 transition hover:bg-white/[0.04] ${selected === c.tenant_id ? "border-brand-500/30 bg-brand-500/5" : "border-white/5 bg-white/[0.02]"}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <p className="text-[11px] text-white/30">{c.domain}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${scoreColor(c.calibration_score)}`}>{Math.round((c.calibration_score || 0) * 100)}%</p>
                <p className="text-[9px] text-white/25">calibratie</p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${scoreBg(c.calibration_score)} transition-all`} style={{ width: `${(c.calibration_score || 0) * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-white/30">
              {c.city && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{c.city}</span>}
              <span className="flex items-center gap-1"><Database className="h-2.5 w-2.5" />{c.sources} bronnen</span>
              <span className="flex items-center gap-1"><ShoppingCart className="h-2.5 w-2.5" />{c.modules} modules</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail Panel */}
      {detail && (
        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{detail.tenant_name}</h2>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${scoreColor(detail.calibration_score)}`}>{Math.round((detail.calibration_score || 0) * 100)}%</span>
              <button onClick={runEnrich} disabled={enriching}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40">
                <Zap className={`h-3 w-3 ${enriching ? "animate-spin" : ""}`} />
                {enriching ? "Bezig..." : "Auto-Calibreer"}
              </button>
            </div>
          </div>

          {/* Breakdown checklist */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { icon: MapPin, label: "Locatie", ok: detail.breakdown?.location, detail: detail.city ? `${detail.city}, ${detail.country}` : "Niet ingesteld" },
              { icon: Clock, label: "Tijdzone", ok: detail.breakdown?.timezone, detail: detail.timezone || "Niet ingesteld" },
              { icon: Compass, label: "Buurtkennis", ok: detail.breakdown?.regional_knowledge, detail: detail.regional_context?.character?.slice(0, 50) || "Niet beschikbaar" },
              { icon: Globe, label: "Buurtbeschrijving", ok: detail.breakdown?.neighborhood, detail: detail.neighborhood_description ? "Beschikbaar" : "Niet beschikbaar" },
              { icon: Database, label: "Kennisbank", ok: detail.breakdown?.knowledge_base, detail: `${detail.indexed_sources} geïndexeerd` },
              { icon: ShoppingCart, label: "Modules", ok: detail.breakdown?.modules_detected, detail: `${detail.modules} gedetecteerd` },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-3 rounded-xl border p-3 ${item.ok ? "border-green-500/20 bg-green-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                {item.ok ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-400" /> : <XCircle className="h-4 w-4 flex-shrink-0 text-white/20" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[10px] text-white/40 truncate">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Neighborhood description */}
          {detail.neighborhood_description && (
            <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-2">Buurtkennis</h3>
              <p className="text-sm text-white/60 leading-relaxed">{detail.neighborhood_description}</p>
            </div>
          )}

          {/* Time context */}
          {detail.time_context && (
            <div className="mt-3 rounded-xl bg-white/[0.03] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-2">Tijdsbewustzijn</h3>
              <div className="flex flex-wrap gap-2">
                {detail.time_context.current_day && <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] text-blue-400">{detail.time_context.current_day} {detail.time_context.current_hour}:00</span>}
                {detail.time_context.season && <span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-[11px] text-purple-400">{detail.time_context.season}</span>}
                {detail.time_context.is_weekend && <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] text-green-400">Weekend</span>}
                {detail.time_context.is_business_hours && <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] text-green-400">Kantooruren</span>}
                {detail.time_context.is_evening && <span className="rounded-full bg-yellow-500/15 px-2.5 py-1 text-[11px] text-yellow-400">Avond</span>}
                {detail.time_context.greeting_style && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/40">{detail.time_context.greeting_style}</span>}
              </div>
            </div>
          )}

          {/* Manual Geo Setup */}
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3">Locatie instellen</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="text-[10px] text-white/30">Stad</label>
                <input type="text" value={geoForm.city} onChange={e => setGeoForm(p => ({ ...p, city: e.target.value }))}
                  placeholder="Antwerpen" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-brand-500/30" />
              </div>
              <div>
                <label className="text-[10px] text-white/30">Land</label>
                <select value={geoForm.country} onChange={e => setGeoForm(p => ({ ...p, country: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none">
                  <option value="BE" className="bg-brand-950">België</option>
                  <option value="NL" className="bg-brand-950">Nederland</option>
                  <option value="FR" className="bg-brand-950">Frankrijk</option>
                  <option value="DE" className="bg-brand-950">Duitsland</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30">Postcode</label>
                <input type="text" value={geoForm.postcode} onChange={e => setGeoForm(p => ({ ...p, postcode: e.target.value }))}
                  placeholder="2000" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-brand-500/30" />
              </div>
              <div className="flex items-end">
                <button onClick={saveGeo} disabled={enriching || !geoForm.city}
                  className="w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40">
                  Opslaan & Calibreer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
