"""
Mail API — Email management endpoints for tenant domains.
Integrates with DirectAdmin to show mailbox overview, usage, and health.
Also allows adding mail as a SiteModule to a tenant.
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant
from app.models.site_module import SiteModule, ModuleType, ModuleStatus
from app.services.directadmin import get_domain_mail_summary, check_mail_health

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/mail", tags=["portal-mail"])


@router.get("/{tenant_id}")
async def get_tenant_mail(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get mail overview for a tenant's domain via DirectAdmin."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant or not tenant.domain:
        raise HTTPException(status_code=404, detail="Tenant not found or no domain set")

    summary = await get_domain_mail_summary(tenant.domain)

    # Update mail module stats if it exists
    result = await db.execute(
        select(SiteModule).where(and_(
            SiteModule.tenant_id == tid,
            SiteModule.module_type == ModuleType.mail,
        ))
    )
    mail_module = result.scalar_one_or_none()
    if mail_module:
        mail_module.stats = {
            "account_count": summary["account_count"],
            "forwarder_count": summary["forwarder_count"],
            "total_usage_mb": summary["total_usage_mb"],
        }
        mail_module.config = {
            "mailboxes": [a["email"] for a in summary["accounts"]],
            "domain": tenant.domain,
        }
        mail_module.last_checked_at = datetime.now(timezone.utc)
        await db.flush()

    return {
        "tenant_id": tenant_id,
        "domain": tenant.domain,
        "has_mail_module": mail_module is not None,
        **summary,
    }


@router.post("/{tenant_id}/activate")
async def activate_mail_module(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Activate mail module for a tenant — fetches mailboxes from DirectAdmin and creates SiteModule."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant or not tenant.domain:
        raise HTTPException(status_code=404, detail="Tenant not found or no domain set")

    # Check if already exists
    result = await db.execute(
        select(SiteModule).where(and_(
            SiteModule.tenant_id == tid,
            SiteModule.module_type == ModuleType.mail,
        ))
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Mail module already active")

    # Fetch mail data
    summary = await get_domain_mail_summary(tenant.domain)

    module = SiteModule(
        tenant_id=tid,
        module_type=ModuleType.mail,
        name="E-mail",
        status=ModuleStatus.active if summary["account_count"] > 0 else ModuleStatus.inactive,
        auto_detected=False,
        config={
            "mailboxes": [a["email"] for a in summary["accounts"]],
            "domain": tenant.domain,
        },
        stats={
            "account_count": summary["account_count"],
            "forwarder_count": summary["forwarder_count"],
            "total_usage_mb": summary["total_usage_mb"],
        },
        last_checked_at=datetime.now(timezone.utc),
    )
    db.add(module)
    await db.flush()

    return {
        "module_id": str(module.id),
        "status": module.status.value,
        "accounts": summary["account_count"],
        "mailboxes": [a["email"] for a in summary["accounts"]],
    }


@router.get("/{tenant_id}/health")
async def get_mail_health(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check mail health for a tenant's domain (MX records, SMTP)."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant or not tenant.domain:
        raise HTTPException(status_code=404, detail="Tenant not found or no domain set")

    health = await check_mail_health(tenant.domain)
    return {
        "tenant_id": tenant_id,
        "domain": tenant.domain,
        **health,
    }
