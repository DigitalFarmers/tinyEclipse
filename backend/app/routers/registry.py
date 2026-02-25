"""
Technical Registry Router — Event timeline, anomaly detection, system health.
The admin's window into everything that happens in TinyEclipse.
"""
from __future__ import annotations
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.event_bus import get_timeline, detect_anomalies, get_stats

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/registry", tags=["registry"])


@router.get("/timeline")
async def timeline(
    tenant_id: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    hours: int = Query(168, le=720),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get system event timeline with optional filters."""
    tid = uuid.UUID(tenant_id) if tenant_id else None
    return await get_timeline(db, tenant_id=tid, domain=domain, severity=severity, hours=hours, limit=limit)


@router.get("/anomalies")
async def anomalies(
    tenant_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Detect anomalies in recent system events."""
    tid = uuid.UUID(tenant_id) if tenant_id else None
    return {"anomalies": await detect_anomalies(db, tenant_id=tid)}


@router.get("/stats")
async def stats(
    tenant_id: Optional[str] = Query(None),
    hours: int = Query(24, le=720),
    db: AsyncSession = Depends(get_db),
):
    """Get event statistics for dashboard cards."""
    tid = uuid.UUID(tenant_id) if tenant_id else None
    return await get_stats(db, tenant_id=tid, hours=hours)
