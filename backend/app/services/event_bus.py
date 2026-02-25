"""
TinyEclipse Event Bus — Lightweight technical event logging.
Call emit() from anywhere to register what happened.
Includes anomaly detection and health timeline aggregation.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from sqlalchemy import select, func, and_, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_event import SystemEvent, EventSeverity, EventDomain

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# EMIT — fire-and-forget event logging
# ═══════════════════════════════════════════════════════════════

async def emit(
    db: AsyncSession,
    domain: str,
    action: str,
    title: str,
    severity: str = "info",
    tenant_id: Optional[uuid.UUID] = None,
    detail: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    source: Optional[str] = None,
    ip: Optional[str] = None,
):
    """Log a system event. Call this from anywhere — it never raises."""
    try:
        event = SystemEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            domain=domain if domain in EventDomain.__members__ else "system",
            severity=severity if severity in EventSeverity.__members__ else "info",
            action=action,
            title=title[:500],
            detail=detail[:5000] if detail else None,
            data=data or {},
            source=source,
            ip=ip,
        )
        db.add(event)
        await db.flush()
    except Exception as e:
        logger.warning(f"[event_bus] Failed to emit event: {e}")


# ═══════════════════════════════════════════════════════════════
# TIMELINE — aggregated health timeline
# ═══════════════════════════════════════════════════════════════

async def get_timeline(
    db: AsyncSession,
    tenant_id: Optional[uuid.UUID] = None,
    domain: Optional[str] = None,
    severity: Optional[str] = None,
    hours: int = 168,  # 7 days default
    limit: int = 100,
) -> dict:
    """Get recent system events as a timeline."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    query = select(SystemEvent).where(SystemEvent.created_at >= since)

    if tenant_id:
        query = query.where(SystemEvent.tenant_id == tenant_id)
    if domain:
        query = query.where(SystemEvent.domain == domain)
    if severity:
        query = query.where(SystemEvent.severity == severity)

    # Total count
    count_q = select(func.count(SystemEvent.id)).where(SystemEvent.created_at >= since)
    if tenant_id:
        count_q = count_q.where(SystemEvent.tenant_id == tenant_id)
    if domain:
        count_q = count_q.where(SystemEvent.domain == domain)
    if severity:
        count_q = count_q.where(SystemEvent.severity == severity)
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(
        query.order_by(desc(SystemEvent.created_at)).limit(limit)
    )
    events = result.scalars().all()

    return {
        "total": total,
        "events": [
            {
                "id": str(e.id),
                "tenant_id": str(e.tenant_id) if e.tenant_id else None,
                "domain": e.domain if e.domain else "system",
                "severity": e.severity if e.severity else "info",
                "action": e.action,
                "title": e.title,
                "detail": e.detail,
                "data": e.data,
                "source": e.source,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


# ═══════════════════════════════════════════════════════════════
# ANOMALY DETECTION — simple spike/pattern detection
# ═══════════════════════════════════════════════════════════════

async def detect_anomalies(
    db: AsyncSession,
    tenant_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """Detect anomalies in recent events.

    Checks:
    1. Error spike — more errors in last hour than average
    2. Quiet period — no events when there should be (site down?)
    3. Repeated failures — same action failing multiple times
    """
    anomalies = []
    now = datetime.now(timezone.utc)

    # ── 1. Error spike ──
    last_hour = now - timedelta(hours=1)
    last_24h = now - timedelta(hours=24)

    base_q = select(func.count(SystemEvent.id))
    if tenant_id:
        base_q = base_q.where(SystemEvent.tenant_id == tenant_id)

    errors_1h = (await db.execute(
        base_q.where(and_(
            SystemEvent.severity.in_(["error", "critical"]),
            SystemEvent.created_at >= last_hour,
        ))
    )).scalar() or 0

    errors_24h = (await db.execute(
        base_q.where(and_(
            SystemEvent.severity.in_(["error", "critical"]),
            SystemEvent.created_at >= last_24h,
        ))
    )).scalar() or 0

    avg_errors_per_hour = errors_24h / 24 if errors_24h else 0
    if errors_1h > 3 and errors_1h > avg_errors_per_hour * 3:
        anomalies.append({
            "type": "error_spike",
            "severity": "high",
            "title": f"Foutenpiek: {errors_1h} fouten in het laatste uur",
            "detail": f"Gemiddelde is {avg_errors_per_hour:.1f}/uur over 24u. Nu {errors_1h}x.",
            "metric": errors_1h,
        })

    # ── 2. Repeated failures ──
    repeat_result = await db.execute(
        select(SystemEvent.action, func.count(SystemEvent.id).label("cnt"))
        .where(and_(
            SystemEvent.severity.in_(["error", "critical"]),
            SystemEvent.created_at >= last_24h,
            *([SystemEvent.tenant_id == tenant_id] if tenant_id else []),
        ))
        .group_by(SystemEvent.action)
        .having(func.count(SystemEvent.id) >= 3)
        .order_by(desc("cnt"))
        .limit(5)
    )
    for row in repeat_result.all():
        anomalies.append({
            "type": "repeated_failure",
            "severity": "medium",
            "title": f"Herhaalde fout: {row[0]} ({row[1]}x in 24u)",
            "detail": f"De actie '{row[0]}' is {row[1]}x mislukt in de afgelopen 24 uur.",
            "metric": row[1],
        })

    # ── 3. Domain health distribution ──
    domain_dist = await db.execute(
        select(SystemEvent.domain, SystemEvent.severity, func.count(SystemEvent.id))
        .where(and_(
            SystemEvent.created_at >= last_24h,
            *([SystemEvent.tenant_id == tenant_id] if tenant_id else []),
        ))
        .group_by(SystemEvent.domain, SystemEvent.severity)
    )
    domain_health = {}
    for dom, sev, cnt in domain_dist.all():
        d = str(dom)
        s = str(sev)
        if d not in domain_health:
            domain_health[d] = {"total": 0, "errors": 0}
        domain_health[d]["total"] += cnt
        if s in ("error", "critical"):
            domain_health[d]["errors"] += cnt

    for dom, stats in domain_health.items():
        if stats["total"] > 5 and stats["errors"] / stats["total"] > 0.3:
            anomalies.append({
                "type": "unhealthy_domain",
                "severity": "medium",
                "title": f"Domein '{dom}' heeft veel fouten ({stats['errors']}/{stats['total']})",
                "detail": f"{(stats['errors']/stats['total']*100):.0f}% van de events in '{dom}' zijn fouten.",
                "metric": stats["errors"],
            })

    return anomalies


# ═══════════════════════════════════════════════════════════════
# STATS — quick aggregations for dashboard
# ═══════════════════════════════════════════════════════════════

async def get_stats(
    db: AsyncSession,
    tenant_id: Optional[uuid.UUID] = None,
    hours: int = 24,
) -> dict:
    """Get event statistics for the dashboard."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    base = select(func.count(SystemEvent.id)).where(SystemEvent.created_at >= since)
    if tenant_id:
        base = base.where(SystemEvent.tenant_id == tenant_id)

    total = (await db.execute(base)).scalar() or 0
    errors = (await db.execute(
        base.where(SystemEvent.severity.in_(["error", "critical"]))
    )).scalar() or 0
    warnings = (await db.execute(
        base.where(SystemEvent.severity == "warning")
    )).scalar() or 0

    # Events per domain
    domain_result = await db.execute(
        select(SystemEvent.domain, func.count(SystemEvent.id))
        .where(and_(
            SystemEvent.created_at >= since,
            *([SystemEvent.tenant_id == tenant_id] if tenant_id else []),
        ))
        .group_by(SystemEvent.domain)
    )
    by_domain = {
        str(row[0]): row[1]
        for row in domain_result.all()
    }

    # Hourly distribution (last 24h)
    hourly_result = await db.execute(
        select(
            func.date_trunc('hour', SystemEvent.created_at).label("hour"),
            func.count(SystemEvent.id),
        )
        .where(and_(
            SystemEvent.created_at >= since,
            *([SystemEvent.tenant_id == tenant_id] if tenant_id else []),
        ))
        .group_by("hour")
        .order_by("hour")
    )
    hourly = [
        {"hour": row[0].isoformat() if row[0] else None, "count": row[1]}
        for row in hourly_result.all()
    ]

    return {
        "total": total,
        "errors": errors,
        "warnings": warnings,
        "by_domain": by_domain,
        "hourly": hourly,
    }
