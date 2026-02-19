"""
WordPress Proxy — Forward requests from Eclipse Hub to WordPress REST API.

The Hub calls our backend, which proxies to the WordPress site's
tinyeclipse/v1/* endpoints. This avoids CORS issues and keeps
tenant auth centralized.
"""
import uuid
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/wp",
    tags=["admin-wp-proxy"],
    dependencies=[Depends(verify_admin_key)],
)

TIMEOUT = 15


async def _get_tenant(tenant_id: str, db: AsyncSession) -> Tenant:
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant or not tenant.domain:
        raise HTTPException(status_code=404, detail="Tenant not found or no domain")
    return tenant


async def _wp_get(tenant: Tenant, path: str, params: dict | None = None) -> dict:
    """Make a GET request to a WordPress site's tinyeclipse/v1 REST API."""
    url = f"https://{tenant.domain}/wp-json/tinyeclipse/v1{path}"
    headers = {"X-Tenant-Id": str(tenant.id)}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            r = await client.get(url, headers=headers, params=params or {})
            if r.status_code == 200:
                return r.json()
            logger.warning(f"[wp-proxy] {url} returned {r.status_code}")
            return {"error": True, "status": r.status_code, "detail": r.text[:200]}
    except Exception as e:
        logger.warning(f"[wp-proxy] Failed to reach {url}: {e}")
        return {"error": True, "detail": str(e)}


# ─── Capabilities ───

@router.get("/{tenant_id}/capabilities")
async def get_capabilities(tenant_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/capabilities")


# ─── WPML ───

@router.get("/{tenant_id}/wpml/languages")
async def get_wpml_languages(tenant_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/wpml/languages")


@router.get("/{tenant_id}/wpml/status")
async def get_wpml_status(tenant_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/wpml/status")


# ─── Fluent Forms ───

@router.get("/{tenant_id}/forms")
async def get_forms(tenant_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/forms")


@router.get("/{tenant_id}/forms/{form_id}/submissions")
async def get_form_submissions(
    tenant_id: str,
    form_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, f"/forms/{form_id}/submissions", {"limit": limit})


# ─── WooCommerce ───

@router.get("/{tenant_id}/shop/products")
async def get_products(
    tenant_id: str,
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/shop/products", {"limit": limit})


@router.get("/{tenant_id}/shop/orders")
async def get_orders(
    tenant_id: str,
    limit: int = Query(50, ge=1, le=200),
    status: str = Query("any"),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/shop/orders", {"limit": limit, "status": status})


@router.get("/{tenant_id}/shop/stats")
async def get_shop_stats(
    tenant_id: str,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/shop/stats", {"days": days})


# ─── Mail ───

@router.get("/{tenant_id}/mail/status")
async def get_mail_status(tenant_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/mail/status")
