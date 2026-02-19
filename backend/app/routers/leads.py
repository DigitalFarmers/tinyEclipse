"""Leads API — capture and manage visitor contact info from widget."""
import uuid
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.lead import Lead, LeadSource
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# ─── Public endpoint (widget calls this) ───
public_router = APIRouter(prefix="/api/leads", tags=["leads"])

# ─── Admin endpoint (Hub reads this) ───
admin_router = APIRouter(
    prefix="/api/admin/leads",
    tags=["admin-leads"],
    dependencies=[Depends(verify_admin_key)],
)


class LeadCreate(BaseModel):
    tenant_id: str
    session_id: str | None = None
    conversation_id: str | None = None
    email: str | None = None
    name: str | None = None
    phone: str | None = None
    message: str | None = None
    source: str = "chat"
    page_url: str | None = None


@public_router.post("/")
async def create_lead(body: LeadCreate, db: AsyncSession = Depends(get_db)):
    """Widget submits a lead (visitor contact info)."""
    if not body.email and not body.phone and not body.name:
        raise HTTPException(status_code=400, detail="At least email, phone, or name required")

    try:
        tid = uuid.UUID(body.tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant_id")

    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    source = LeadSource.chat
    if body.source == "exit_intent":
        source = LeadSource.exit_intent
    elif body.source == "proactive":
        source = LeadSource.proactive
    elif body.source == "manual":
        source = LeadSource.manual

    conv_id = None
    if body.conversation_id:
        try:
            conv_id = uuid.UUID(body.conversation_id)
        except ValueError:
            pass

    lead = Lead(
        tenant_id=tid,
        session_id=body.session_id,
        conversation_id=conv_id,
        email=body.email,
        name=body.name,
        phone=body.phone,
        message=body.message,
        source=source,
        page_url=body.page_url,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    logger.info(f"[lead] New lead for {tenant.name}: {body.email or body.name or body.phone}")
    return {"status": "captured", "lead_id": str(lead.id)}


# ─── Admin: list leads ───

@admin_router.get("/")
async def list_leads(
    tenant_id: str | None = Query(None),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all leads, optionally filtered by tenant."""
    q = select(Lead).order_by(desc(Lead.created_at)).limit(limit)

    if tenant_id:
        q = q.where(Lead.tenant_id == uuid.UUID(tenant_id))

    cutoff = datetime.utcnow() - timedelta(days=days)
    q = q.where(Lead.created_at >= cutoff)

    result = await db.execute(q)
    leads = result.scalars().all()

    return [
        {
            "id": str(l.id),
            "tenant_id": str(l.tenant_id),
            "session_id": l.session_id,
            "conversation_id": str(l.conversation_id) if l.conversation_id else None,
            "email": l.email,
            "name": l.name,
            "phone": l.phone,
            "message": l.message,
            "source": l.source.value if l.source else "chat",
            "page_url": l.page_url,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in leads
    ]


@admin_router.get("/stats")
async def lead_stats(
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get lead statistics."""
    base = select(func.count(Lead.id))
    if tenant_id:
        base = base.where(Lead.tenant_id == uuid.UUID(tenant_id))

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    total = (await db.execute(base)).scalar() or 0
    today_count = (await db.execute(base.where(Lead.created_at >= today))).scalar() or 0
    week_count = (await db.execute(base.where(Lead.created_at >= week_ago))).scalar() or 0
    month_count = (await db.execute(base.where(Lead.created_at >= month_ago))).scalar() or 0

    # Count by source
    source_q = select(Lead.source, func.count(Lead.id)).group_by(Lead.source)
    if tenant_id:
        source_q = source_q.where(Lead.tenant_id == uuid.UUID(tenant_id))
    source_result = await db.execute(source_q)
    by_source = {row[0].value if row[0] else "unknown": row[1] for row in source_result}

    return {
        "total": total,
        "today": today_count,
        "this_week": week_count,
        "this_month": month_count,
        "by_source": by_source,
    }
