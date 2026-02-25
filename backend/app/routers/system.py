"""
System API — Platform health, audit logs, bulk operations, diagnostics.
The ops layer that keeps Eclipse itself healthy.
"""
import uuid
import os
import platform
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, TenantStatus, PlanType
from app.models.monitor import MonitorCheck, MonitorResult, Alert, CheckStatus
from app.models.visitor import VisitorSession, PageView, VisitorEvent
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.usage_log import UsageLog
from app.models.source import Source
from app.models.embedding import Embedding
from app.models.consent import Consent

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/system",
    tags=["admin-system"],
    dependencies=[Depends(verify_admin_key)],
)


# ─── Platform Health ───

@router.get("/health/")
async def platform_health(db: AsyncSession = Depends(get_db)):
    """Full platform health check — database, services, storage, everything."""
    now = datetime.now(timezone.utc)

    # Database connectivity + stats
    db_healthy = True
    db_stats = {}
    try:
        # Table counts
        for model, name in [
            (Tenant, "tenants"),
            (Conversation, "conversations"),
            (Message, "messages"),
            (Source, "sources"),
            (Embedding, "embeddings"),
            (MonitorCheck, "monitor_checks"),
            (MonitorResult, "monitor_results"),
            (Alert, "alerts"),
            (VisitorSession, "visitor_sessions"),
            (PageView, "page_views"),
            (VisitorEvent, "visitor_events"),
            (UsageLog, "usage_logs"),
            (Consent, "consents"),
        ]:
            result = await db.execute(select(func.count()).select_from(model))
            db_stats[name] = result.scalar()
    except Exception as e:
        db_healthy = False
        db_stats["error"] = str(e)

    # Scheduler status
    scheduler_running = False
    try:
        from app.services.scheduler import _scheduler_task
        scheduler_running = _scheduler_task is not None
    except Exception:
        pass

    # System info
    memory_info = {"rss_mb": None, "vms_mb": None}
    try:
        import psutil
        process = psutil.Process(os.getpid())
        mem = process.memory_info()
        memory_info = {
            "rss_mb": round(mem.rss / 1024 / 1024, 1),
            "vms_mb": round(mem.vms / 1024 / 1024, 1),
        }
    except ImportError:
        pass

    return {
        "status": "healthy" if db_healthy else "degraded",
        "timestamp": now.isoformat(),
        "uptime_info": {
            "pid": os.getpid(),
            "platform": platform.platform(),
            "python_version": platform.python_version(),
        },
        "memory": memory_info,
        "database": {
            "healthy": db_healthy,
            "table_counts": db_stats,
            "total_records": sum(v for v in db_stats.values() if isinstance(v, int)),
        },
        "scheduler": {
            "running": scheduler_running,
        },
        "api_version": "1.0.0",
    }


# ─── Database Stats ───

@router.get("/db-stats/")
async def database_stats(db: AsyncSession = Depends(get_db)):
    """Detailed database statistics — sizes, growth, performance."""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    stats = {}

    # Growth metrics
    for model, name, date_col in [
        (Conversation, "conversations", Conversation.created_at),
        (VisitorSession, "sessions", VisitorSession.created_at),
        (PageView, "pageviews", PageView.created_at),
        (VisitorEvent, "events", VisitorEvent.created_at),
        (MonitorResult, "monitor_results", MonitorResult.created_at),
        (Alert, "alerts", Alert.created_at),
    ]:
        total = await db.execute(select(func.count()).select_from(model))
        today_count = await db.execute(
            select(func.count()).select_from(model).where(date_col >= today)
        )
        week_count = await db.execute(
            select(func.count()).select_from(model).where(date_col >= week_ago)
        )
        month_count = await db.execute(
            select(func.count()).select_from(model).where(date_col >= month_ago)
        )

        stats[name] = {
            "total": total.scalar(),
            "today": today_count.scalar(),
            "week": week_count.scalar(),
            "month": month_count.scalar(),
        }

    return {
        "timestamp": now.isoformat(),
        "tables": stats,
    }


# ─── Bulk Operations ───

class BulkPlanUpdate(BaseModel):
    tenant_ids: List[str]
    plan: str


@router.post("/bulk/update-plan/")
async def bulk_update_plan(body: BulkPlanUpdate, db: AsyncSession = Depends(get_db)):
    """Bulk update plan for multiple tenants."""
    updated = []
    errors = []

    for tid in body.tenant_ids:
        try:
            tenant = await db.get(Tenant, uuid.UUID(tid))
            if not tenant:
                errors.append({"tenant_id": tid, "error": "not found"})
                continue
            tenant.plan = PlanType(body.plan)
            updated.append(tid)
        except Exception as e:
            errors.append({"tenant_id": tid, "error": str(e)})

    await db.flush()
    return {"updated": len(updated), "errors": len(errors), "details": {"updated": updated, "errors": errors}}


