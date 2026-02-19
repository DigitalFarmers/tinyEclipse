"""
Client Profiles API — Admin helicopter view over client accounts.

Endpoints:
- GET /api/admin/clients/ — List all client accounts with aggregated stats
- GET /api/admin/clients/{whmcs_client_id} — Full client profile with all projects + WHMCS data
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.client_account import ClientAccount
from app.models.tenant import Tenant, TenantEnvironment
from app.models.site_module import SiteModule, ModuleStatus
from app.models.conversation import Conversation
from app.models.monitor import Alert
from app.models.source import Source
from app.models.module_event import ModuleEvent

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/clients",
    tags=["admin-clients"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/")
async def list_client_accounts(
    db: AsyncSession = Depends(get_db),
):
    """
    List all client accounts with their tenants and aggregated stats.
    Grouped view for admin helicopter dashboard.
    """
    result = await db.execute(
        select(ClientAccount).order_by(ClientAccount.created_at)
    )
    accounts = result.scalars().all()

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    output = []

    for a in accounts:
        # Get all tenants for this account
        tenants_result = await db.execute(
            select(Tenant).where(Tenant.client_account_id == a.id).order_by(Tenant.created_at)
        )
        tenants = tenants_result.scalars().all()
        tenant_ids = [t.id for t in tenants]
        prod_tenants = [t for t in tenants if (t.environment or TenantEnvironment.production) == TenantEnvironment.production]

        if not tenant_ids:
            output.append({
                "id": str(a.id),
                "whmcs_client_id": a.whmcs_client_id,
                "name": a.name,
                "email": a.email,
                "company": a.company,
                "project_count": 0,
                "production_count": 0,
                "staging_count": 0,
                "stats": {"chats_24h": 0, "open_alerts": 0, "total_sources": 0, "module_events_24h": 0},
                "plans": [],
                "tenants": [],
            })
            continue

        # Aggregated stats
        chats = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id.in_(tenant_ids), Conversation.created_at >= since_24h))
        )
        alerts = await db.execute(
            select(func.count(Alert.id))
            .where(and_(Alert.tenant_id.in_(tenant_ids), Alert.resolved == False))
        )
        sources = await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id.in_(tenant_ids))
        )
        mod_events = await db.execute(
            select(func.count(ModuleEvent.id))
            .where(and_(ModuleEvent.tenant_id.in_(tenant_ids), ModuleEvent.created_at >= since_24h))
        )

        output.append({
            "id": str(a.id),
            "whmcs_client_id": a.whmcs_client_id,
            "name": a.name,
            "email": a.email,
            "company": a.company,
            "project_count": len(tenants),
            "production_count": len(prod_tenants),
            "staging_count": len(tenants) - len(prod_tenants),
            "stats": {
                "chats_24h": chats.scalar() or 0,
                "open_alerts": alerts.scalar() or 0,
                "total_sources": sources.scalar() or 0,
                "module_events_24h": mod_events.scalar() or 0,
            },
            "plans": list(set(t.plan.value for t in tenants)),
            "tenants": [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "domain": t.domain,
                    "plan": t.plan.value,
                    "status": t.status.value,
                    "environment": t.environment.value if hasattr(t, 'environment') and t.environment else "production",
                }
                for t in tenants
            ],
        })

    return output


@router.get("/{whmcs_client_id}")
async def get_client_profile(
    whmcs_client_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Full client profile — all Eclipse data + ready for WHMCS enrichment.
    Shows all projects (including staging), modules, stats, recent events.
    """
    account_result = await db.execute(
        select(ClientAccount).where(ClientAccount.whmcs_client_id == whmcs_client_id)
    )
    account = account_result.scalar_one_or_none()

    # Get all tenants (including staging for admin view)
    tenants_result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id == whmcs_client_id).order_by(Tenant.created_at)
    )
    tenants = tenants_result.scalars().all()

    if not tenants and not account:
        raise HTTPException(status_code=404, detail="Client niet gevonden")

    tenant_ids = [t.id for t in tenants]
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)

    # Aggregated stats
    chats_24h = await db.execute(
        select(func.count(Conversation.id))
        .where(and_(Conversation.tenant_id.in_(tenant_ids), Conversation.created_at >= since_24h))
    ) if tenant_ids else None
    chats_7d = await db.execute(
        select(func.count(Conversation.id))
        .where(and_(Conversation.tenant_id.in_(tenant_ids), Conversation.created_at >= since_7d))
    ) if tenant_ids else None
    alerts = await db.execute(
        select(func.count(Alert.id))
        .where(and_(Alert.tenant_id.in_(tenant_ids), Alert.resolved == False))
    ) if tenant_ids else None
    sources = await db.execute(
        select(func.count(Source.id)).where(Source.tenant_id.in_(tenant_ids))
    ) if tenant_ids else None

    # Per-tenant details
    projects = []
    for t in tenants:
        mods = await db.execute(
            select(SiteModule).where(and_(
                SiteModule.tenant_id == t.id,
                SiteModule.status == ModuleStatus.active,
            ))
        )
        t_chats = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id == t.id, Conversation.created_at >= since_24h))
        )
        t_alerts = await db.execute(
            select(func.count(Alert.id))
            .where(and_(Alert.tenant_id == t.id, Alert.resolved == False))
        )
        t_sources = await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )

        projects.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "plan": t.plan.value,
            "status": t.status.value,
            "environment": t.environment.value if hasattr(t, 'environment') and t.environment else "production",
            "created_at": t.created_at.isoformat(),
            "stats": {
                "chats_24h": t_chats.scalar() or 0,
                "open_alerts": t_alerts.scalar() or 0,
                "sources": t_sources.scalar() or 0,
            },
            "modules": [
                {"type": m.module_type.value, "name": m.name}
                for m in mods.scalars().all()
            ],
        })

    # Recent module events across all projects
    recent_events = []
    if tenant_ids:
        events_result = await db.execute(
            select(ModuleEvent)
            .where(and_(ModuleEvent.tenant_id.in_(tenant_ids), ModuleEvent.created_at >= since_7d))
            .order_by(ModuleEvent.created_at.desc())
            .limit(20)
        )
        tenant_name_map = {t.id: t.name for t in tenants}
        for e in events_result.scalars().all():
            recent_events.append({
                "id": str(e.id),
                "project_name": tenant_name_map.get(e.tenant_id, ""),
                "module_type": e.module_type,
                "event_type": e.event_type.value,
                "title": e.title,
                "severity": e.severity,
                "created_at": e.created_at.isoformat(),
            })

    return {
        "account": {
            "id": str(account.id) if account else None,
            "whmcs_client_id": whmcs_client_id,
            "name": account.name if account else (tenants[0].name if tenants else "Unknown"),
            "email": account.email if account else None,
            "company": account.company if account else None,
            "created_at": account.created_at.isoformat() if account else None,
        },
        "totals": {
            "projects": len(projects),
            "production": sum(1 for p in projects if p["environment"] == "production"),
            "staging": sum(1 for p in projects if p["environment"] == "staging"),
            "chats_24h": chats_24h.scalar() or 0 if chats_24h else 0,
            "chats_7d": chats_7d.scalar() or 0 if chats_7d else 0,
            "open_alerts": alerts.scalar() or 0 if alerts else 0,
            "total_sources": sources.scalar() or 0 if sources else 0,
        },
        "projects": projects,
        "recent_events": recent_events,
    }
