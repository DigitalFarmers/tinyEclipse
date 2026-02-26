"""
Portal Features API — Returns plan features, sector profile, active modules,
and hub configuration for the client portal.
"""
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
from app.models.tenant import Tenant
from app.models.site_module import SiteModule, ModuleStatus
from app.services.plan_limits import get_plan_features, get_plan_comparison
from app.services.sector_intelligence import analyze_sector, get_all_sectors, MODULE_TO_BLOCK

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/features", tags=["portal-features"])


@router.get("/{tenant_id}")
async def get_tenant_features(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get the full feature set, sector profile, active modules, and hub config."""
    tenant = await get_tenant_safe(db, tenant_id)

    features = get_plan_features(tenant.plan.value)

    # Get active modules
    result = await db.execute(
        select(SiteModule).where(
            SiteModule.tenant_id == tenant.id,
            SiteModule.status == ModuleStatus.active,
        )
    )
    modules = result.scalars().all()
    active_modules = [
        {"type": m.module_type.value, "name": m.name, "auto_detected": m.auto_detected}
        for m in modules
    ]

    # Get sector profile from tenant settings
    settings = tenant.settings or {}
    sector_profile = settings.get("sector_profile", None)
    hub_config = settings.get("hub_config", None)

    # Determine active blocks from modules
    active_blocks = []
    for m in modules:
        block = MODULE_TO_BLOCK.get(m.module_type)
        if block and block not in active_blocks:
            active_blocks.append(block)
    # Always include orders if shop or booking active
    if ("products" in active_blocks or "bookings" in active_blocks) and "orders" not in active_blocks:
        active_blocks.append("orders")
    # Always include faq and business
    for must_have in ["faq", "business"]:
        if must_have not in active_blocks:
            active_blocks.append(must_have)

    return {
        "tenant_id": str(tenant.id),
        "plan": tenant.plan.value,
        "plan_label": features.label,
        "price": features.price_label,
        "limits": {
            "monthly_chat_limit": features.monthly_chat_limit,
            "knowledge_pages_limit": features.knowledge_pages_limit,
            "events_max_hours": features.events_max_hours,
        },
        "features": {
            "monitoring_uptime": features.monitoring_uptime,
            "monitoring_ssl": features.monitoring_ssl,
            "monitoring_dns": features.monitoring_dns,
            "monitoring_performance": features.monitoring_performance,
            "monitoring_server": features.monitoring_server,
            "analytics_basic": features.analytics_basic,
            "analytics_advanced": features.analytics_advanced,
            "proactive_help": features.proactive_help,
            "push_notifications": features.push_notifications,
            "priority_support": features.priority_support,
            "custom_branding": features.custom_branding,
        },
        "active_modules": active_modules,
        "active_blocks": active_blocks,
        "sector_profile": sector_profile,
        "hub_config": hub_config,
        "upgrade_url": "https://my.digitalfarmers.be/clientarea.php",
    }


@router.post("/{tenant_id}/analyze-sector")
async def analyze_tenant_sector(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Run sector intelligence analysis and store results in tenant settings."""
    tenant = await get_tenant_safe(db, tenant_id)

    # Get detected modules
    result = await db.execute(
        select(SiteModule).where(
            SiteModule.tenant_id == tenant.id,
            SiteModule.status == ModuleStatus.active,
        )
    )
    modules = result.scalars().all()
    detected = [
        {"module_type": m.module_type.value, "name": m.name}
        for m in modules
    ]

    # Run analysis
    profile = analyze_sector(
        site_name=tenant.name or "",
        site_content=tenant.settings.get("site_description", "") if tenant.settings else "",
        detected_modules=detected,
        capabilities=tenant.settings.get("capabilities") if tenant.settings else None,
    )

    # Store in tenant settings
    settings = dict(tenant.settings) if tenant.settings else {}
    settings["sector_profile"] = profile
    tenant.settings = settings
    await db.commit()

    logger.info(f"[sector] Analyzed tenant {tenant_id}: {profile['sector']} ({profile['confidence']})")
    return profile


@router.post("/{tenant_id}/hub-config")
async def update_hub_config(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Update Hub configuration (layout, shortcuts, branding) for Pro+ tenants."""
    tenant = await get_tenant_safe(db, tenant_id)

    data = await request.json()
    settings = dict(tenant.settings) if tenant.settings else {}
    settings["hub_config"] = data
    tenant.settings = settings
    await db.commit()

    return {"status": "updated", "hub_config": data}


@router.get("/plans/compare")
async def compare_plans():
    """Get a comparison of all available plans. Public endpoint for upgrade prompts."""
    return get_plan_comparison()


@router.get("/sectors/all")
async def list_sectors():
    """Get all available sectors for manual selection."""
    return get_all_sectors()
