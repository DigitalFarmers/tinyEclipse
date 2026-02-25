"""
Server Hardening Router — Security audits, resource monitoring, optimization.
"""
from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.services.hardening import run_security_audit, get_resource_overview, get_optimization_suggestions

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/hardening",
    tags=["hardening"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/audit")
async def security_audit(
    tenant_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Run automated security audit across the platform or for a specific tenant."""
    import uuid
    tid = uuid.UUID(tenant_id) if tenant_id else None
    result = await run_security_audit(db, tenant_id=tid)

    # Log to event bus
    try:
        from app.services.event_bus import emit
        await emit(
            db, domain="security", action="security_audit",
            title=f"Security audit: score {result['score']}/100 ({result['grade']})",
            severity="info" if result["score"] >= 70 else "warning",
            source="admin",
            data={"score": result["score"], "findings": len(result["findings"])},
        )
    except Exception:
        pass

    return result


@router.get("/resources")
async def resource_overview(db: AsyncSession = Depends(get_db)):
    """Get platform resource utilization overview."""
    return await get_resource_overview(db)


@router.get("/optimize")
async def optimization_suggestions(db: AsyncSession = Depends(get_db)):
    """Get optimization suggestions for the platform."""
    return {"suggestions": await get_optimization_suggestions(db)}
