"""
Visitor tracking API — receives events from the widget.
Lightweight, high-throughput endpoints for real-time tracking.
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.visitor import VisitorSession, PageView, VisitorEvent, EventType
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/track", tags=["tracking"])


# ─── Ingest Models ───

class SessionStart(BaseModel):
    tenant_id: str
    visitor_id: str
    session_id: str
    referrer: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    landing_page: str | None = None
    device_type: str | None = None
    browser: str | None = None
    os: str | None = None
    screen_width: int | None = None
    screen_height: int | None = None
    language: str | None = None


class PageViewEvent(BaseModel):
    tenant_id: str
    session_id: str
    url: str
    path: str
    title: str | None = None


class PageUpdate(BaseModel):
    tenant_id: str
    session_id: str
    path: str
    time_on_page_seconds: int = 0
    scroll_depth_percent: int = 0
    clicks: int = 0


class TrackEvent(BaseModel):
    tenant_id: str
    session_id: str
    event_type: str
    page_path: str
    element: str | None = None
    value: str | None = None
    metadata: dict = {}


class SessionEnd(BaseModel):
    tenant_id: str
    session_id: str
    duration_seconds: int = 0


# ─── Endpoints ───

@router.post("/session", status_code=201)
async def start_session(body: SessionStart, request: Request, db: AsyncSession = Depends(get_db)):
    """Start a new visitor session."""
    tenant = await db.get(Tenant, uuid.UUID(body.tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    session = VisitorSession(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(body.tenant_id),
        visitor_id=body.visitor_id,
        session_id=body.session_id,
        referrer=body.referrer,
        utm_source=body.utm_source,
        utm_medium=body.utm_medium,
        utm_campaign=body.utm_campaign,
        landing_page=body.landing_page,
        device_type=body.device_type,
        browser=body.browser,
        os=body.os,
        screen_width=body.screen_width,
        screen_height=body.screen_height,
        language=body.language,
    )
    db.add(session)
    await db.flush()
    return {"status": "session_started", "session_id": body.session_id}


@router.post("/pageview", status_code=201)
async def track_pageview(body: PageViewEvent, db: AsyncSession = Depends(get_db)):
    """Track a page view."""
    pv = PageView(
        id=uuid.uuid4(),
        session_id=body.session_id,
        tenant_id=uuid.UUID(body.tenant_id),
        url=body.url,
        path=body.path,
        title=body.title,
    )
    db.add(pv)

    # Update session page count + bounce status
    result = await db.execute(
        select(VisitorSession).where(VisitorSession.session_id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if session:
        session.page_count += 1
        if session.page_count > 1:
            session.is_bounce = False

    await db.flush()
    return {"status": "pageview_tracked"}


@router.post("/page-update")
async def update_page_metrics(body: PageUpdate, db: AsyncSession = Depends(get_db)):
    """Update engagement metrics for a page view (scroll, time, clicks)."""
    result = await db.execute(
        select(PageView)
        .where(and_(PageView.session_id == body.session_id, PageView.path == body.path))
        .order_by(PageView.created_at.desc())
        .limit(1)
    )
    pv = result.scalar_one_or_none()
    if pv:
        pv.time_on_page_seconds = max(pv.time_on_page_seconds, body.time_on_page_seconds)
        pv.scroll_depth_percent = max(pv.scroll_depth_percent, body.scroll_depth_percent)
        pv.clicks = max(pv.clicks, body.clicks)
        await db.flush()
    return {"status": "updated"}


@router.post("/event", status_code=201)
async def track_event(body: TrackEvent, db: AsyncSession = Depends(get_db)):
    """Track a behavioral event."""
    try:
        event_type = EventType(body.event_type)
    except ValueError:
        event_type = EventType.custom

    event = VisitorEvent(
        id=uuid.uuid4(),
        session_id=body.session_id,
        tenant_id=uuid.UUID(body.tenant_id),
        event_type=event_type,
        page_path=body.page_path,
        element=body.element,
        value=body.value,
        metadata_=body.metadata,
    )
    db.add(event)

    # Update session event count
    result = await db.execute(
        select(VisitorSession).where(VisitorSession.session_id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if session:
        session.event_count += 1
        if event_type == EventType.chat_open:
            session.chat_initiated = True
        if event_type == EventType.conversion:
            session.has_conversion = True

    await db.flush()
    return {"status": "event_tracked"}


@router.post("/session-end")
async def end_session(body: SessionEnd, db: AsyncSession = Depends(get_db)):
    """End a visitor session."""
    result = await db.execute(
        select(VisitorSession).where(VisitorSession.session_id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if session:
        session.duration_seconds = body.duration_seconds
        session.ended_at = datetime.now(timezone.utc)
        await db.flush()
    return {"status": "session_ended"}


# ─── Analytics Queries (admin) ───

@router.get("/analytics/{tenant_id}")
async def get_analytics(
    tenant_id: str,
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
):
    """Get visitor analytics summary for a tenant."""
    from app.middleware.auth import verify_admin_key
    tid = uuid.UUID(tenant_id)
    since = datetime.now(timezone.utc) - __import__("datetime").timedelta(hours=hours)

    # Sessions
    sessions_result = await db.execute(
        select(VisitorSession).where(
            and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= since)
        )
    )
    sessions = sessions_result.scalars().all()

    # Page views
    pv_result = await db.execute(
        select(func.count(PageView.id)).where(
            and_(PageView.tenant_id == tid, PageView.created_at >= since)
        )
    )
    total_pageviews = pv_result.scalar() or 0

    # Top pages
    top_pages_result = await db.execute(
        select(PageView.path, func.count(PageView.id).label("views"))
        .where(and_(PageView.tenant_id == tid, PageView.created_at >= since))
        .group_by(PageView.path)
        .order_by(func.count(PageView.id).desc())
        .limit(10)
    )
    top_pages = [{"path": r[0], "views": r[1]} for r in top_pages_result.all()]

    # Events breakdown
    events_result = await db.execute(
        select(VisitorEvent.event_type, func.count(VisitorEvent.id).label("count"))
        .where(and_(VisitorEvent.tenant_id == tid, VisitorEvent.created_at >= since))
        .group_by(VisitorEvent.event_type)
    )
    events_breakdown = {str(r[0].value): r[1] for r in events_result.all()}

    total_sessions = len(sessions)
    bounces = sum(1 for s in sessions if s.is_bounce)
    conversions = sum(1 for s in sessions if s.has_conversion)
    chat_sessions = sum(1 for s in sessions if s.chat_initiated)
    avg_duration = sum(s.duration_seconds for s in sessions) / max(total_sessions, 1)
    avg_pages = sum(s.page_count for s in sessions) / max(total_sessions, 1)

    # Device breakdown
    devices = {}
    for s in sessions:
        dt = s.device_type or "unknown"
        devices[dt] = devices.get(dt, 0) + 1

    # Source breakdown
    sources = {}
    for s in sessions:
        src = s.utm_source or s.referrer or "direct"
        if len(src) > 50:
            src = src[:50]
        sources[src] = sources.get(src, 0) + 1

    return {
        "tenant_id": tenant_id,
        "period_hours": hours,
        "summary": {
            "total_sessions": total_sessions,
            "total_pageviews": total_pageviews,
            "bounce_rate": round(bounces / max(total_sessions, 1) * 100, 1),
            "conversion_rate": round(conversions / max(total_sessions, 1) * 100, 1),
            "chat_engagement_rate": round(chat_sessions / max(total_sessions, 1) * 100, 1),
            "avg_duration_seconds": round(avg_duration, 1),
            "avg_pages_per_session": round(avg_pages, 1),
        },
        "top_pages": top_pages,
        "events": events_breakdown,
        "devices": devices,
        "sources": dict(sorted(sources.items(), key=lambda x: x[1], reverse=True)[:10]),
    }


@router.get("/journey/{session_id}")
async def get_visitor_journey(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get complete journey for a specific session — every page, event, in order."""
    result = await db.execute(
        select(VisitorSession).where(VisitorSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Page views
    pv_result = await db.execute(
        select(PageView).where(PageView.session_id == session_id).order_by(PageView.created_at)
    )
    pages = pv_result.scalars().all()

    # Events
    ev_result = await db.execute(
        select(VisitorEvent).where(VisitorEvent.session_id == session_id).order_by(VisitorEvent.created_at)
    )
    events = ev_result.scalars().all()

    return {
        "session": {
            "visitor_id": session.visitor_id,
            "device": session.device_type,
            "browser": session.browser,
            "referrer": session.referrer,
            "landing_page": session.landing_page,
            "duration_seconds": session.duration_seconds,
            "page_count": session.page_count,
            "is_bounce": session.is_bounce,
            "has_conversion": session.has_conversion,
            "chat_initiated": session.chat_initiated,
            "created_at": session.created_at.isoformat(),
        },
        "journey": [
            {
                "type": "pageview",
                "path": p.path,
                "title": p.title,
                "time_on_page": p.time_on_page_seconds,
                "scroll_depth": p.scroll_depth_percent,
                "clicks": p.clicks,
                "timestamp": p.created_at.isoformat(),
            }
            for p in pages
        ],
        "events": [
            {
                "type": e.event_type.value,
                "page": e.page_path,
                "element": e.element,
                "value": e.value,
                "metadata": e.metadata_,
                "timestamp": e.created_at.isoformat(),
            }
            for e in events
        ],
    }
