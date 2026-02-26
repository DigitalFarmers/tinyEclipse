"""Monitoring API endpoints — 24/7/365 site monitoring for tenants."""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.monitor import (
    MonitorCheck, MonitorResult, Alert,
    CheckType, CheckStatus, AlertSeverity,
)
from app.services.monitor import execute_check_and_store, setup_default_checks, run_due_checks

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/monitoring",
    tags=["admin-monitoring"],
    dependencies=[Depends(verify_admin_key)],
)


class CheckCreate(BaseModel):
    tenant_id: str
    check_type: str
    target: str
    interval_minutes: int = 5
    config: Dict = {}


class CheckUpdate(BaseModel):
    enabled: Optional[bool] = None
    interval_minutes: Optional[int] = None
    config: Optional[Dict] = None
    target: Optional[str] = None


# ─── Dashboard Overview ───

@router.get("/dashboard/{tenant_id}")
async def monitoring_dashboard(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Full monitoring dashboard for a tenant — all checks, recent alerts, stats."""
    tid = uuid.UUID(tenant_id)

    # All checks
    checks_result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.tenant_id == tid)
    )
    checks = checks_result.scalars().all()

    # Recent alerts (last 24h)
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    alerts_result = await db.execute(
        select(Alert).where(
            and_(Alert.tenant_id == tid, Alert.created_at >= since)
        ).order_by(Alert.created_at.desc())
    )
    alerts = alerts_result.scalars().all()

    # Stats
    total_checks = len(checks)
    ok_count = sum(1 for c in checks if c.last_status == CheckStatus.ok)
    warning_count = sum(1 for c in checks if c.last_status == CheckStatus.warning)
    critical_count = sum(1 for c in checks if c.last_status == CheckStatus.critical)

    overall = "healthy"
    if critical_count > 0:
        overall = "critical"
    elif warning_count > 0:
        overall = "warning"

    return {
        "tenant_id": tenant_id,
        "overall_status": overall,
        "stats": {
            "total_checks": total_checks,
            "ok": ok_count,
            "warning": warning_count,
            "critical": critical_count,
        },
        "checks": [
            {
                "id": str(c.id),
                "type": c.check_type.value,
                "target": c.target,
                "status": c.last_status.value,
                "enabled": c.enabled,
                "interval_minutes": c.interval_minutes,
                "last_checked_at": c.last_checked_at.isoformat() if c.last_checked_at else None,
                "last_response_ms": c.last_response_ms,
                "consecutive_failures": c.consecutive_failures,
            }
            for c in checks
        ],
        "recent_alerts": [
            {
                "id": str(a.id),
                "severity": a.severity.value,
                "title": a.title,
                "message": a.message,
                "acknowledged": a.acknowledged,
                "resolved": a.resolved,
                "created_at": a.created_at.isoformat(),
                "occurrence_count": getattr(a, 'occurrence_count', 1) or 1,
                "last_seen_at": a.last_seen_at.isoformat() if getattr(a, 'last_seen_at', None) else None,
                "classification": a.classification.value if getattr(a, 'classification', None) else None,
                "priority_score": getattr(a, 'priority_score', None),
                "auto_fix_status": getattr(a, 'auto_fix_status', None),
                "resolved_by": getattr(a, 'resolved_by', None),
            }
            for a in alerts[:20]
        ],
    }


# ─── Checks CRUD ───

@router.get("/checks/{tenant_id}")
async def list_checks(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """List all monitoring checks for a tenant."""
    result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.tenant_id == uuid.UUID(tenant_id))
    )
    checks = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "type": c.check_type.value,
            "target": c.target,
            "status": c.last_status.value,
            "enabled": c.enabled,
            "interval_minutes": c.interval_minutes,
            "last_checked_at": c.last_checked_at.isoformat() if c.last_checked_at else None,
            "last_response_ms": c.last_response_ms,
            "consecutive_failures": c.consecutive_failures,
            "config": c.config,
        }
        for c in checks
    ]


@router.post("/checks", status_code=201)
async def create_check(body: CheckCreate, db: AsyncSession = Depends(get_db)):
    """Create a new monitoring check."""
    check = MonitorCheck(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(body.tenant_id),
        check_type=CheckType(body.check_type),
        target=body.target,
        interval_minutes=body.interval_minutes,
        config=body.config,
    )
    db.add(check)
    await db.flush()
    return {"id": str(check.id), "status": "created"}


@router.patch("/checks/{check_id}")
async def update_check(check_id: str, body: CheckUpdate, db: AsyncSession = Depends(get_db)):
    """Update a monitoring check."""
    check = await db.get(MonitorCheck, uuid.UUID(check_id))
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    if body.enabled is not None:
        check.enabled = body.enabled
    if body.interval_minutes is not None:
        check.interval_minutes = body.interval_minutes
    if body.config is not None:
        check.config = body.config
    if body.target is not None:
        check.target = body.target

    await db.flush()
    return {"status": "updated", "id": check_id}


@router.delete("/checks/{check_id}")
async def delete_check(check_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a monitoring check."""
    check = await db.get(MonitorCheck, uuid.UUID(check_id))
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    await db.delete(check)
    await db.flush()
    return {"status": "deleted"}


# ─── Run Checks ───

@router.post("/run/{tenant_id}")
async def run_tenant_checks(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger all checks for a tenant."""
    result = await db.execute(
        select(MonitorCheck).where(
            and_(MonitorCheck.tenant_id == uuid.UUID(tenant_id), MonitorCheck.enabled == True)
        )
    )
    checks = result.scalars().all()

    results = []
    for check in checks:
        try:
            r = await execute_check_and_store(db, check)
            results.append({
                "check_type": check.check_type.value,
                "target": check.target,
                "status": r.status.value,
                "response_ms": r.response_ms,
                "error": r.error,
                "details": r.details,
            })
        except Exception as e:
            results.append({
                "check_type": check.check_type.value,
                "target": check.target,
                "status": "error",
                "error": str(e),
            })

    return {"tenant_id": tenant_id, "checks_run": len(results), "results": results}


@router.post("/run-check/{check_id}")
async def run_single_check(check_id: str, db: AsyncSession = Depends(get_db)):
    """Run a single check immediately."""
    check = await db.get(MonitorCheck, uuid.UUID(check_id))
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    r = await execute_check_and_store(db, check)
    return {
        "check_type": check.check_type.value,
        "target": check.target,
        "status": r.status.value,
        "response_ms": r.response_ms,
        "error": r.error,
        "details": r.details,
    }


# ─── Results History ───

@router.get("/results/{check_id}")
async def get_check_results(check_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get historical results for a check."""
    result = await db.execute(
        select(MonitorResult)
        .where(MonitorResult.check_id == uuid.UUID(check_id))
        .order_by(MonitorResult.created_at.desc())
        .limit(limit)
    )
    results = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "status": r.status.value,
            "response_ms": r.response_ms,
            "details": r.details,
            "error": r.error,
            "created_at": r.created_at.isoformat(),
        }
        for r in results
    ]


# ─── Alerts ───

@router.get("/alerts/{tenant_id}")
async def list_alerts(tenant_id: str, resolved: bool = False, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """List alerts for a tenant."""
    query = select(Alert).where(
        and_(Alert.tenant_id == uuid.UUID(tenant_id), Alert.resolved == resolved)
    ).order_by(Alert.created_at.desc()).limit(limit)

    result = await db.execute(query)
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "check_id": str(a.check_id),
            "severity": a.severity.value,
            "title": a.title,
            "message": a.message,
            "acknowledged": a.acknowledged,
            "resolved": a.resolved,
            "created_at": a.created_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            "occurrence_count": getattr(a, 'occurrence_count', 1) or 1,
            "last_seen_at": a.last_seen_at.isoformat() if getattr(a, 'last_seen_at', None) else None,
            "classification": a.classification.value if getattr(a, 'classification', None) else None,
            "priority_score": getattr(a, 'priority_score', None),
            "auto_fix_status": getattr(a, 'auto_fix_status', None),
            "resolved_by": getattr(a, 'resolved_by', None),
        }
        for a in alerts
    ]


@router.get("/priority-inbox/{tenant_id}")
async def priority_inbox(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """AI-driven priority inbox: top actions, auto-resolved, suppressed."""
    tid = uuid.UUID(tenant_id)

    # Open alerts sorted by priority score
    open_result = await db.execute(
        select(Alert).where(and_(
            Alert.tenant_id == tid, Alert.resolved == False,
        )).order_by(Alert.priority_score.desc().nullslast(), Alert.created_at.desc())
    )
    open_alerts = open_result.scalars().all()

    # Recently auto-resolved (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    resolved_result = await db.execute(
        select(Alert).where(and_(
            Alert.tenant_id == tid, Alert.resolved == True,
            Alert.resolved_at >= week_ago,
        )).order_by(Alert.resolved_at.desc()).limit(20)
    )
    resolved_alerts = resolved_result.scalars().all()

    def _serialize(a):
        return {
            "id": str(a.id), "check_id": str(a.check_id),
            "severity": a.severity.value, "title": a.title, "message": a.message,
            "acknowledged": a.acknowledged, "resolved": a.resolved,
            "created_at": a.created_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            "occurrence_count": getattr(a, 'occurrence_count', 1) or 1,
            "last_seen_at": a.last_seen_at.isoformat() if getattr(a, 'last_seen_at', None) else None,
            "classification": a.classification.value if getattr(a, 'classification', None) else None,
            "priority_score": getattr(a, 'priority_score', None),
            "auto_fix_status": getattr(a, 'auto_fix_status', None),
            "resolved_by": getattr(a, 'resolved_by', None),
        }

    # Split open alerts into categories
    needs_attention = [a for a in open_alerts if getattr(a, 'classification', None) and a.classification.value == 'needs_attention']
    auto_fixable = [a for a in open_alerts if getattr(a, 'classification', None) and a.classification.value == 'auto_fixable']
    informational = [a for a in open_alerts if not getattr(a, 'classification', None) or a.classification.value == 'informational']
    auto_resolved = [a for a in resolved_alerts if getattr(a, 'resolved_by', None) == 'auto_recovery']

    return {
        "summary": {
            "total_open": len(open_alerts),
            "needs_attention": len(needs_attention),
            "auto_fixable": len(auto_fixable),
            "informational": len(informational),
            "auto_resolved_7d": len(auto_resolved),
        },
        "priority_actions": [_serialize(a) for a in needs_attention[:5]],
        "auto_fixable": [_serialize(a) for a in auto_fixable],
        "informational": [_serialize(a) for a in informational],
        "auto_resolved": [_serialize(a) for a in auto_resolved[:10]],
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    """Acknowledge an alert."""
    alert = await db.get(Alert, uuid.UUID(alert_id))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    await db.flush()
    return {"status": "acknowledged"}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    """Resolve an alert."""
    alert = await db.get(Alert, uuid.UUID(alert_id))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    return {"status": "resolved"}


# ─── Setup ───

@router.post("/setup/{tenant_id}")
async def setup_monitoring(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Setup default monitoring checks for a tenant based on their domain."""
    from app.helpers import get_tenant_safe
    tenant = await get_tenant_safe(db, tenant_id, require_domain=True)
    if not tenant.domain:
        raise HTTPException(status_code=400, detail="Tenant has no domain configured")

    await setup_default_checks(db, tenant.id, tenant.domain)
    return {"status": "monitoring configured", "domain": tenant.domain}


# ─── Widget Self-Detection ───

@router.get("/widget-check")
async def check_all_widgets_endpoint(
    db: AsyncSession = Depends(get_db),
):
    """Check widget installation status across ALL active tenants with domains."""
    from app.services.widget_detection import check_all_widgets
    return await check_all_widgets(db)


@router.get("/widget-check/{tenant_id}")
async def check_widget_for_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check widget installation for a single tenant."""
    from app.services.widget_detection import check_all_widgets
    return await check_all_widgets(db, tenant_ids=[tenant_id])
