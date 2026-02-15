const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_KEY,
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export async function getOverview() {
  return apiFetch("/api/admin/overview");
}

export async function getTenants() {
  return apiFetch("/api/admin/tenants");
}

export async function getTenant(id: string) {
  return apiFetch(`/api/admin/tenants/${id}`);
}

export async function createTenant(data: {
  whmcs_client_id: number;
  name: string;
  plan: string;
  domain?: string;
  auto_scrape?: boolean;
}) {
  return apiFetch("/api/admin/tenants", {
    method: "POST",
    body: JSON.stringify({ auto_scrape: true, ...data }),
  });
}

export async function updateTenant(
  id: string,
  data: { name?: string; plan?: string; status?: string; domain?: string }
) {
  return apiFetch(`/api/admin/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getConversations(tenantId?: string, status?: string) {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenant_id", tenantId);
  if (status) params.set("status", status);
  return apiFetch(`/api/admin/conversations?${params}`);
}

export async function getConversation(id: string) {
  return apiFetch(`/api/admin/conversations/${id}`);
}

export async function getSources(tenantId: string) {
  return apiFetch(`/api/admin/sources?tenant_id=${tenantId}`);
}

export async function createSource(data: {
  tenant_id: string;
  type: string;
  url?: string;
  title: string;
  content?: string;
}) {
  return apiFetch("/api/admin/sources", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function triggerIngest(sourceId: string) {
  return apiFetch(`/api/admin/sources/${sourceId}/ingest`, { method: "POST" });
}

export async function scrapeSite(tenantId: string, url: string) {
  return apiFetch(
    `/api/admin/sources/scrape-site?tenant_id=${tenantId}&url=${encodeURIComponent(url)}`,
    { method: "POST" }
  );
}

export async function getUsage(tenantId?: string) {
  const params = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiFetch(`/api/admin/usage${params}`);
}

// ─── Monitoring ───

export async function getMonitoringDashboard(tenantId: string) {
  return apiFetch(`/api/admin/monitoring/dashboard/${tenantId}`);
}

export async function getMonitoringChecks(tenantId: string) {
  return apiFetch(`/api/admin/monitoring/checks/${tenantId}`);
}

export async function runMonitoringChecks(tenantId: string) {
  return apiFetch(`/api/admin/monitoring/run/${tenantId}`, { method: "POST" });
}

export async function runSingleCheck(checkId: string) {
  return apiFetch(`/api/admin/monitoring/run-check/${checkId}`, { method: "POST" });
}

export async function getCheckResults(checkId: string, limit = 50) {
  return apiFetch(`/api/admin/monitoring/results/${checkId}?limit=${limit}`);
}

export async function getAlerts(tenantId: string, resolved = false) {
  return apiFetch(`/api/admin/monitoring/alerts/${tenantId}?resolved=${resolved}`);
}

export async function acknowledgeAlert(alertId: string) {
  return apiFetch(`/api/admin/monitoring/alerts/${alertId}/acknowledge`, { method: "POST" });
}

export async function resolveAlert(alertId: string) {
  return apiFetch(`/api/admin/monitoring/alerts/${alertId}/resolve`, { method: "POST" });
}

export async function setupMonitoring(tenantId: string) {
  return apiFetch(`/api/admin/monitoring/setup/${tenantId}`, { method: "POST" });
}

// ─── Analytics ───

export async function getAnalytics(tenantId: string, hours = 24) {
  return apiFetch(`/api/track/analytics/${tenantId}?hours=${hours}`);
}

export async function getVisitorJourney(sessionId: string) {
  return apiFetch(`/api/track/journey/${sessionId}`);
}
