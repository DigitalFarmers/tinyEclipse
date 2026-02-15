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
  return apiFetch("/api/admin/overview/");
}

export async function getTenants() {
  return apiFetch("/api/admin/tenants/");
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
  return apiFetch("/api/admin/tenants/", {
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
  return apiFetch(`/api/admin/conversations/?${params}`);
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
  return apiFetch("/api/admin/sources/", {
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

// ─── Reports ───

export async function getHealthReport(tenantId: string) {
  return apiFetch(`/api/admin/reports/health/${tenantId}`);
}

export async function getPeriodicReport(tenantId: string, period: "week" | "month" = "week") {
  return apiFetch(`/api/admin/reports/periodic/${tenantId}?period=${period}`);
}

export async function getTenantComparison() {
  return apiFetch("/api/admin/reports/comparison/");
}

export async function getUptimeHistory(tenantId: string, days = 30) {
  return apiFetch(`/api/admin/reports/uptime/${tenantId}?days=${days}`);
}

export async function getAlertTrends(tenantId: string, days = 30) {
  return apiFetch(`/api/admin/reports/alert-trends/${tenantId}?days=${days}`);
}

// ─── Heartbeat ───

export async function getAllHeartbeats() {
  return apiFetch("/api/admin/heartbeat/all/");
}

export async function getHeartbeatDetail(tenantId: string) {
  return apiFetch(`/api/admin/heartbeat/detail/${tenantId}`);
}

export async function getStaleHeartbeats(thresholdMinutes = 30) {
  return apiFetch(`/api/admin/heartbeat/stale/?threshold_minutes=${thresholdMinutes}`);
}

// ─── Webhooks ───

export async function getWebhooks() {
  return apiFetch("/api/admin/webhooks/");
}

export async function createWebhook(data: {
  tenant_id?: string;
  name: string;
  type: string;
  url: string;
  events?: string[];
  secret?: string;
}) {
  return apiFetch("/api/admin/webhooks/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateWebhook(id: string, data: Record<string, unknown>) {
  return apiFetch(`/api/admin/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(id: string) {
  return apiFetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
}

export async function testWebhook(id: string) {
  return apiFetch(`/api/admin/webhooks/${id}/test`, { method: "POST" });
}

export async function getWebhookLogs(limit = 50) {
  return apiFetch(`/api/admin/webhooks/logs/?limit=${limit}`);
}

// ─── Sites ───

export async function registerSite(data: {
  name: string;
  domain: string;
  plan?: string;
  auto_setup?: boolean;
}) {
  return apiFetch("/api/admin/sites/register/", {
    method: "POST",
    body: JSON.stringify({ auto_setup: true, ...data }),
  });
}

export async function registerSitesBulk(sites: Array<{
  name: string;
  domain: string;
  plan?: string;
}>) {
  return apiFetch("/api/admin/sites/register-bulk/", {
    method: "POST",
    body: JSON.stringify({ sites }),
  });
}

export async function getSitesOverview() {
  return apiFetch("/api/admin/sites/overview/");
}

export async function deactivateSite(tenantId: string) {
  return apiFetch(`/api/admin/sites/${tenantId}/deactivate`, { method: "POST" });
}

export async function reactivateSite(tenantId: string) {
  return apiFetch(`/api/admin/sites/${tenantId}/reactivate`, { method: "POST" });
}

// ─── System ───

export async function getPlatformHealth() {
  return apiFetch("/api/admin/system/health/");
}

export async function getDbStats() {
  return apiFetch("/api/admin/system/db-stats/");
}

export async function getTenantStats(tenantId: string) {
  return apiFetch(`/api/admin/system/tenant-stats/${tenantId}`);
}

export async function getAuditLog(limit = 100) {
  return apiFetch(`/api/admin/system/audit-log/?limit=${limit}`);
}

export async function bulkUpdatePlan(tenantIds: string[], plan: string) {
  return apiFetch("/api/admin/system/bulk/update-plan/", {
    method: "POST",
    body: JSON.stringify({ tenant_ids: tenantIds, plan }),
  });
}

export async function bulkRunMonitoring() {
  return apiFetch("/api/admin/system/bulk/run-monitoring/", { method: "POST" });
}

// ─── Domain Migration ───

export async function changeTenantDomain(tenantId: string, domain: string) {
  return apiFetch(`/api/admin/tenants/${tenantId}/domain?domain=${encodeURIComponent(domain)}`, {
    method: "PATCH",
  });
}

export async function getEmbedConfig(tenantId: string) {
  return apiFetch(`/api/admin/tenants/${tenantId}/embed-config`);
}
