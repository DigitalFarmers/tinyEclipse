"""
Portfolio API — Agency-level multi-domain intelligence.
One layer above all sites. Deeper than DirectAdmin.
"""
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.services.portfolio import (
    get_agency_overview,
    get_client_portfolio,
    get_domain_comparison,
    get_unified_timeline,
)

router = APIRouter(
    prefix="/api/admin/portfolio",
    tags=["portfolio"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/overview")
async def agency_overview(db: AsyncSession = Depends(get_db)):
    """Bird's-eye view of ALL clients and ALL domains."""
    return await get_agency_overview(db)


@router.get("/client/{client_account_id}")
async def client_portfolio(
    client_account_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Deep portfolio view for one client — all domains with stats."""
    return await get_client_portfolio(db, uuid.UUID(client_account_id))


@router.get("/compare/{client_account_id}")
async def domain_comparison(
    client_account_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Side-by-side domain comparison matrix."""
    return await get_domain_comparison(db, uuid.UUID(client_account_id))


@router.get("/timeline/{client_account_id}")
async def unified_timeline(
    client_account_id: str,
    hours: int = Query(168, ge=1, le=720),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Unified event timeline across all client domains."""
    return await get_unified_timeline(db, uuid.UUID(client_account_id), hours, limit)
