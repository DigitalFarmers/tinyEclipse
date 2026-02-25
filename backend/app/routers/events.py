"""
Events API — Unified timeline of everything happening on a tenant's site.
Sales, leads, contacts, form submissions, chat conversations, monitoring alerts, page views.
The single source of truth for "what happened on my website?"
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.monitor import Alert
from app.models.visitor import VisitorSession, PageView, VisitorEvent, EventType
from app.models.module_event import ModuleEvent, ModuleEventType

logger = logging.getLogger(__name__)

# Display metadata for module events
_MODULE_EVENT_DISPLAY = {
    "job_application": {"icon": "📋", "type": "lead"},
    "job_published": {"icon": "📢", "type": "module"},
    "order_placed": {"icon": "🛒", "type": "sale"},
    "order_completed": {"icon": "✅", "type": "sale"},
    "order_refunded": {"icon": "💸", "type": "sale"},
    "giftcard_purchased": {"icon": "🎁", "type": "sale"},
    "giftcard_redeemed": {"icon": "🎉", "type": "module"},
    "form_submitted": {"icon": "📝", "type": "contact"},
    "booking_created": {"icon": "📅", "type": "lead"},
    "booking_cancelled": {"icon": "❌", "type": "module"},
    "custom": {"icon": "⚡", "type": "module"},
}

router = APIRouter(prefix="/api/portal/events", tags=["portal-events"])


@router.get("/{tenant_id}")
async def get_events_timeline(
    tenant_id: str,
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(50, ge=1, le=200),
    event_type: Optional[str] = Query(None, description="Filter: chat, alert, visit, lead, sale, contact"),
    db: AsyncSession = Depends(get_db),
):
    """
    Unified events timeline. Merges all activity into one chronological feed.

    Event types:
    - chat: New conversation or message from visitor
    - alert: Monitoring alert (uptime, SSL, DNS, performance)
    - visit: New visitor session
    - lead: Visitor engaged with chat (potential lead)
    - contact: Form submission or contact attempt
    - sale: E-commerce event (if tracked)
    """
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    events = []

    # ─── Chat Conversations ───
    if not event_type or event_type in ("chat", "lead"):
        convos = await db.execute(
            select(Conversation)
            .where(and_(Conversation.tenant_id == tid, Conversation.created_at >= since))
            .order_by(desc(Conversation.created_at))
            .limit(limit)
        )
        for c in convos.scalars().all():
            # Get first user message as preview
            first_msg = await db.execute(
                select(Message)
                .where(and_(Message.conversation_id == c.id, Message.role == MessageRole.user))
                .order_by(Message.created_at)
                .limit(1)
            )
            msg = first_msg.scalar_one_or_none()
            preview = msg.content[:120] if msg else "Nieuw gesprek"

            # Count messages
            msg_count = await db.execute(
                select(func.count(Message.id)).where(Message.conversation_id == c.id)
            )
            count = msg_count.scalar() or 0

            # Determine if this is a lead (engaged visitor)
            is_lead = count >= 3  # 3+ messages = engaged = lead

            events.append({
                "id": str(c.id),
                "type": "lead" if is_lead else "chat",
                "icon": "🔥" if is_lead else "💬",
                "title": "Nieuwe lead via chat" if is_lead else "Chat gesprek",
                "description": preview,
                "metadata": {
                    "conversation_id": str(c.id),
                    "message_count": count,
                    "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                },
                "severity": "info" if not is_lead else "success",
                "timestamp": c.created_at.isoformat(),
            })

    # ─── Monitoring Alerts ───
    if not event_type or event_type == "alert":
        alerts = await db.execute(
            select(Alert)
            .where(and_(Alert.tenant_id == tid, Alert.created_at >= since))
            .order_by(desc(Alert.created_at))
            .limit(limit)
        )
        for a in alerts.scalars().all():
            events.append({
                "id": str(a.id),
                "type": "alert",
                "icon": "🚨" if a.severity == "critical" else "⚠️",
                "title": f"Monitoring alert: {a.check_type}",
                "description": a.message,
                "metadata": {
                    "alert_id": str(a.id),
                    "check_type": a.check_type,
                    "severity": a.severity,
                    "acknowledged": a.acknowledged,
                    "resolved": a.resolved,
                },
                "severity": a.severity,
                "timestamp": a.created_at.isoformat(),
            })

    # ─── Visitor Sessions ───
    if not event_type or event_type == "visit":
        sessions = await db.execute(
            select(VisitorSession)
            .where(and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= since))
            .order_by(desc(VisitorSession.created_at))
            .limit(min(limit, 30))  # Cap visits to avoid flooding
        )
        for s in sessions.scalars().all():
            # Count page views
            pv_count = await db.execute(
                select(func.count(PageView.id)).where(PageView.session_id == s.session_id)
            )
            pages = pv_count.scalar() or 0

            duration = ""
            if s.ended_at and s.created_at:
                secs = (s.ended_at - s.created_at).total_seconds()
                if secs > 60:
                    duration = f"{int(secs // 60)}m {int(secs % 60)}s"
                else:
                    duration = f"{int(secs)}s"

            events.append({
                "id": str(s.id),
                "type": "visit",
                "icon": "👤",
                "title": "Nieuwe bezoeker",
                "description": f"{pages} pagina's bekeken" + (f" · {duration}" if duration else ""),
                "metadata": {
                    "session_id": str(s.id),
                    "page_count": pages,
                    "referrer": s.referrer if hasattr(s, 'referrer') else None,
                    "device": s.device_type if hasattr(s, 'device_type') else None,
                },
                "severity": "info",
                "timestamp": s.created_at.isoformat(),
            })

    # ─── Visitor Events (contact forms, clicks, custom events) ───
    if not event_type or event_type in ("contact", "sale"):
        try:
            visitor_events = await db.execute(
                select(VisitorEvent)
                .where(and_(
                    VisitorEvent.tenant_id == tid,
                    VisitorEvent.created_at >= since,
                    VisitorEvent.event_type.in_([
                        EventType.form_submit,
                        EventType.conversion,
                        EventType.custom,
                    ]),
                ))
                .order_by(desc(VisitorEvent.created_at))
                .limit(limit)
            )
            for ve in visitor_events.scalars().all():
                is_sale = ve.event_type == EventType.conversion
                meta = ve.metadata_ if isinstance(ve.metadata_, dict) else {}

                events.append({
                    "id": str(ve.id),
                    "type": "sale" if is_sale else "contact",
                    "icon": "💰" if is_sale else "📧",
                    "title": "Nieuwe verkoop!" if is_sale else "Contactformulier ingevuld",
                    "description": meta.get("description", ve.event_type.value if hasattr(ve.event_type, 'value') else str(ve.event_type)),
                    "metadata": meta,
                    "severity": "success" if is_sale else "info",
                    "timestamp": ve.created_at.isoformat(),
                })
        except Exception as e:
            logger.warning(f"Error fetching visitor events: {e}")

    # ─── Module Events (jobs, shop, forms, giftcards, bookings) ───
    if not event_type or event_type in ("module", "sale", "lead", "contact"):
        try:
            me_query = select(ModuleEvent).where(and_(
                ModuleEvent.tenant_id == tid,
                ModuleEvent.created_at >= since,
            ))
            # Filter by mapped event type if specified
            if event_type:
                matching_types = [k for k, v in _MODULE_EVENT_DISPLAY.items() if v["type"] == event_type]
                if matching_types:
                    me_query = me_query.where(ModuleEvent.event_type.in_(
                        [ModuleEventType(t) for t in matching_types]
                    ))
            me_query = me_query.order_by(desc(ModuleEvent.created_at)).limit(limit)
            module_events = await db.execute(me_query)

            for me in module_events.scalars().all():
                display = _MODULE_EVENT_DISPLAY.get(me.event_type.value, _MODULE_EVENT_DISPLAY["custom"])
                events.append({
                    "id": str(me.id),
                    "type": display["type"],
                    "icon": display["icon"],
                    "title": me.title,
                    "description": me.description or me.event_type.value,
                    "metadata": {
                        "module_type": me.module_type,
                        "event_type": me.event_type.value,
                        "data": me.data,
                        "source_url": me.source_url,
                    },
                    "severity": me.severity,
                    "timestamp": me.created_at.isoformat(),
                })
        except Exception as e:
            logger.warning(f"Error fetching module events: {e}")

    # Sort all events by timestamp descending
    events.sort(key=lambda e: e["timestamp"], reverse=True)
    events = events[:limit]

    # Summary stats
    type_counts = {}
    for e in events:
        type_counts[e["type"]] = type_counts.get(e["type"], 0) + 1

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.name,
        "period_hours": hours,
        "total_events": len(events),
        "summary": type_counts,
        "events": events,
    }


@router.get("/{tenant_id}/stats")
async def get_events_stats(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Quick stats for the portal dashboard — last 24h summary."""
    tid = uuid.UUID(tenant_id)
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)

    # Conversations last 24h
    chats_24h = await db.execute(
        select(func.count(Conversation.id))
        .where(and_(Conversation.tenant_id == tid, Conversation.created_at >= since_24h))
    )

    # Conversations last 7d
    chats_7d = await db.execute(
        select(func.count(Conversation.id))
        .where(and_(Conversation.tenant_id == tid, Conversation.created_at >= since_7d))
    )

    # Visitor sessions last 24h
    visits_24h = await db.execute(
        select(func.count(VisitorSession.id))
        .where(and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= since_24h))
    )

    # Alerts last 24h
    alerts_24h = await db.execute(
        select(func.count(Alert.id))
        .where(and_(Alert.tenant_id == tid, Alert.created_at >= since_24h))
    )

    # Unresolved alerts
    unresolved = await db.execute(
        select(func.count(Alert.id))
        .where(and_(Alert.tenant_id == tid, Alert.resolved == False))
    )

    return {
        "tenant_id": tenant_id,
        "last_24h": {
            "conversations": chats_24h.scalar() or 0,
            "visitors": visits_24h.scalar() or 0,
            "alerts": alerts_24h.scalar() or 0,
        },
        "last_7d": {
            "conversations": chats_7d.scalar() or 0,
        },
        "unresolved_alerts": unresolved.scalar() or 0,
    }
