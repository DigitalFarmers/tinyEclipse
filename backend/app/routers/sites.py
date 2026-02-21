"""
Sites API — Self-service site registration, public widget config, site verification.
The onboarding layer that makes adding new sites frictionless.
"""
import uuid
import hashlib
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, PlanType, TenantStatus
from app.models.monitor import MonitorCheck, CheckType
from app.models.source import Source

logger = logging.getLogger(__name__)

# ─── Public endpoints (no auth — called by widgets/plugins) ───
public_router = APIRouter(prefix="/api/sites", tags=["sites-public"])

# ─── Admin endpoints ───
admin_router = APIRouter(
    prefix="/api/admin/sites",
    tags=["admin-sites"],
    dependencies=[Depends(verify_admin_key)],
)


# ─── Public: Widget Config ───

@public_router.get("/config/{tenant_id}")
async def get_widget_config(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — widget fetches its config from here. No auth needed."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant or tenant.status != TenantStatus.active:
        raise HTTPException(status_code=404, detail="Site not found or inactive")

    settings = tenant.settings or {}

    return {
        "tenant_id": str(tenant.id),
        "name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value,
        "widget": {
            "enabled": settings.get("widget_enabled", True),
            "color": settings.get("widget_color", "#6C3CE1"),
            "position": settings.get("widget_position", "bottom-right"),
            "name": settings.get("widget_name", f"{tenant.name} AI"),
            "lang": settings.get("widget_lang", "nl"),
            "welcome_message": settings.get("widget_welcome", None),
            "proactive_delay_ms": settings.get("proactive_delay_ms", 30000),
            "consent_required": settings.get("consent_required", True),
        },
        "features": {
            "chat": True,
            "tracking": tenant.plan.value in ("pro", "pro_plus"),
            "monitoring": tenant.plan.value == "pro_plus",
            "proactive_help": tenant.plan.value in ("pro", "pro_plus"),
        },
    }


@public_router.get("/verify/{tenant_id}")
async def verify_site(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Verify a site is properly connected to Eclipse. Called by plugins on activation."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    origin = request.headers.get("origin", "") or request.headers.get("referer", "")

    # Check if origin matches tenant domain
    domain_match = False
    if tenant.domain and origin:
        domain_match = tenant.domain in origin

    return {
        "verified": True,
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "domain": tenant.domain,
        "domain_match": domain_match,
        "plan": tenant.plan.value,
        "status": tenant.status.value,
        "api_version": "1.0",
    }


# ─── Public: Auto-onboard by domain ───

@public_router.get("/onboard")
async def onboard_by_domain(domain: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — plugin calls this with its domain to get tenant_id + widget config.
    This allows the eclipse-ai plugin to auto-configure without manual WP admin setup."""
    domain = domain.strip().lower().replace("https://", "").replace("http://", "").rstrip("/")
    result = await db.execute(select(Tenant).where(Tenant.domain == domain))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"No tenant found for domain {domain}")

    settings = tenant.settings or {}
    return {
        "tenant_id": str(tenant.id),
        "name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value,
        "api_url": "https://api.tinyeclipse.digitalfarmers.be",
        "widget_url": "https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js",
        "widget": {
            "enabled": settings.get("widget_enabled", True),
            "color": settings.get("widget_color", "#6C3CE1"),
            "position": settings.get("widget_position", "bottom-right"),
            "name": settings.get("widget_name", f"{tenant.name} AI"),
            "lang": settings.get("widget_lang", "nl"),
        },
    }


# ─── Public: Auto-Onboard (Connector v5) ───

class AutoOnboardRequest(BaseModel):
    site_url: str
    site_name: str
    description: str = ""
    wp_version: str = ""
    php_version: str = ""
    locale: str = "nl"
    timezone: str = "Europe/Brussels"
    environment: str = "production"
    admin_email: str = ""
    tenant_id: str = ""
    generated_at: str = ""
    connector_version: str = ""
    plugins: list[str] = []
    plugin_count: int = 0
    modules: list[str] = []


@public_router.post("/auto-onboard")
async def auto_onboard(
    body: AutoOnboardRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Auto-onboard endpoint for TinyEclipse Connector v5.
    Called during plugin activation — zero-config registration.
    Returns api_key for secure Hub communication.
    """
    # Normalize domain
    domain = body.site_url.strip().lower().replace("https://", "").replace("http://", "").rstrip("/")

    # Check if domain already exists
    existing = await db.execute(select(Tenant).where(Tenant.domain == domain))
    tenant = existing.scalar_one_or_none()

    if tenant:
        # Already registered — return existing credentials
        api_key = hashlib.sha256(f"{tenant.id}-{tenant.created_at}".encode()).hexdigest()[:32]
        return {
            "success": True,
            "message": "Site already registered",
            "tenant_id": str(tenant.id),
            "api_key": f"te-{api_key}",
            "hub_url": "https://tinyeclipse.digitalfarmers.be",
            "api_base": "https://api.tinyeclipse.digitalfarmers.be",
            "plan": tenant.plan.value,
        }

    # Find WHMCS client by domain or create new
    max_id_result = await db.execute(select(func.max(Tenant.whmcs_client_id)))
    max_id = max_id_result.scalar() or 0
    whmcs_id = max_id + 1

    # Determine environment
    env = body.environment
    if "staging" in domain or "test" in domain or "dev" in domain:
        env = "staging"

    # Create tenant
    tenant = Tenant(
        id=uuid.uuid4(),
        whmcs_client_id=whmcs_id,
        name=body.site_name or domain,
        plan=PlanType.tiny,
        domain=domain,
        environment=env,
        settings={
            "connector_version": body.connector_version,
            "wp_version": body.wp_version,
            "php_version": body.php_version,
            "locale": body.locale,
            "timezone": body.timezone,
            "admin_email": body.admin_email,
            "plugins": body.plugins,
            "modules": body.modules,
            "auto_onboarded": True,
            "onboarded_at": body.generated_at or datetime.now(timezone.utc).isoformat(),
        },
    )
    db.add(tenant)
    await db.flush()

    # Generate API key
    api_key = hashlib.sha256(f"{tenant.id}-{tenant.created_at}".encode()).hexdigest()[:32]

    # Auto-setup monitoring
    try:
        from app.services.monitor import setup_default_checks
        await setup_default_checks(db, tenant.id, domain)
    except Exception as e:
        logger.error(f"Auto-onboard monitoring setup failed for {domain}: {e}")

    # Auto-scrape site for knowledge base
    try:
        from app.routers.tenants import _auto_scrape_site
        background_tasks.add_task(_auto_scrape_site, tenant.id, domain)
    except Exception as e:
        logger.error(f"Auto-onboard scrape failed for {domain}: {e}")

    logger.info(f"Auto-onboarded: {domain} as {tenant.id} (connector {body.connector_version})")

    return {
        "success": True,
        "message": "Site registered successfully",
        "tenant_id": str(tenant.id),
        "api_key": f"te-{api_key}",
        "hub_url": "https://tinyeclipse.digitalfarmers.be",
        "api_base": "https://api.tinyeclipse.digitalfarmers.be",
        "plan": tenant.plan.value,
        "features": {
            "chat": True,
            "monitoring": True,
            "knowledge_base": True,
            "analytics": True,
        },
    }


# ─── Admin: Site Registration ───

class SiteRegister(BaseModel):
    name: str
    domain: str
    plan: str = "tiny"
    whmcs_client_id: int | None = None
    auto_setup: bool = True  # Auto-setup monitoring + scraping
    settings: dict = {}


@admin_router.post("/register/", status_code=201)
async def register_site(
    body: SiteRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Register a new site — the full onboarding in one call.
    Creates tenant, sets up monitoring, starts scraping, returns embed code.
    """
    # Check for duplicate domain
    existing = await db.execute(
        select(Tenant).where(Tenant.domain == body.domain)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Domain {body.domain} is already registered")

    # Find next available whmcs_client_id if not provided
    whmcs_id = body.whmcs_client_id
    if whmcs_id is None:
        max_id_result = await db.execute(
            select(func.max(Tenant.whmcs_client_id))
        )
        max_id = max_id_result.scalar() or 0
        whmcs_id = max_id + 1

    # Create tenant
    tenant = Tenant(
        id=uuid.uuid4(),
        whmcs_client_id=whmcs_id,
        name=body.name,
        plan=PlanType(body.plan),
        domain=body.domain,
        settings=body.settings,
    )
    db.add(tenant)
    await db.flush()

    setup_results = {"monitoring": "skipped", "scraping": "skipped"}

    if body.auto_setup:
        # Setup monitoring
        try:
            from app.services.monitor import setup_default_checks
            await setup_default_checks(db, tenant.id, body.domain)
            setup_results["monitoring"] = "configured"
        except Exception as e:
            logger.error(f"Auto-setup monitoring failed for {body.domain}: {e}")
            setup_results["monitoring"] = f"failed: {e}"

        # Start scraping in background
        try:
            from app.routers.tenants import _auto_scrape_site
            background_tasks.add_task(_auto_scrape_site, tenant.id, body.domain)
            setup_results["scraping"] = "started"
        except Exception as e:
            logger.error(f"Auto-scrape failed for {body.domain}: {e}")
            setup_results["scraping"] = f"failed: {e}"

    embed_code = (
        f'<script src="https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js" '
        f'data-tenant="{tenant.id}" '
        f'data-api="https://api.tinyeclipse.digitalfarmers.be" '
        f'async></script>'
    )

    return {
        "status": "registered",
        "tenant_id": str(tenant.id),
        "name": tenant.name,
        "domain": body.domain,
        "plan": body.plan,
        "setup": setup_results,
        "embed_code": embed_code,
        "dashboard_url": f"https://tinyeclipse.digitalfarmers.be/tenants/{tenant.id}",
        "plugin_config": {
            "tenant_id": str(tenant.id),
            "api_base": "https://api.tinyeclipse.digitalfarmers.be",
        },
    }


# ─── Admin: Bulk Registration ───

class BulkSiteRegister(BaseModel):
    sites: list[SiteRegister]


@admin_router.post("/register-bulk/", status_code=201)
async def register_sites_bulk(
    body: BulkSiteRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Register multiple sites at once — for mass onboarding."""
    results = []
    for site in body.sites:
        try:
            # Check duplicate
            existing = await db.execute(
                select(Tenant).where(Tenant.domain == site.domain)
            )
            if existing.scalar_one_or_none():
                results.append({"domain": site.domain, "status": "skipped", "reason": "already exists"})
                continue

            max_id_result = await db.execute(select(func.max(Tenant.whmcs_client_id)))
            max_id = max_id_result.scalar() or 0
            whmcs_id = site.whmcs_client_id or (max_id + 1)

            tenant = Tenant(
                id=uuid.uuid4(),
                whmcs_client_id=whmcs_id,
                name=site.name,
                plan=PlanType(site.plan),
                domain=site.domain,
                settings=site.settings,
            )
            db.add(tenant)
            await db.flush()

            if site.auto_setup:
                from app.services.monitor import setup_default_checks
                await setup_default_checks(db, tenant.id, site.domain)
                from app.routers.tenants import _auto_scrape_site
                background_tasks.add_task(_auto_scrape_site, tenant.id, site.domain)

            results.append({
                "domain": site.domain,
                "status": "registered",
                "tenant_id": str(tenant.id),
            })
        except Exception as e:
            results.append({"domain": site.domain, "status": "failed", "error": str(e)})

    registered = sum(1 for r in results if r["status"] == "registered")
    return {
        "total": len(body.sites),
        "registered": registered,
        "skipped": sum(1 for r in results if r["status"] == "skipped"),
        "failed": sum(1 for r in results if r["status"] == "failed"),
        "results": results,
    }


# ─── Admin: Site Overview ───

@admin_router.get("/overview/")
async def sites_overview(db: AsyncSession = Depends(get_db)):
    """Complete overview of all registered sites with their status."""
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = tenants_result.scalars().all()

    sites = []
    for t in tenants:
        # Count monitoring checks
        checks_result = await db.execute(
            select(func.count(MonitorCheck.id)).where(MonitorCheck.tenant_id == t.id)
        )
        check_count = checks_result.scalar() or 0

        # Count sources
        sources_result = await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )
        source_count = sources_result.scalar() or 0

        sites.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "plan": t.plan.value,
            "status": t.status.value,
            "monitoring_checks": check_count,
            "knowledge_sources": source_count,
            "created_at": t.created_at.isoformat(),
            "embed_code": f'<script src="https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js" data-tenant="{t.id}" data-api="https://api.tinyeclipse.digitalfarmers.be" async></script>',
        })

    return {
        "total": len(sites),
        "by_plan": {
            "tiny": sum(1 for s in sites if s["plan"] == "tiny"),
            "pro": sum(1 for s in sites if s["plan"] == "pro"),
            "pro_plus": sum(1 for s in sites if s["plan"] == "pro_plus"),
        },
        "by_status": {
            "active": sum(1 for s in sites if s["status"] == "active"),
            "suspended": sum(1 for s in sites if s["status"] == "suspended"),
        },
        "sites": sites,
    }


# ─── Admin: Site Deactivation / Reactivation ───

@admin_router.post("/{tenant_id}/deactivate")
async def deactivate_site(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Deactivate a site — widget stops working, monitoring pauses."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.status = TenantStatus.suspended

    # Disable all monitoring checks
    checks_result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.tenant_id == tenant.id)
    )
    disabled = 0
    for check in checks_result.scalars().all():
        check.enabled = False
        disabled += 1

    await db.flush()
    return {
        "status": "deactivated",
        "tenant_id": tenant_id,
        "monitoring_checks_disabled": disabled,
    }


@admin_router.post("/{tenant_id}/reactivate")
async def reactivate_site(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Reactivate a suspended site."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.status = TenantStatus.active

    # Re-enable monitoring checks
    checks_result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.tenant_id == tenant.id)
    )
    enabled = 0
    for check in checks_result.scalars().all():
        check.enabled = True
        enabled += 1

    await db.flush()
    return {
        "status": "reactivated",
        "tenant_id": tenant_id,
        "monitoring_checks_enabled": enabled,
    }
