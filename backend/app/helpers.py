"""
Shared helper functions for safe database queries.
All tenant lookups use noload("*") to prevent selectin relationships
from crashing when related tables don't exist on production.
"""
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.models.tenant import Tenant


async def get_tenant_safe(db: AsyncSession, tenant_id: str, *, require_active: bool = False, require_domain: bool = False) -> Tenant:
    """Safely fetch a Tenant without loading any relationships.
    
    Args:
        db: Database session
        tenant_id: UUID string of the tenant
        require_active: If True, raises 404 if tenant is not active
        require_domain: If True, raises 404 if tenant has no domain
    """
    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant_id")
    
    result = await db.execute(
        select(Tenant).where(Tenant.id == tid).options(noload("*"))
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if require_active and tenant.status.value != "active":
        raise HTTPException(status_code=404, detail="Tenant not active")
    
    if require_domain and not tenant.domain:
        raise HTTPException(status_code=404, detail="Tenant not found or no domain")
    
    return tenant
