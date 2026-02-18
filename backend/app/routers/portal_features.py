"""
Portal Features API — Returns plan features and limits for the client portal.
Used by the frontend to show/hide features based on the client's plan.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant
from app.services.plan_limits import get_plan_features, get_plan_comparison

router = APIRouter(prefix="/api/portal/features", tags=["portal-features"])


@router.get("/{tenant_id}")
async def get_tenant_features(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get the feature set available for this tenant based on their plan."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    features = get_plan_features(tenant.plan.value)

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
        "upgrade_url": "https://my.digitalfarmers.be/clientarea.php",
    }


@router.get("/plans/compare")
async def compare_plans():
    """Get a comparison of all available plans. Public endpoint for upgrade prompts."""
    return get_plan_comparison()
