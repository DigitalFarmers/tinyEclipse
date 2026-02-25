"""
Domain Scanner Service — Discovers all domains from WHMCS and cross-references
with Eclipse tenants to find gaps (domains without the TinyEclipse plugin).
"""
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.whmcs import get_whmcs_client, WHMCSError

logger = logging.getLogger(__name__)

# Cache scan results for 1 hour
_scan_cache: Dict[str, Any] = {}
_scan_cache_ts: float = 0
CACHE_TTL = 3600  # 1 hour


async def scan_all_domains(db: AsyncSession, force: bool = False) -> dict:
    """
    Pull all domains from WHMCS, cross-reference with Eclipse tenants,
    and produce a gap report.
    """
    global _scan_cache, _scan_cache_ts

    if not force and _scan_cache and (time.time() - _scan_cache_ts) < CACHE_TTL:
        return _scan_cache

    whmcs = get_whmcs_client()
    if not whmcs.configured:
        return {"error": "WHMCS not configured", "domains": [], "stats": {}}

    # 1. Get all WHMCS clients + their products/domains
    whmcs_domains: list[dict] = []
    try:
        clients_data = await whmcs.get_clients(limit=250)
        clients = clients_data.get("clients", {}).get("client", [])
    except WHMCSError as e:
        logger.error(f"[domain-scanner] Failed to fetch WHMCS clients: {e}")
        return {"error": str(e), "domains": [], "stats": {}}

    for c in clients:
        whmcs_id = c.get("id")
        if not whmcs_id:
            continue

        client_name = c.get("companyname") or f"{c.get('firstname', '')} {c.get('lastname', '')}".strip()

        # Get products (hosting packages with domains)
        try:
            products_data = await whmcs.get_client_products(int(whmcs_id))
            products = products_data.get("products", {}).get("product", [])
            for p in products:
                domain = p.get("domain", "").strip()
                if not domain:
                    continue
                plan = whmcs.product_id_to_plan(p.get("pid")) or "unknown"
                whmcs_domains.append({
                    "domain": domain,
                    "whmcs_client_id": int(whmcs_id),
                    "client_name": client_name,
                    "whmcs_plan": plan,
                    "whmcs_product_name": p.get("name", ""),
                    "whmcs_status": p.get("status", ""),
                })
        except WHMCSError:
            pass

        # Get registered domains
        try:
            domains_data = await whmcs.get_client_domains(int(whmcs_id))
            domains = domains_data.get("domains", {}).get("domain", [])
            for d in domains:
                domain = d.get("domainname", "").strip()
                if not domain:
                    continue
                # Avoid duplicates
                if any(wd["domain"] == domain for wd in whmcs_domains):
                    continue
                whmcs_domains.append({
                    "domain": domain,
                    "whmcs_client_id": int(whmcs_id),
                    "client_name": client_name,
                    "whmcs_plan": "domain_only",
                    "whmcs_product_name": "Domain Registration",
                    "whmcs_status": d.get("status", ""),
                })
        except WHMCSError:
            pass

    # 2. Get all Eclipse tenants
    tenants_result = await db.execute(select(Tenant))
    tenants = tenants_result.scalars().all()
    tenant_by_domain: Dict[str, Tenant] = {}
    for t in tenants:
        if t.domain:
            # Normalize: strip www. and trailing slashes
            clean = t.domain.lower().replace("www.", "").strip("/")
            tenant_by_domain[clean] = t

    # 3. Cross-reference
    results: List[dict] = []
    for wd in whmcs_domains:
        domain_clean = wd["domain"].lower().replace("www.", "").strip("/")
        tenant = tenant_by_domain.get(domain_clean)

        plugin_status = "not_installed"
        tenant_id = None
        tenant_plan = None
        connector_version = None
        last_heartbeat = None

        if tenant:
            tenant_id = str(tenant.id)
            tenant_plan = tenant.plan.value if tenant.plan else None
            settings = tenant.settings or {}
            connector_version = settings.get("connector_version")
            last_heartbeat = settings.get("last_heartbeat")

            if connector_version:
                plugin_status = "installed_active"
            elif tenant.status and tenant.status.value == "active":
                plugin_status = "tenant_exists_no_plugin"
            else:
                plugin_status = "tenant_inactive"

        results.append({
            "domain": wd["domain"],
            "whmcs_client_id": wd["whmcs_client_id"],
            "client_name": wd["client_name"],
            "whmcs_plan": wd["whmcs_plan"],
            "whmcs_product_name": wd["whmcs_product_name"],
            "whmcs_status": wd["whmcs_status"],
            "has_tenant": tenant is not None,
            "tenant_id": tenant_id,
            "tenant_plan": tenant_plan,
            "plugin_status": plugin_status,
            "connector_version": connector_version,
            "last_heartbeat": last_heartbeat,
        })

    # 4. Stats
    total = len(results)
    with_plugin = sum(1 for r in results if r["plugin_status"] == "installed_active")
    without_plugin = sum(1 for r in results if r["plugin_status"] in ("not_installed", "tenant_exists_no_plugin"))
    tenant_inactive = sum(1 for r in results if r["plugin_status"] == "tenant_inactive")
    pro_without = sum(1 for r in results if r["whmcs_plan"] in ("pro", "pro_plus") and r["plugin_status"] != "installed_active")

    stats = {
        "total_domains": total,
        "with_plugin": with_plugin,
        "without_plugin": without_plugin,
        "tenant_inactive": tenant_inactive,
        "pro_without_plugin": pro_without,
        "coverage_pct": round((with_plugin / total * 100) if total > 0 else 0, 1),
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }

    result = {"domains": results, "stats": stats}

    # Cache
    _scan_cache = result
    _scan_cache_ts = time.time()

    logger.info(
        f"[domain-scanner] Scanned {total} domains: "
        f"{with_plugin} with plugin, {without_plugin} without, "
        f"{pro_without} PRO clients missing plugin"
    )

    return result


async def get_gaps_only(db: AsyncSession) -> dict:
    """Return only domains that are missing the plugin."""
    data = await scan_all_domains(db)
    gaps = [d for d in data.get("domains", []) if d["plugin_status"] != "installed_active"]
    # Sort: PRO clients first
    plan_priority = {"pro_plus": 0, "pro": 1, "tiny": 2, "unknown": 3, "domain_only": 4}
    gaps.sort(key=lambda d: plan_priority.get(d["whmcs_plan"], 9))
    return {"domains": gaps, "stats": data.get("stats", {})}


async def probe_plugin(domain: str, timeout: float = 5.0) -> dict:
    """
    Probe a domain to check if the TinyEclipse plugin is installed
    by hitting the public health endpoint.
    """
    url = f"https://{domain}/wp-json/tinyeclipse/v1/health"
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=timeout) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "installed": True,
                    "version": data.get("version"),
                    "status": data.get("status"),
                    "site": data.get("site"),
                }
            return {"installed": False, "status_code": resp.status_code}
    except Exception as e:
        return {"installed": False, "error": str(e)}
