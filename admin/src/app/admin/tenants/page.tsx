"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTenants, createTenant } from "@/lib/api";

interface Tenant {
  id: string;
  whmcs_client_id: number;
  name: string;
  plan: string;
  status: string;
  domain: string | null;
  created_at: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTenants = () => {
    getTenants().then(setTenants).catch((e) => setError(e.message));
  };

  useEffect(() => { loadTenants(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Websites</h1>
          <p className="mt-1 text-sm text-white/50">{tenants.length} tenant{tenants.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium transition hover:bg-brand-700">+ Add Tenant</button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      {showForm && <CreateTenantForm onCreated={() => { setShowForm(false); loadTenants(); }} onCancel={() => setShowForm(false)} />}

      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-white/50">Name</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">WHMCS ID</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Status</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Domain</th>
              <th className="px-4 py-3 text-left font-medium text-white/50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map((t) => (
              <tr key={t.id} className="transition hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-white/60">{t.whmcs_client_id}</td>
                <td className="px-4 py-3"><PlanBadge plan={t.plan} /></td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-white/60">{t.domain || "—"}</td>
                <td className="px-4 py-3"><Link href={`/admin/tenants/${t.id}`} className="text-brand-500 hover:text-brand-400">View</Link></td>
              </tr>
            ))}
            {tenants.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">No tenants yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = { tiny: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", pro: "bg-blue-500/10 text-blue-400 border-blue-500/20", pro_plus: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[plan] || colors.tiny}`}>{plan.replace("_", "+")}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? "text-emerald-400" : "text-red-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-red-400"}`} />{status}</span>;
}

function CreateTenantForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ whmcs_client_id: "", name: "", plan: "pro", domain: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createTenant({ whmcs_client_id: parseInt(form.whmcs_client_id), name: form.name, plan: form.plan, domain: form.domain || undefined });
      onCreated();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-semibold">New Tenant</h3>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className="block text-xs font-medium text-white/50">WHMCS Client ID</label><input type="number" required value={form.whmcs_client_id} onChange={(e) => setForm({ ...form, whmcs_client_id: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-500" /></div>
        <div><label className="block text-xs font-medium text-white/50">Company Name</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-500" /></div>
        <div><label className="block text-xs font-medium text-white/50">Plan</label><select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-500"><option value="tiny">Tiny</option><option value="pro">Pro</option><option value="pro_plus">Pro+</option></select></div>
        <div><label className="block text-xs font-medium text-white/50">Domain</label><input type="text" placeholder="example.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-500" /></div>
      </div>
      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium transition hover:bg-brand-700 disabled:opacity-50">{loading ? "Creating..." : "Create Tenant"}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/5">Cancel</button>
      </div>
    </form>
  );
}
