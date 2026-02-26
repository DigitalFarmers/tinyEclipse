"""
Portal Projects API — Multi-project support for clients.
A client can have multiple sites/tenants. This API lets them:
- See all their projects in one overview
- Get unified stats across all projects
- Manage modules per project
- Switch between projects quickly
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
from app.models.client_account import ClientAccount
from app.models.tenant import Tenant, TenantStatus, TenantEnvironment
from app.models.site_module import SiteModule, ModuleType, ModuleStatus
from app.models.conversation import Conversation
from app.models.monitor import Alert
from app.models.visitor import VisitorSession
from app.models.source import Source
from app.services.module_detector import detect_modules

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/projects", tags=["portal-projects"])


# ─── List All Projects for a Client ───

@router.get("/by-client/{whmcs_client_id}")
async def get_client_projects(
    whmcs_client_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all projects/tenants for a WHMCS client. Used by portal for multi-project view.
    Filters out staging tenants — clients only see production."""
    result = await db.execute(
        select(Tenant).where(and_(
            Tenant.whmcs_client_id == whmcs_client_id,
            Tenant.environment == TenantEnvironment.production,
        )).order_by(Tenant.created_at)
    )
    tenants = result.scalars().all()

    if not tenants:
        raise HTTPException(status_code=404, detail="Geen projecten gevonden voor dit klantnummer.")

    projects = []
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    for t in tenants:
        # Quick stats per project
        chats = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id == t.id, Conversation.created_at >= since_24h))
        )
        alerts = await db.execute(
            select(func.count(Alert.id))
            .where(and_(Alert.tenant_id == t.id, Alert.resolved == False))
        )
        sources = await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )
        # Modules
        mods = await db.execute(
            select(SiteModule).where(and_(SiteModule.tenant_id == t.id, SiteModule.status == ModuleStatus.active))
        )

        projects.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "plan": t.plan.value,
            "status": t.status.value,
            "stats": {
                "chats_24h": chats.scalar() or 0,
                "open_alerts": alerts.scalar() or 0,
                "knowledge_sources": sources.scalar() or 0,
            },
            "modules": [
                {
                    "id": str(m.id),
                    "type": m.module_type.value,
                    "name": m.name,
                    "status": m.status.value,
                    "stats": m.stats,
                }
                for m in mods.scalars().all()
            ],
            "created_at": t.created_at.isoformat(),
        })

    # Get or create client account
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
        },
        "project_count": len(projects),
        "projects": projects,
    }


