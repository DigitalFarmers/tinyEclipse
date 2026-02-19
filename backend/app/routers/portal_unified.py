"""
Portal Unified API — Cross-project stats and events for multi-tenant clients.

Endpoints:
- GET /api/portal/unified/{whmcs_client_id} — Combined stats across all projects
- GET /api/portal/unified/{whmcs_client_id}/events — Cross-project events timeline
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client_account import ClientAccount
from app.models.tenant import Tenant, TenantStatus, TenantEnvironment
from app.models.site_module import SiteModule, ModuleStatus
from app.models.conversation import Conversation
from app.models.monitor import MonitorCheck, Alert
from app.models.visitor import VisitorSession
from app.models.source import Source
from app.models.module_event import ModuleEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/unified", tags=["portal-unified"])


@router.get("/{whmcs_client_id}")
async def get_unified_dashboard(
    whmcs_client_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Unified dashboard data across ALL production projects for a client.
    Combines stats, monitoring, modules, and recent activity.
    """
    # Get all production tenants for this client
    result = await db.execute(
        select(Tenant).where(and_(
            Tenant.whmcs_client_id == whmcs_client_id,
            Tenant.environment == TenantEnvironment.production,
        )).order_by(Tenant.created_at)
    )
    tenants = result.scalars().all()

    if not tenants:
        raise HTTPException(status_code=404, detail="Geen projecten gevonden")

    tenant_ids = [t.id for t in tenants]
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)

    # ── Global aggregated stats (parallel-safe with individual queries) ──

    total_chats_24h = await db.execute(
        select(func.count(Conversation.id))
        .where(and_(Conversation.tenant_id.in_(tenant_ids), Conversation.created_at >= since_24h))
    )
    total_chats_7d = await db.execute(
        select(func.count(Conversation.id))
        .where(and_(Conversation.tenant_id.in_(tenant_ids), Conversation.created_at >= since_7d))
    )
    total_visitors_24h = await db.execute(
        select(func.count(VisitorSession.id))
        .where(and_(VisitorSession.tenant_id.in_(tenant_ids), VisitorSession.created_at >= since_24h))
    )
    total_open_alerts = await db.execute(
        select(func.count(Alert.id))
        .where(and_(Alert.tenant_id.in_(tenant_ids), Alert.resolved == False))
    )
    total_sources = await db.execute(
        select(func.count(Source.id)).where(Source.tenant_id.in_(tenant_ids))
    )

    # Module events aggregated
    total_orders_24h = await db.execute(
        select(func.count(ModuleEvent.id))
        .where(and_(
            ModuleEvent.tenant_id.in_(tenant_ids),
            ModuleEvent.module_type == "shop",
            ModuleEvent.created_at >= since_24h,
        ))
    )
    total_forms_24h = await db.execute(
        select(func.count(ModuleEvent.id))
        .where(and_(
            ModuleEvent.tenant_id.in_(tenant_ids),
            ModuleEvent.module_type == "forms",
            ModuleEvent.created_at >= since_24h,
        ))
    )
    total_jobs_24h = await db.execute(
        select(func.count(ModuleEvent.id))
        .where(and_(
            ModuleEvent.tenant_id.in_(tenant_ids),
            ModuleEvent.module_type == "jobs",
            ModuleEvent.created_at >= since_24h,
        ))
    )

    # ── Per-project breakdown ──

    projects = []
    for t in tenants:
        chats = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id == t.id, Conversation.created_at >= since_24h))
        )
        alerts = await db.execute(
            select(func.count(Alert.id))
            .where(and_(Alert.tenant_id == t.id, Alert.resolved == False))
        )
        sources_count = await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )
        mods = await db.execute(
            select(SiteModule).where(and_(
                SiteModule.tenant_id == t.id,
                SiteModule.status == ModuleStatus.active,
            ))
        )
        # Monitoring status
        checks = await db.execute(
            select(MonitorCheck).where(MonitorCheck.tenant_id == t.id)
        )
        check_list = checks.scalars().all()
        monitoring_status = "healthy"
        if check_list:
            statuses = [c.status for c in check_list]
            if "critical" in statuses:
                monitoring_status = "critical"
            elif "warning" in statuses:
                monitoring_status = "warning"
        else:
            monitoring_status = "unconfigured"

        # Recent module events for this project
        recent_events = await db.execute(
            select(ModuleEvent)
            .where(and_(ModuleEvent.tenant_id == t.id, ModuleEvent.created_at >= since_24h))
            .order_by(desc(ModuleEvent.created_at))
            .limit(5)
        )

        projects.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "plan": t.plan.value,
            "status": t.status.value,
            "monitoring_status": monitoring_status,
            "stats": {
                "chats_24h": chats.scalar() or 0,
                "open_alerts": alerts.scalar() or 0,
                "knowledge_sources": sources_count.scalar() or 0,
            },
            "modules": [
                {"type": m.module_type.value, "name": m.name, "status": m.status.value}
                for m in mods.scalars().all()
            ],
            "recent_events": [
                {
                    "id": str(e.id),
                    "event_type": e.event_type.value,
                    "title": e.title,
                    "module_type": e.module_type,
                    "severity": e.severity,
                    "created_at": e.created_at.isoformat(),
                }
                for e in recent_events.scalars().all()
            ],
        })

    # Get client account info
    account = await db.execute(
        select(ClientAccount).where(ClientAccount.whmcs_client_id == whmcs_client_id)
    )
    client = account.scalar_one_or_none()

    return {
        "client": {
            "id": str(client.id) if client else None,
            "whmcs_client_id": whmcs_client_id,
            "name": client.name if client else tenants[0].name,
            "email": client.email if client else None,
            "company": client.company if client else None,
        },
        "totals": {
            "projects": len(projects),
            "chats_24h": total_chats_24h.scalar() or 0,
            "chats_7d": total_chats_7d.scalar() or 0,
            "visitors_24h": total_visitors_24h.scalar() or 0,
            "open_alerts": total_open_alerts.scalar() or 0,
            "knowledge_sources": total_sources.scalar() or 0,
            "orders_24h": total_orders_24h.scalar() or 0,
            "forms_24h": total_forms_24h.scalar() or 0,
            "jobs_24h": total_jobs_24h.scalar() or 0,
        },
        "projects": projects,
    }


