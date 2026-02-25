"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  MapPin,
  Clock,
  Phone,
  Mail,
  Globe,
  Save,
  Plus,
  Trash2,
  Edit3,
  X,
  Facebook,
  Instagram,
  Linkedin,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BusinessProfile {
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  vat_number: string;
  kbo_number: string;
  logo_url: string;
  social: { facebook: string; instagram: string; linkedin: string; tiktok: string; youtube: string };
}

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  google_maps_url: string;
  hours: Record<string, DayHours>;
}

const DAYS = [
  { key: "monday", label: "Maandag" },
  { key: "tuesday", label: "Dinsdag" },
  { key: "wednesday", label: "Woensdag" },
  { key: "thursday", label: "Donderdag" },
  { key: "friday", label: "Vrijdag" },
  { key: "saturday", label: "Zaterdag" },
  { key: "sunday", label: "Zondag" },
];

const DEFAULT_HOURS: Record<string, DayHours> = Object.fromEntries(
  DAYS.map((d) => [d.key, { open: "09:00", close: "17:00", closed: d.key === "sunday" }])
);

export default function BusinessPage() {
  const [profile, setProfile] = useState<BusinessProfile>({
    name: "", address: "", city: "", postal_code: "", country: "BE",
    phone: "", email: "", website: "", vat_number: "", kbo_number: "",
    logo_url: "",
    social: { facebook: "", instagram: "", linkedin: "", tiktok: "", youtube: "" },
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "locations">("profile");
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("te_portal_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    setTenantId(s.tenant_id);
    fetchData(s.tenant_id);
  }, []);

  async function fetchData(tid: string) {
    setLoading(true);
    const [pRes, lRes] = await Promise.all([
      fetch(`${API}/api/portal/data/${tid}/business/profile`),
      fetch(`${API}/api/portal/data/${tid}/business/locations`),
    ]);
    if (pRes.ok) {
      const d = await pRes.json();
      if (d && !d.error) setProfile((prev) => ({ ...prev, ...d }));
    }
    if (lRes.ok) {
      const d = await lRes.json();
      setLocations(d.locations || d.items || []);
    }
    setLoading(false);
  }

  async function saveProfile() {
    setSaving(true);
    await fetch(`${API}/api/portal/data/${tenantId}/business/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveLocation(data: Partial<Location>) {
    const id = editingLocation?.id;
    const url = id
      ? `${API}/api/portal/data/${tenantId}/business/locations/${id}`
      : `${API}/api/portal/data/${tenantId}/business/locations`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchData(tenantId);
    setEditingLocation(null);
    setCreatingLocation(false);
  }

  async function deleteLocation(id: number) {
    if (!confirm("Deze locatie verwijderen?")) return;
    await fetch(`${API}/api/portal/data/${tenantId}/business/locations/${id}/delete`, { method: "POST" });
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Mijn Bedrijf</h1>
          <p className="mt-1 text-sm text-white/40">Bedrijfsprofiel, locaties en openingsuren</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "profile" ? "bg-brand-500/10 text-brand-400" : "text-white/40 hover:text-white"
          }`}
        >
          Bedrijfsprofiel
        </button>
        <button
          onClick={() => setActiveTab("locations")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "locations" ? "bg-brand-500/10 text-brand-400" : "text-white/40 hover:text-white"
          }`}
        >
          Locaties & Uren ({locations.length})
        </button>
      </div>

      {activeTab === "profile" ? (
        <div className="space-y-6">
          {/* Basic Info */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">Basisgegevens</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Bedrijfsnaam</label>
                <input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">BTW nummer</label>
                <input type="text" value={profile.vat_number} onChange={(e) => setProfile({ ...profile, vat_number: e.target.value })} placeholder="BE0123.456.789" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-white/40">Adres</label>
                <input type="text" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Stad</label>
                <input type="text" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/40">Postcode</label>
                  <input type="text" value={profile.postal_code} onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/40">Land</label>
                  <select value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                    <option value="BE">België</option>
                    <option value="NL">Nederland</option>
                    <option value="DE">Duitsland</option>
                    <option value="FR">Frankrijk</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Telefoon</label>
                <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+32 ..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">E-mail</label>
                <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-white/40">Website</label>
                <input type="url" value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} placeholder="https://..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
              </div>
            </div>
          </section>

          {/* Social */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60">Social Media</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
                { key: "instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
                { key: "linkedin", icon: Linkedin, placeholder: "https://linkedin.com/..." },
              ].map(({ key, icon: Icon, placeholder }) => (
                <div key={key} className="relative">
                  <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                  <input
                    type="url"
                    value={(profile.social as any)?.[key] || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        social: { ...profile.social, [key]: e.target.value },
                      })
                    }
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Opgeslagen!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {saving ? "Opslaan..." : "Profiel Opslaan"}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Locations Tab */
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setCreatingLocation(true); setEditingLocation(null); }}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Locatie Toevoegen
            </button>
          </div>

          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16">
              <MapPin className="mb-3 h-10 w-10 text-white/15" />
              <p className="text-sm text-white/30">Nog geen locaties. Voeg je eerste vestiging toe!</p>
            </div>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{loc.name}</h3>
                    <p className="mt-0.5 text-xs text-white/40">
                      {loc.address}, {loc.postal_code} {loc.city}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/30">
                      {loc.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {loc.phone}
                        </span>
                      )}
                      {loc.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {loc.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingLocation(loc)}
                      className="rounded-lg p-2 text-white/20 hover:bg-white/5 hover:text-white"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteLocation(loc.id)}
                      className="rounded-lg p-2 text-white/20 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Opening Hours */}
                {loc.hours && (
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-white/5 bg-white/[0.01] p-3 sm:grid-cols-4">
                    {DAYS.map((day) => {
                      const h = loc.hours?.[day.key];
                      return (
                        <div key={day.key} className="flex items-center justify-between py-0.5">
                          <span className="text-[11px] text-white/30">{day.label.slice(0, 2)}</span>
                          <span className={`text-[11px] ${h?.closed ? "text-red-400/50" : "text-white/50"}`}>
                            {h?.closed ? "Gesloten" : `${h?.open || "—"} – ${h?.close || "—"}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Location Modal */}
          {(editingLocation || creatingLocation) && (
            <LocationModal
              location={editingLocation}
              onSave={saveLocation}
              onClose={() => { setEditingLocation(null); setCreatingLocation(false); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LocationModal({
  location,
  onSave,
  onClose,
}: {
  location: Location | null;
  onSave: (data: Partial<Location>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(location?.name || "");
  const [address, setAddress] = useState(location?.address || "");
  const [city, setCity] = useState(location?.city || "");
  const [postalCode, setPostalCode] = useState(location?.postal_code || "");
  const [country, setCountry] = useState(location?.country || "BE");
  const [phone, setPhone] = useState(location?.phone || "");
  const [email, setEmail] = useState(location?.email || "");
  const [mapsUrl, setMapsUrl] = useState(location?.google_maps_url || "");
  const [hours, setHours] = useState<Record<string, DayHours>>(location?.hours || DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);

  function updateHour(day: string, field: keyof DayHours, value: string | boolean) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name, address, city, postal_code: postalCode, country,
      phone, email, google_maps_url: mapsUrl, hours,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {location ? "Locatie Bewerken" : "Nieuwe Locatie"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-white/40">Naam</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Hoofdvestiging" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-white/40">Adres</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Stad</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Postcode</label>
                <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/40">Land</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                  <option value="BE">BE</option>
                  <option value="NL">NL</option>
                  <option value="DE">DE</option>
                  <option value="FR">FR</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">Telefoon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/40">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-white/40">Google Maps URL</label>
              <input type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/50" />
            </div>
          </div>

          {/* Opening Hours */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Clock className="h-3.5 w-3.5" /> Openingsuren
            </h3>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const h = hours[day.key] || { open: "09:00", close: "17:00", closed: false };
                return (
                  <div key={day.key} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-white/40">{day.label}</span>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={h.closed}
                        onChange={(e) => updateHour(day.key, "closed", e.target.checked)}
                        className="rounded border-white/20 bg-white/5"
                      />
                      <span className="text-[10px] text-white/30">Gesloten</span>
                    </label>
                    {!h.closed && (
                      <>
                        <input
                          type="time"
                          value={h.open}
                          onChange={(e) => updateHour(day.key, "open", e.target.value)}
                          className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                        />
                        <span className="text-xs text-white/20">–</span>
                        <input
                          type="time"
                          value={h.close}
                          onChange={(e) => updateHour(day.key, "close", e.target.value)}
                          className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/40 transition hover:text-white">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
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
