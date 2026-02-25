"""
Visitor tracking API — receives events from the widget.
Lightweight, high-throughput endpoints for real-time tracking.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict

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
    referrer: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    landing_page: Optional[str] = None
    device_type: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    language: Optional[str] = None


class PageViewEvent(BaseModel):
    tenant_id: str
    session_id: str
    url: str
    path: str
    title: Optional[str] = None


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
    element: Optional[str] = None
    value: Optional[str] = None
    metadata: Dict = {}


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

    # Build/update persistent visitor profile (fire-and-forget)
    try:
        from app.services.brain import upsert_visitor_profile
        await upsert_visitor_profile(
            db=db,
            tenant_id=uuid.UUID(body.tenant_id),
            visitor_id=body.visitor_id,
            session_data={
                "landing_page": body.landing_page,
                "country": None,  # enriched later via IP
                "city": None,
                "language": body.language,
                "device_type": body.device_type,
                "browser": body.browser,
            },
        )
    except Exception:
        pass  # Never break tracking for profiling

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

        # Increment visitor profile pageviews
        try:
            from app.models.knowledge_gap import VisitorProfile
            vp_result = await db.execute(
                select(VisitorProfile).where(
                    VisitorProfile.tenant_id == uuid.UUID(body.tenant_id),
                    VisitorProfile.visitor_id == session.visitor_id,
                )
            )
            vp = vp_result.scalar_one_or_none()
            if vp:
                vp.total_pageviews += 1
        except Exception:
            pass

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

        # Increment visitor profile event/conversation counts
        try:
            from app.models.knowledge_gap import VisitorProfile
            vp_result = await db.execute(
                select(VisitorProfile).where(
                    VisitorProfile.tenant_id == uuid.UUID(body.tenant_id),
                    VisitorProfile.visitor_id == session.visitor_id,
                )
            )
            vp = vp_result.scalar_one_or_none()
            if vp:
                vp.total_events += 1
                if event_type == EventType.chat_open:
                    vp.total_conversations += 1
        except Exception:
            pass

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

        # Update visitor profile total time
        try:
            from app.models.knowledge_gap import VisitorProfile
            vp_result = await db.execute(
                select(VisitorProfile).where(
                    VisitorProfile.tenant_id == session.tenant_id,
                    VisitorProfile.visitor_id == session.visitor_id,
                )
            )
            vp = vp_result.scalar_one_or_none()
            if vp:
                vp.total_time_seconds += body.duration_seconds
                vp.last_seen_at = datetime.now(timezone.utc)
        except Exception:
            pass

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


# ─── Deep Analytics ───

# WPML path prefixes to strip for bundling
WPML_LANG_PREFIXES = ['/en/', '/nl/', '/fr/', '/de/', '/es/', '/it/', '/pt/', '/ar/', '/tr/', '/ja/', '/zh/']

def _normalize_path(path: str) -> str:
    """Strip WPML language prefix for path bundling. /en/about → /about, /fr/about → /about"""
    for prefix in WPML_LANG_PREFIXES:
        if path.startswith(prefix):
            return '/' + path[len(prefix):]
    return path


def _extract_lang_from_path(path: str) -> Optional[str]:
    """Extract language code from WPML path prefix."""
    for prefix in WPML_LANG_PREFIXES:
        if path.startswith(prefix):
            return prefix.strip('/')
    return None


@router.get("/deep/{tenant_id}")
async def deep_analytics(
    tenant_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    preset: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Deep analytics with date range, geo, language, device, referrer, hourly chart, top pages.
    
    Presets: today, 7d, 30d, 90d, ytd
    Custom: date_from=2026-01-01&date_to=2026-02-24
    """
    from datetime import timedelta
    tid = uuid.UUID(tenant_id)
    now = datetime.now(timezone.utc)

    # Parse date range
    if preset == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
        until = now
    elif preset == "7d":
        since = now - timedelta(days=7)
        until = now
    elif preset == "90d":
        since = now - timedelta(days=90)
        until = now
    elif preset == "ytd":
        since = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        until = now
    elif date_from and date_to:
        since = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        until = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    else:
        since = now - timedelta(days=30)
        until = now

    prev_duration = until - since
    prev_since = since - prev_duration

    # ── Fetch sessions ──
    sessions_result = await db.execute(
        select(VisitorSession).where(and_(
            VisitorSession.tenant_id == tid,
            VisitorSession.created_at >= since,
            VisitorSession.created_at <= until,
        ))
    )
    sessions = sessions_result.scalars().all()

    prev_sessions_q = await db.execute(
        select(func.count(VisitorSession.id)).where(and_(
            VisitorSession.tenant_id == tid,
            VisitorSession.created_at >= prev_since,
            VisitorSession.created_at < since,
        ))
    )
    prev_session_count = prev_sessions_q.scalar() or 0

    # ── Fetch page views ──
    pv_result = await db.execute(
        select(PageView).where(and_(
            PageView.tenant_id == tid,
            PageView.created_at >= since,
            PageView.created_at <= until,
        ))
    )
    pageviews = pv_result.scalars().all()

    total_sessions = len(sessions)
    total_pageviews = len(pageviews)
    bounces = sum(1 for s in sessions if s.is_bounce)
    conversions = sum(1 for s in sessions if s.has_conversion)
    avg_duration = sum(s.duration_seconds for s in sessions) / max(total_sessions, 1)
    avg_pages = sum(s.page_count for s in sessions) / max(total_sessions, 1)

    def pct_change(current, previous):
        if previous == 0: return 100.0 if current > 0 else 0.0
        return round((current - previous) / previous * 100, 1)

    # ── Geo breakdown ──
    countries = {}
    cities = {}
    for s in sessions:
        c = s.country or "unknown"
        countries[c] = countries.get(c, 0) + 1
        if s.city:
            cities[s.city] = cities.get(s.city, 0) + 1

    # ── Language breakdown ──
    languages = {}
    for s in sessions:
        lang = (s.language or "unknown").split('-')[0].lower()
        languages[lang] = languages.get(lang, 0) + 1

    # ── Device & browser breakdown ──
    devices = {}
    browsers = {}
    os_breakdown = {}
    for s in sessions:
        d = s.device_type or "unknown"
        devices[d] = devices.get(d, 0) + 1
        b = s.browser or "unknown"
        browsers[b] = browsers.get(b, 0) + 1
        o = s.os or "unknown"
        os_breakdown[o] = os_breakdown.get(o, 0) + 1

    # ── Referrer / UTM breakdown ──
    referrers = {}
    utm_sources = {}
    utm_campaigns = {}
    for s in sessions:
        ref = s.referrer or "direct"
        if "google" in ref.lower(): ref = "Google"
        elif "facebook" in ref.lower() or "fb." in ref.lower(): ref = "Facebook"
        elif "instagram" in ref.lower(): ref = "Instagram"
        elif "linkedin" in ref.lower(): ref = "LinkedIn"
        elif "twitter" in ref.lower() or "t.co" in ref.lower(): ref = "Twitter/X"
        elif ref == "direct": pass
        else:
            try:
                from urllib.parse import urlparse
                ref = urlparse(ref).netloc or ref[:50]
            except: ref = ref[:50]
        referrers[ref] = referrers.get(ref, 0) + 1

        if s.utm_source:
            utm_sources[s.utm_source] = utm_sources.get(s.utm_source, 0) + 1
        if s.utm_campaign:
            utm_campaigns[s.utm_campaign] = utm_campaigns.get(s.utm_campaign, 0) + 1

    # ── Top pages (WPML-bundled) ──
    page_stats = {}
    for pv in pageviews:
        normalized = _normalize_path(pv.path)
        if normalized not in page_stats:
            page_stats[normalized] = {
                "path": normalized, "views": 0, "total_time": 0,
                "total_scroll": 0, "total_clicks": 0, "titles": set(), "languages": set(),
            }
        ps = page_stats[normalized]
        ps["views"] += 1
        ps["total_time"] += pv.time_on_page_seconds
        ps["total_scroll"] += pv.scroll_depth_percent
        ps["total_clicks"] += pv.clicks
        if pv.title: ps["titles"].add(pv.title)
        lang = _extract_lang_from_path(pv.path)
        if lang: ps["languages"].add(lang)

    top_pages = sorted(page_stats.values(), key=lambda x: x["views"], reverse=True)[:20]
    for p in top_pages:
        v = p["views"]
        p["avg_time"] = round(p.pop("total_time") / max(v, 1), 1)
        p["avg_scroll"] = round(p.pop("total_scroll") / max(v, 1))
        p["avg_clicks"] = round(p.pop("total_clicks") / max(v, 1), 1)
        p["title"] = next(iter(p.pop("titles")), None)
        p["languages"] = sorted(p["languages"])

    # ── Hourly/daily traffic chart ──
    chart_data = []
    duration_days = (until - since).days
    if duration_days <= 2:
        # Hourly buckets
        for h in range(24):
            bucket_start = since.replace(hour=h, minute=0, second=0, microsecond=0)
            bucket_end = bucket_start + timedelta(hours=1)
            s_count = sum(1 for s in sessions if bucket_start <= s.created_at < bucket_end)
            pv_count = sum(1 for p in pageviews if bucket_start <= p.created_at < bucket_end)
            chart_data.append({"label": f"{h:02d}:00", "sessions": s_count, "pageviews": pv_count})
    else:
        # Daily buckets
        day = since.replace(hour=0, minute=0, second=0, microsecond=0)
        while day <= until:
            day_end = day + timedelta(days=1)
            s_count = sum(1 for s in sessions if day <= s.created_at < day_end)
            pv_count = sum(1 for p in pageviews if day <= p.created_at < day_end)
            chart_data.append({"label": day.strftime("%d/%m"), "sessions": s_count, "pageviews": pv_count})
            day = day_end

    # ── Recent sessions (for session explorer) ──
    recent_sessions = sorted(sessions, key=lambda s: s.created_at, reverse=True)[:20]
    sessions_list = [
        {
            "session_id": s.session_id, "visitor_id": s.visitor_id[:8],
            "device": s.device_type, "browser": s.browser, "country": s.country,
            "language": s.language, "landing_page": s.landing_page,
            "page_count": s.page_count, "duration": s.duration_seconds,
            "is_bounce": s.is_bounce, "has_conversion": s.has_conversion,
            "referrer": s.referrer, "created_at": s.created_at.isoformat(),
        }
        for s in recent_sessions
    ]

    return {
        "tenant_id": tenant_id,
        "period": {"from": since.isoformat(), "to": until.isoformat(), "days": duration_days},
        "summary": {
            "sessions": total_sessions,
            "sessions_change": pct_change(total_sessions, prev_session_count),
            "pageviews": total_pageviews,
            "bounce_rate": round(bounces / max(total_sessions, 1) * 100, 1),
            "conversion_rate": round(conversions / max(total_sessions, 1) * 100, 1),
            "avg_duration": round(avg_duration, 1),
            "avg_pages": round(avg_pages, 1),
        },
        "chart": chart_data,
        "geo": {
            "countries": dict(sorted(countries.items(), key=lambda x: x[1], reverse=True)),
            "cities": dict(sorted(cities.items(), key=lambda x: x[1], reverse=True)[:15]),
        },
        "languages": dict(sorted(languages.items(), key=lambda x: x[1], reverse=True)),
        "devices": devices,
        "browsers": dict(sorted(browsers.items(), key=lambda x: x[1], reverse=True)[:10]),
        "os": dict(sorted(os_breakdown.items(), key=lambda x: x[1], reverse=True)[:10]),
        "referrers": dict(sorted(referrers.items(), key=lambda x: x[1], reverse=True)[:15]),
        "utm_sources": dict(sorted(utm_sources.items(), key=lambda x: x[1], reverse=True)[:10]),
        "utm_campaigns": dict(sorted(utm_campaigns.items(), key=lambda x: x[1], reverse=True)[:10]),
        "top_pages": top_pages,
        "recent_sessions": sessions_list,
    }