@router.get("/{whmcs_client_id}/events")
async def get_unified_events(
    whmcs_client_id: int,
    hours: int = Query(24, ge=1, le=720),
    project: str | None = Query(None, description="Filter by tenant_id"),
    event_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-project events timeline — module events from ALL projects merged.
    Supports filtering by project and event type.
    """
    result = await db.execute(
        select(Tenant).where(and_(
            Tenant.whmcs_client_id == whmcs_client_id,
            Tenant.environment == TenantEnvironment.production,
        ))
    )
    tenants = result.scalars().all()
    if not tenants:
        raise HTTPException(status_code=404, detail="Geen projecten gevonden")

    tenant_ids = [t.id for t in tenants]
    tenant_map = {str(t.id): {"name": t.name, "domain": t.domain} for t in tenants}
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Build query
    query = select(ModuleEvent).where(and_(
        ModuleEvent.tenant_id.in_(tenant_ids),
        ModuleEvent.created_at >= since,
    ))

    if project:
        try:
            pid = uuid.UUID(project)
            query = query.where(ModuleEvent.tenant_id == pid)
        except ValueError:
            pass

    if event_type:
        query = query.where(ModuleEvent.event_type == event_type)

    query = query.order_by(desc(ModuleEvent.created_at)).limit(limit)
    events_result = await db.execute(query)
    events = events_result.scalars().all()

    # Summary counts by type
    summary_query = (
        select(ModuleEvent.event_type, func.count(ModuleEvent.id))
        .where(and_(
            ModuleEvent.tenant_id.in_(tenant_ids),
            ModuleEvent.created_at >= since,
        ))
        .group_by(ModuleEvent.event_type)
    )
    summary_result = await db.execute(summary_query)

    return {
        "period_hours": hours,
        "total": len(events),
        "summary": {row[0].value: row[1] for row in summary_result.all()},
        "projects": [{"tenant_id": str(t.id), "name": t.name, "domain": t.domain} for t in tenants],
        "events": [
            {
                "id": str(e.id),
                "tenant_id": str(e.tenant_id),
                "project_name": tenant_map.get(str(e.tenant_id), {}).get("name", ""),
                "project_domain": tenant_map.get(str(e.tenant_id), {}).get("domain", ""),
                "module_type": e.module_type,
                "event_type": e.event_type.value,
                "title": e.title,
                "description": e.description,
                "severity": e.severity,
                "data": e.data,
                "source_url": e.source_url,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }
