"""
Cross-Site Intelligence API — AI-driven insights across sibling tenants.
"""
import uuid
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.services.cross_site_intelligence import generate_cross_site_insights

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/intelligence",
    tags=["admin-intelligence"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/cross-site/{client_account_id}")
async def get_cross_site_insights(client_account_id: str, db: AsyncSession = Depends(get_db)):
    """Generate AI-driven cross-site insights for a client account."""
    return await generate_cross_site_insights(db, uuid.UUID(client_account_id))
