"""
Calibration API — Geo enrichment, calibration scoring, and tenant context management.
"""
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant
from app.services.geo_enrichment import enrich_tenant_geo, _calculate_calibration_score

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/calibration",
    tags=["admin-calibration"],
    dependencies=[Depends(verify_admin_key)],
)


class GeoUpdateRequest(BaseModel):
    city: str | None = None
    country: str | None = None
    postcode: str | None = None
    address: str | None = None
    timezone: str | None = None
    business_type: str | None = None
    opening_hours: str | None = None


@router.post("/{tenant_id}/enrich")
async def enrich_geo(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Run full geo enrichment for a tenant — auto-learns location, timezone, neighborhood."""
    tid = uuid.UUID(tenant_id)
    result = await enrich_tenant_geo(db, tid)
    await db.commit()
    return result


@router.post("/{tenant_id}/geo")
async def update_geo(tenant_id: str, body: GeoUpdateRequest, db: AsyncSession = Depends(get_db)):
    """Manually set geo context for a tenant."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    geo = dict(tenant.geo_context) if tenant.geo_context else {}
    if body.city:
        geo["city"] = body.city
    if body.country:
        geo["country"] = body.country
    if body.postcode:
        geo["postcode"] = body.postcode
    if body.address:
        geo["address"] = body.address
    if body.timezone:
        geo["timezone"] = body.timezone
    if body.business_type:
        settings = dict(tenant.settings) if tenant.settings else {}
        settings["business_type"] = body.business_type
        tenant.settings = settings
    if body.opening_hours:
        settings = dict(tenant.settings) if tenant.settings else {}
        settings["opening_hours"] = body.opening_hours
        tenant.settings = settings

    tenant.geo_context = geo
    await db.flush()

    # Re-run enrichment with new data
    result = await enrich_tenant_geo(db, tid)
    await db.commit()
    return result


@router.get("/{tenant_id}")
async def get_calibration(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get calibration status and geo context for a tenant."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Recalculate score
    score = _calculate_calibration_score(tenant.geo_context or {}, tenant)

    geo = tenant.geo_context or {}
    return {
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "calibration_score": score,
        "last_calibrated_at": tenant.last_calibrated_at.isoformat() if tenant.last_calibrated_at else None,
        "geo_context": geo,
        "city": geo.get("city"),
        "country": geo.get("country"),
        "postcode": geo.get("postcode"),
        "timezone": geo.get("timezone"),
        "regional_context": geo.get("regional_context"),
        "neighborhood_description": geo.get("neighborhood_description"),
        "time_context": geo.get("time_context"),
        "knowledge_sources": len(tenant.sources) if tenant.sources else 0,
        "indexed_sources": len([s for s in (tenant.sources or []) if s.status == "indexed"]),
        "modules": len(tenant.modules) if tenant.modules else 0,
        "breakdown": {
            "location": bool(geo.get("city") and geo.get("country")),
            "timezone": bool(geo.get("timezone")),
            "regional_knowledge": bool(geo.get("regional_context")),
            "neighborhood": bool(geo.get("neighborhood_description")),
            "knowledge_base": len([s for s in (tenant.sources or []) if s.status == "indexed"]) >= 5,
            "modules_detected": len(tenant.modules or []) >= 1,
        },
    }


@router.get("/")
async def list_calibrations(db: AsyncSession = Depends(get_db)):
    """Get calibration overview for all tenants."""
    result = await db.execute(select(Tenant).order_by(desc(Tenant.calibration_score)))
    tenants = result.scalars().all()

    return [
        {
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "calibration_score": t.calibration_score or 0,
            "last_calibrated_at": t.last_calibrated_at.isoformat() if t.last_calibrated_at else None,
            "city": (t.geo_context or {}).get("city"),
            "country": (t.geo_context or {}).get("country"),
            "sources": len(t.sources) if t.sources else 0,
            "modules": len(t.modules) if t.modules else 0,
        }
        for t in tenants
    ]
