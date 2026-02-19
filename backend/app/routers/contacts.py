"""Contacts API — unified identity management."""
import uuid
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.module_event import ModuleEvent

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/contacts",
    tags=["admin-contacts"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/")
async def list_contacts(
    tenant_id: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List contacts with optional search and tenant filter."""
    q = select(Contact).order_by(desc(Contact.last_seen_at)).limit(limit).offset(offset)

    if tenant_id:
        q = q.where(Contact.tenant_id == uuid.UUID(tenant_id))

    if search:
        term = f"%{search.lower()}%"
        q = q.where(or_(
            func.lower(Contact.email).like(term),
            func.lower(Contact.name).like(term),
            Contact.phone.like(term),
            func.lower(Contact.company).like(term),
        ))

    result = await db.execute(q)
    contacts = result.scalars().all()

    return [_serialize_contact(c) for c in contacts]


@router.get("/stats")
async def contact_stats(
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get contact statistics."""
    base = select(func.count(Contact.id))
    if tenant_id:
        base = base.where(Contact.tenant_id == uuid.UUID(tenant_id))

    total = (await db.execute(base)).scalar() or 0

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)

    today_count = (await db.execute(base.where(Contact.created_at >= today))).scalar() or 0
    week_count = (await db.execute(base.where(Contact.created_at >= week_ago))).scalar() or 0

    # Contacts with orders
    with_orders = (await db.execute(base.where(Contact.total_orders > 0))).scalar() or 0
    with_convos = (await db.execute(base.where(Contact.total_conversations > 0))).scalar() or 0

    return {
        "total": total,
        "today": today_count,
        "this_week": week_count,
        "with_orders": with_orders,
        "with_conversations": with_convos,
    }


@router.get("/{contact_id}")
async def get_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full contact profile with all interactions."""
    contact = await db.get(Contact, uuid.UUID(contact_id))
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Get linked leads
    leads_result = await db.execute(
        select(Lead).where(Lead.contact_id == contact.id).order_by(desc(Lead.created_at)).limit(20)
    )
    leads = leads_result.scalars().all()

    # Get module events (orders, forms) matching email
    events = []
    if contact.email:
        events_result = await db.execute(
            select(ModuleEvent)
            .where(
                ModuleEvent.tenant_id == contact.tenant_id,
                ModuleEvent.data["email"].astext == contact.email,
            )
            .order_by(desc(ModuleEvent.created_at))
            .limit(50)
        )
        events = events_result.scalars().all()

    profile = _serialize_contact(contact)
    profile["leads"] = [
        {
            "id": str(l.id),
            "source": l.source.value if l.source else "chat",
            "message": l.message,
            "page_url": l.page_url,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in leads
    ]
    profile["events"] = [
        {
            "id": str(e.id),
            "module_type": e.module_type,
            "event_type": e.event_type.value if e.event_type else "custom",
            "title": e.title,
            "description": e.description,
            "data": e.data,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]

    return profile


def _serialize_contact(c: Contact) -> dict:
    return {
        "id": str(c.id),
        "tenant_id": str(c.tenant_id),
        "email": c.email,
        "phone": c.phone,
        "name": c.name,
        "company": c.company,
        "city": c.city,
        "country": c.country,
        "address": c.address,
        "language": c.language,
        "total_orders": c.total_orders,
        "total_spent": c.total_spent,
        "total_conversations": c.total_conversations,
        "total_form_submissions": c.total_form_submissions,
        "total_leads": c.total_leads,
        "tags": c.tags,
        "metadata": c.metadata_,
        "first_seen_at": c.first_seen_at.isoformat() if c.first_seen_at else None,
        "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }
