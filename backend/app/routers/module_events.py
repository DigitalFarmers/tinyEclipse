"""
Module Events API — Webhook for WordPress sites to report module activity.
Also provides query endpoints for the events timeline integration.

WordPress plugins call POST /api/module-events/{tenant_id} to report:
- Job applications, new job listings
- WooCommerce orders, product updates
- Giftcard purchases/redemptions
- Form submissions (FluentForms, CF7, etc.)
- Booking creations/cancellations
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, desc, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant
from app.models.module_event import ModuleEvent, ModuleEventType
from app.models.site_module import SiteModule, ModuleType, ModuleStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/module-events", tags=["module-events"])


# ─── Event type metadata for display ───

EVENT_DISPLAY = {
    "job_application": {"icon": "📋", "label": "Sollicitatie ontvangen", "severity": "success"},
    "job_published": {"icon": "📢", "label": "Vacature gepubliceerd", "severity": "info"},
    "job_expired": {"icon": "⏰", "label": "Vacature verlopen", "severity": "warning"},
    "order_placed": {"icon": "🛒", "label": "Bestelling geplaatst", "severity": "success"},
    "order_completed": {"icon": "✅", "label": "Bestelling afgerond", "severity": "success"},
    "order_refunded": {"icon": "💸", "label": "Bestelling terugbetaald", "severity": "warning"},
    "product_published": {"icon": "📦", "label": "Product gepubliceerd", "severity": "info"},
    "giftcard_purchased": {"icon": "🎁", "label": "Cadeaubon gekocht", "severity": "success"},
    "giftcard_redeemed": {"icon": "🎉", "label": "Cadeaubon ingewisseld", "severity": "info"},
    "form_submitted": {"icon": "📝", "label": "Formulier ingevuld", "severity": "info"},
    "mail_received": {"icon": "📧", "label": "E-mail ontvangen", "severity": "info"},
    "mail_bounced": {"icon": "⚠️", "label": "E-mail bounce", "severity": "warning"},
    "booking_created": {"icon": "📅", "label": "Reservering gemaakt", "severity": "success"},
    "booking_cancelled": {"icon": "❌", "label": "Reservering geannuleerd", "severity": "warning"},
    "custom": {"icon": "⚡", "label": "Event", "severity": "info"},
}


# ─── Webhook: Report module event ───

class ModuleEventCreate(BaseModel):
    module_type: str  # jobs, shop, giftcard, forms, mail, booking
    event_type: str  # job_application, order_placed, form_submitted, etc.
    title: str
    description: str | None = None
    data: dict = {}
    source_url: str | None = None


@router.post("/{tenant_id}", status_code=201)
async def report_module_event(
    tenant_id: str,
    body: ModuleEventCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Webhook endpoint for WordPress sites to report module events.
    No auth required — tenant_id acts as the key (same as chat endpoint).
    """
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Validate event type
    try:
        event_type = ModuleEventType(body.event_type)
    except ValueError:
        event_type = ModuleEventType.custom

    # Get display info
    display = EVENT_DISPLAY.get(body.event_type, EVENT_DISPLAY["custom"])

    # Get client IP
    client_ip = request.client.host if request.client else None

    event = ModuleEvent(
        tenant_id=tid,
        module_type=body.module_type,
        event_type=event_type,
        title=body.title,
        description=body.description,
        severity=display["severity"],
        data=body.data,
        source_url=body.source_url,
        source_ip=client_ip,
    )
    db.add(event)

    # Update module stats if module exists
    result = await db.execute(
        select(SiteModule).where(and_(
            SiteModule.tenant_id == tid,
            SiteModule.module_type == ModuleType(body.module_type) if body.module_type in [e.value for e in ModuleType] else SiteModule.module_type == body.module_type,
        ))
    )
    module = result.scalar_one_or_none()
    if module:
        stats = dict(module.stats) if module.stats else {}
        count_key = f"{body.event_type}_count"
        stats[count_key] = stats.get(count_key, 0) + 1
        stats["last_event_at"] = datetime.now(timezone.utc).isoformat()
        module.stats = stats

    await db.flush()

    logger.info(f"[module-event] {body.module_type}/{body.event_type} for tenant {tenant_id}: {body.title}")

    return {
        "id": str(event.id),
        "event_type": event.event_type.value,
        "icon": display["icon"],
        "severity": display["severity"],
        "received": True,
    }


# ─── Query: Get module events for timeline ───

@router.get("/{tenant_id}")
async def get_module_events(
    tenant_id: str,
    hours: int = Query(24, ge=1, le=720),
    module_type: str | None = Query(None),
    event_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get module events for a tenant, used by the events timeline."""
    tid = uuid.UUID(tenant_id)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    query = select(ModuleEvent).where(and_(
        ModuleEvent.tenant_id == tid,
        ModuleEvent.created_at >= since,
    ))

    if module_type:
        query = query.where(ModuleEvent.module_type == module_type)
    if event_type:
        try:
            query = query.where(ModuleEvent.event_type == ModuleEventType(event_type))
        except ValueError:
            pass

    query = query.order_by(desc(ModuleEvent.created_at)).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "module_type": e.module_type,
            "event_type": e.event_type.value,
            "title": e.title,
            "description": e.description,
            "severity": e.severity,
            "data": e.data,
            "icon": EVENT_DISPLAY.get(e.event_type.value, EVENT_DISPLAY["custom"])["icon"],
            "source_url": e.source_url,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


# ─── Stats: Module event counts ───

@router.get("/{tenant_id}/stats")
async def get_module_event_stats(
    tenant_id: str,
    hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated module event stats for a tenant."""
    tid = uuid.UUID(tenant_id)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Count by module type
    by_module = await db.execute(
        select(ModuleEvent.module_type, func.count(ModuleEvent.id))
        .where(and_(ModuleEvent.tenant_id == tid, ModuleEvent.created_at >= since))
        .group_by(ModuleEvent.module_type)
    )

    # Count by event type
    by_event = await db.execute(
        select(ModuleEvent.event_type, func.count(ModuleEvent.id))
        .where(and_(ModuleEvent.tenant_id == tid, ModuleEvent.created_at >= since))
        .group_by(ModuleEvent.event_type)
    )

    # Total
    total = await db.execute(
        select(func.count(ModuleEvent.id))
        .where(and_(ModuleEvent.tenant_id == tid, ModuleEvent.created_at >= since))
    )

    return {
        "tenant_id": tenant_id,
        "period_hours": hours,
        "total": total.scalar() or 0,
        "by_module": {row[0]: row[1] for row in by_module.all()},
        "by_event": {row[0].value: row[1] for row in by_event.all()},
    }