@router.post("/bulk/run-monitoring/")
async def bulk_run_monitoring(db: AsyncSession = Depends(get_db)):
    """Trigger monitoring checks for ALL tenants immediately."""
    from app.services.monitor import execute_check_and_store

    checks_result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.enabled == True)
    )
    checks = checks_result.scalars().all()

    results = {"total": len(checks), "ok": 0, "warning": 0, "critical": 0, "error": 0}
    for check in checks:
        try:
            r = await execute_check_and_store(db, check)
            results[r.status.value] = results.get(r.status.value, 0) + 1
        except Exception:
            results["error"] += 1

    return results


@router.post("/bulk/rescrape/")
async def bulk_rescrape(
    tenant_ids: Optional[List[str]] = None,
    db: AsyncSession = Depends(get_db),
):
    """Re-scrape knowledge base for specified tenants (or all if none specified)."""
    from fastapi import BackgroundTasks

    if tenant_ids:
        tenants_result = await db.execute(
            select(Tenant).where(Tenant.id.in_([uuid.UUID(t) for t in tenant_ids]))
        )
    else:
        tenants_result = await db.execute(
            select(Tenant).where(Tenant.status == TenantStatus.active)
        )
    tenants = tenants_result.scalars().all()

    queued = []
    for tenant in tenants:
        if tenant.domain:
            queued.append({"tenant_id": str(tenant.id), "domain": tenant.domain})

    return {
        "message": f"Re-scrape queued for {len(queued)} tenants. Use individual scrape endpoints to trigger.",
        "tenants": queued,
    }


# ─── Audit Log ───

_audit_log: List[Dict] = []


def log_audit(action: str, actor: str, target: str, details: Optional[Dict] = None):
    """Add an entry to the audit log. Called internally."""
    _audit_log.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "actor": actor,
        "target": target,
        "details": details or {},
    })
    if len(_audit_log) > 1000:
        _audit_log[:] = _audit_log[-500:]


@router.get("/audit-log/")
async def get_audit_log(limit: int = 100):
    """Get recent audit log entries."""
    return {
        "total": len(_audit_log),
        "entries": _audit_log[-limit:][::-1],
    }


# ─── Tenant Stats (detailed per-tenant) ───

@router.get("/tenant-stats/{tenant_id}")
async def tenant_stats(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Comprehensive stats for a single tenant — everything in one call."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Conversations
    convs_total = await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.tenant_id == tid)
    )
    convs_month = await db.execute(
        select(func.count()).select_from(Conversation).where(
            and_(Conversation.tenant_id == tid, Conversation.created_at >= month_ago)
        )
    )

    # Messages
    msgs_total = await db.execute(
        select(func.count()).select_from(Message).where(Message.tenant_id == tid)
    )

    # Sources & embeddings
    sources_count = await db.execute(
        select(func.count()).select_from(Source).where(Source.tenant_id == tid)
    )
    embeddings_count = await db.execute(
        select(func.count()).select_from(Embedding).where(Embedding.tenant_id == tid)
    )

    # Monitoring
    checks_count = await db.execute(
        select(func.count()).select_from(MonitorCheck).where(MonitorCheck.tenant_id == tid)
    )
    active_alerts = await db.execute(
        select(func.count()).select_from(Alert).where(
            and_(Alert.tenant_id == tid, Alert.resolved == False)
        )
    )

    # Visitors
    sessions_total = await db.execute(
        select(func.count()).select_from(VisitorSession).where(VisitorSession.tenant_id == tid)
    )
    sessions_month = await db.execute(
        select(func.count()).select_from(VisitorSession).where(
            and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= month_ago)
        )
    )
    pageviews_month = await db.execute(
        select(func.count()).select_from(PageView).where(
            and_(PageView.tenant_id == tid, PageView.created_at >= month_ago)
        )
    )

    # Token usage
    usage_result = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
            func.count(UsageLog.id),
        ).where(UsageLog.tenant_id == tid)
    )
    tokens_in, tokens_out, total_requests = usage_result.one()

    usage_month = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
        ).where(and_(UsageLog.tenant_id == tid, UsageLog.created_at >= month_ago))
    )
    tokens_in_month, tokens_out_month = usage_month.one()

    return {
        "tenant_id": tenant_id,
        "name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value,
        "status": tenant.status.value,
        "created_at": tenant.created_at.isoformat(),
        "ai": {
            "conversations_total": convs_total.scalar(),
            "conversations_month": convs_month.scalar(),
            "messages_total": msgs_total.scalar(),
            "sources": sources_count.scalar(),
            "embeddings": embeddings_count.scalar(),
        },
        "monitoring": {
            "checks": checks_count.scalar(),
            "active_alerts": active_alerts.scalar(),
        },
        "analytics": {
            "sessions_total": sessions_total.scalar(),
            "sessions_month": sessions_month.scalar(),
            "pageviews_month": pageviews_month.scalar(),
        },
        "usage": {
            "tokens_in_total": tokens_in,
            "tokens_out_total": tokens_out,
            "tokens_in_month": tokens_in_month,
            "tokens_out_month": tokens_out_month,
            "requests_total": total_requests,
        },
    }