@router.get("/by-tenant/{tenant_id}")
async def get_sibling_projects(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all sibling projects for a tenant (same whmcs_client_id). Used by portal project switcher.
    Filters out staging tenants — clients only see production."""
    tenant = await get_tenant_safe(db, tenant_id)

    result = await db.execute(
        select(Tenant)
        .where(and_(
            Tenant.whmcs_client_id == tenant.whmcs_client_id,
            Tenant.status == TenantStatus.active,
            Tenant.environment == TenantEnvironment.production,
        ))
        .order_by(Tenant.created_at)
    )
    siblings = result.scalars().all()

    return {
        "current_tenant_id": tenant_id,
        "whmcs_client_id": tenant.whmcs_client_id,
        "projects": [
            {
                "tenant_id": str(t.id),
                "name": t.name,
                "domain": t.domain,
                "plan": t.plan.value,
                "is_current": str(t.id) == tenant_id,
            }
            for t in siblings
        ],
    }


# ─── Modules ───

@router.get("/{tenant_id}/modules")
async def get_tenant_modules(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all modules for a tenant."""
    tid = uuid.UUID(tenant_id)
    result = await db.execute(
        select(SiteModule).where(SiteModule.tenant_id == tid).order_by(SiteModule.module_type)
    )
    modules = result.scalars().all()

    return [
        {
            "id": str(m.id),
            "module_type": m.module_type.value,
            "name": m.name,
            "status": m.status.value,
            "auto_detected": m.auto_detected,
            "config": m.config,
            "stats": m.stats,
            "last_checked_at": m.last_checked_at.isoformat() if m.last_checked_at else None,
        }
        for m in modules
    ]


@router.post("/{tenant_id}/modules/detect")
async def detect_tenant_modules(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Auto-detect modules on a tenant's site by scanning the domain."""
    tid = uuid.UUID(tenant_id)
    tenant = await get_tenant_safe(db, tenant_id, require_domain=True)

    detected = await detect_modules(tenant.domain)

    created = []
    for d in detected:
        # Check if module already exists
        existing = await db.execute(
            select(SiteModule).where(and_(
                SiteModule.tenant_id == tid,
                SiteModule.module_type == ModuleType(d["module_type"]),
            ))
        )
        if existing.scalar_one_or_none():
            continue  # Already exists

        module = SiteModule(
            tenant_id=tid,
            module_type=ModuleType(d["module_type"]),
            name=d["name"],
            status=ModuleStatus.active,
            auto_detected=True,
            config={"found_paths": d.get("found_paths", []), "found_markers": d.get("found_markers", [])},
            stats={},
            last_checked_at=datetime.now(timezone.utc),
        )
        db.add(module)
        created.append({
            "module_type": d["module_type"],
            "name": d["name"],
            "confidence": d["confidence"],
        })

    await db.flush()

    return {
        "tenant_id": tenant_id,
        "domain": tenant.domain,
        "scanned": len(DETECTION_PATTERNS) if 'DETECTION_PATTERNS' in dir() else 7,
        "detected": len(detected),
        "new_modules_created": len(created),
        "modules": created,
        "all_detected": detected,
    }


class ModuleCreate(BaseModel):
    module_type: str
    name: str
    config: dict = {}


@router.post("/{tenant_id}/modules")
async def add_module(
    tenant_id: str,
    body: ModuleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Manually add a module to a tenant."""
    tid = uuid.UUID(tenant_id)
    tenant = await get_tenant_safe(db, tenant_id)

    module = SiteModule(
        tenant_id=tid,
        module_type=ModuleType(body.module_type),
        name=body.name,
        status=ModuleStatus.active,
        auto_detected=False,
        config=body.config,
        stats={},
    )
    db.add(module)
    await db.flush()

    return {
        "id": str(module.id),
        "module_type": module.module_type.value,
        "name": module.name,
        "status": module.status.value,
    }


# ─── Admin: Superview across ALL tenants ───

@router.get("/admin/superview")
async def admin_superview(
    db: AsyncSession = Depends(get_db),
):
    """
    Admin superview — zoom out across ALL clients and domains.
    Shows aggregated stats, module distribution, alerts, monitoring health,
    connector status, visitor data, and actionable intelligence per tenant.
    """
    from app.models.monitor import MonitorCheck, MonitorResult, CheckStatus
    from app.models.lead import Lead

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)

    # All tenants
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.created_at))
    all_tenants = tenants_result.scalars().all()

    # Global stats
    total_chats_24h = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.created_at >= since_24h)
    )
    total_chats_7d = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.created_at >= since_7d)
    )
    total_chats_30d = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.created_at >= since_30d)
    )
    total_visitors_24h = await db.execute(
        select(func.count(VisitorSession.id)).where(VisitorSession.created_at >= since_24h)
    )
    total_visitors_7d = await db.execute(
        select(func.count(VisitorSession.id)).where(VisitorSession.created_at >= since_7d)
    )
    open_alerts = await db.execute(
        select(func.count(Alert.id)).where(Alert.resolved == False)
    )
    resolved_alerts = await db.execute(
        select(func.count(Alert.id)).where(Alert.resolved == True)
    )
    total_sources = await db.execute(select(func.count(Source.id)))
    total_leads = await db.execute(
        select(func.count(Lead.id)).where(Lead.created_at >= since_30d)
    )
    escalated_convos = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(Conversation.status == "escalated", Conversation.created_at >= since_7d)
        )
    )

    # Module distribution
    module_counts = await db.execute(
        select(SiteModule.module_type, func.count(SiteModule.id))
        .where(SiteModule.status == ModuleStatus.active)
        .group_by(SiteModule.module_type)
    )

    # Global monitoring health
    all_checks_result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.enabled == True)
    )
    all_checks = all_checks_result.scalars().all()
    checks_ok = sum(1 for c in all_checks if c.last_status == CheckStatus.ok)
    checks_warn = sum(1 for c in all_checks if c.last_status == CheckStatus.warning)
    checks_crit = sum(1 for c in all_checks if c.last_status == CheckStatus.critical)
    checks_unknown = sum(1 for c in all_checks if c.last_status == CheckStatus.unknown)

    # Per-tenant summary with rich data
    tenant_summaries = []
    for t in all_tenants:
        chats_24h_count = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id == t.id, Conversation.created_at >= since_24h))
        )
        chats_7d_count = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id == t.id, Conversation.created_at >= since_7d))
        )
        visitors_24h_count = await db.execute(
            select(func.count(VisitorSession.id))
            .where(and_(VisitorSession.tenant_id == t.id, VisitorSession.created_at >= since_24h))
        )
        visitors_7d_count = await db.execute(
            select(func.count(VisitorSession.id))
            .where(and_(VisitorSession.tenant_id == t.id, VisitorSession.created_at >= since_7d))
        )
        alerts_open = await db.execute(
            select(func.count(Alert.id))
            .where(and_(Alert.tenant_id == t.id, Alert.resolved == False))
        )
        alerts_critical = await db.execute(
            select(func.count(Alert.id))
            .where(and_(Alert.tenant_id == t.id, Alert.resolved == False, Alert.severity == "critical"))
        )
        mods = await db.execute(
            select(SiteModule).where(and_(SiteModule.tenant_id == t.id, SiteModule.status == ModuleStatus.active))
        )
        sources_count = await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )
        leads_count = await db.execute(
            select(func.count(Lead.id)).where(
                and_(Lead.tenant_id == t.id, Lead.created_at >= since_30d)
            )
        )
        escalated_count = await db.execute(
            select(func.count(Conversation.id)).where(
                and_(Conversation.tenant_id == t.id, Conversation.status == "escalated", Conversation.created_at >= since_7d)
            )
        )

        # Monitoring health per tenant
        tenant_checks = await db.execute(
            select(MonitorCheck).where(and_(MonitorCheck.tenant_id == t.id, MonitorCheck.enabled == True))
        )
        t_checks = tenant_checks.scalars().all()
        t_ok = sum(1 for c in t_checks if c.last_status == CheckStatus.ok)
        t_warn = sum(1 for c in t_checks if c.last_status == CheckStatus.warning)
        t_crit = sum(1 for c in t_checks if c.last_status == CheckStatus.critical)
        t_unknown = sum(1 for c in t_checks if c.last_status == CheckStatus.unknown)

        # Determine overall health
        if t_crit > 0:
            health = "critical"
        elif t_warn > 0:
            health = "warning"
        elif t_ok > 0:
            health = "healthy"
        else:
            health = "unknown"

        # Build check details for drill-down
        check_details = []
        for c in t_checks:
            check_details.append({
                "id": str(c.id),
                "type": c.check_type.value,
                "target": c.target,
                "status": c.last_status.value,
                "response_ms": c.last_response_ms,
                "last_checked": c.last_checked_at.isoformat() if c.last_checked_at else None,
                "failures": c.consecutive_failures,
            })

        # Recent critical alerts for this tenant
        recent_alerts_result = await db.execute(
            select(Alert)
            .where(and_(Alert.tenant_id == t.id, Alert.resolved == False))
            .order_by(desc(Alert.created_at))
            .limit(5)
        )
        recent_alerts = [
            {
                "id": str(a.id),
                "severity": a.severity.value,
                "title": a.title,
                "message": a.message[:200],
                "created_at": a.created_at.isoformat(),
            }
            for a in recent_alerts_result.scalars().all()
        ]

        tenant_summaries.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "plan": t.plan.value,
            "status": t.status.value,
            "environment": t.environment.value if hasattr(t, 'environment') and t.environment else "production",
            "whmcs_client_id": t.whmcs_client_id,
            "chats_24h": chats_24h_count.scalar() or 0,
            "chats_7d": chats_7d_count.scalar() or 0,
            "visitors_24h": visitors_24h_count.scalar() or 0,
            "visitors_7d": visitors_7d_count.scalar() or 0,
            "open_alerts": alerts_open.scalar() or 0,
            "critical_alerts": alerts_critical.scalar() or 0,
            "escalations_7d": escalated_count.scalar() or 0,
            "leads_30d": leads_count.scalar() or 0,
            "sources": sources_count.scalar() or 0,
            "modules": [m.module_type.value for m in mods.scalars().all()],
            "health": health,
            "monitoring": {
                "total": len(t_checks),
                "ok": t_ok,
                "warning": t_warn,
                "critical": t_crit,
                "unknown": t_unknown,
                "checks": check_details,
            },
            "recent_alerts": recent_alerts,
        })

    return {
        "total_tenants": len(all_tenants),
        "total_active": sum(1 for t in all_tenants if t.status.value == "active"),
        "global_stats": {
            "conversations_24h": total_chats_24h.scalar() or 0,
            "conversations_7d": total_chats_7d.scalar() or 0,
            "conversations_30d": total_chats_30d.scalar() or 0,
            "visitors_24h": total_visitors_24h.scalar() or 0,
            "visitors_7d": total_visitors_7d.scalar() or 0,
            "open_alerts": open_alerts.scalar() or 0,
            "resolved_alerts": resolved_alerts.scalar() or 0,
            "total_sources": total_sources.scalar() or 0,
            "total_leads_30d": total_leads.scalar() or 0,
            "escalations_7d": escalated_convos.scalar() or 0,
        },
        "monitoring_health": {
            "total_checks": len(all_checks),
            "ok": checks_ok,
            "warning": checks_warn,
            "critical": checks_crit,
            "unknown": checks_unknown,
        },
        "module_distribution": {row[0].value: row[1] for row in module_counts.all()},
        "tenants": tenant_summaries,
    }
