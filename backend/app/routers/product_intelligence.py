"""
Product Intelligence API — Analyze product completeness, ingredients, allergens.
Provides both admin and portal endpoints.
"""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant
from app.services.product_intelligence import analyze_products

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/product-intelligence",
    tags=["admin-product-intelligence"],
    dependencies=[Depends(verify_admin_key)],
)


async def _get_tenant(tenant_id: str, db: AsyncSession) -> Tenant:
    return await get_tenant_safe(db, tenant_id, require_domain=True)


@router.get("/{tenant_id}")
async def get_product_intelligence(
    tenant_id: str,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Full product intelligence analysis for a tenant."""
    tenant = await _get_tenant(tenant_id, db)
    result = await analyze_products(tenant.domain, str(tenant.id), limit=limit)
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result.get("detail", "Failed to fetch products"))
    return result


@router.get("/{tenant_id}/summary")
async def get_product_summary(
    tenant_id: str,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Summary only — no individual product data."""
    tenant = await _get_tenant(tenant_id, db)
    result = await analyze_products(tenant.domain, str(tenant.id), limit=limit)
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result.get("detail", "Failed to fetch products"))
    return {"summary": result["summary"]}


@router.get("/{tenant_id}/missing-ingredients")
async def get_missing_ingredients(
    tenant_id: str,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Products that are missing ingredient information."""
    tenant = await _get_tenant(tenant_id, db)
    result = await analyze_products(tenant.domain, str(tenant.id), limit=limit)
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result.get("detail", "Failed to fetch products"))
    missing = [p for p in result["products"] if not p["has_ingredients"]]
    return {
        "total_products": result["summary"]["total_products"],
        "missing_count": len(missing),
        "products": missing,
    }


@router.get("/{tenant_id}/allergens")
async def get_allergens_overview(
    tenant_id: str,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Allergen tracking across all products."""
    tenant = await _get_tenant(tenant_id, db)
    result = await analyze_products(tenant.domain, str(tenant.id), limit=limit)
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result.get("detail", "Failed to fetch products"))

    # Build per-product allergen map
    allergen_products = {}
    for p in result["products"]:
        for a in p.get("allergens_found", []):
            if a not in allergen_products:
                allergen_products[a] = []
            allergen_products[a].append({"id": p["id"], "name": p["name"]})

    return {
        "allergens_overview": result["summary"].get("allergens_overview", {}),
        "allergen_products": allergen_products,
        "total_products": result["summary"]["total_products"],
        "products_with_allergens": result["summary"]["with_allergens"],
    }
