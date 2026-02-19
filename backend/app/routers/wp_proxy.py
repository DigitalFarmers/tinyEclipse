"""
WordPress Proxy — Forward requests from Eclipse Hub to WordPress REST API.

The Hub calls our backend, which proxies to the WordPress site's
tinyeclipse/v1/* endpoints. This avoids CORS issues and keeps
tenant auth centralized.
"""
import uuid
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant
from app.services.wp_sync import process_full_sync

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


# ─── POST helper ───

async def _wp_post(tenant: Tenant, path: str, data: dict | None = None) -> dict:
    """Make a POST request to a WordPress site's tinyeclipse/v1 REST API."""
    url = f"https://{tenant.domain}/wp-json/tinyeclipse/v1{path}"
    headers = {"X-Tenant-Id": str(tenant.id), "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            r = await client.post(url, headers=headers, json=data or {})
            if r.status_code == 200:
                return r.json()
            logger.warning(f"[wp-proxy] POST {url} returned {r.status_code}")
            return {"error": True, "status": r.status_code, "detail": r.text[:200]}
    except Exception as e:
        logger.warning(f"[wp-proxy] Failed to POST {url}: {e}")
        return {"error": True, "detail": str(e)}


# ═══════════════════════════════════════════════════════════════
# SYNC — Receive full data dump from connector v4
# ═══════════════════════════════════════════════════════════════

@router.post("/{tenant_id}/sync")
async def receive_full_sync(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Receive full sync data from connector v4 and process into contacts."""
    tenant = await _get_tenant(tenant_id, db)
    data = await request.json()
    stats = await process_full_sync(db, tenant.id, data)
    await db.commit()
    return {"status": "synced", "tenant": tenant.name, **stats}


@router.post("/{tenant_id}/sync/trigger")
async def trigger_full_sync(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger the connector on the WordPress site to do a full sync."""
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_post(tenant, "/sync/full")


# ═══════════════════════════════════════════════════════════════
# WRITE — Proxy write operations to WordPress
# ═══════════════════════════════════════════════════════════════

@router.post("/{tenant_id}/pages/{page_id}")
async def update_page(tenant_id: str, page_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Update a page/post on the WordPress site."""
    tenant = await _get_tenant(tenant_id, db)
    data = await request.json()
    return await _wp_post(tenant, f"/pages/{page_id}", data)


@router.post("/{tenant_id}/products/{product_id}")
async def update_product(tenant_id: str, product_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Update a WooCommerce product on the WordPress site."""
    tenant = await _get_tenant(tenant_id, db)
    data = await request.json()
    return await _wp_post(tenant, f"/products/{product_id}", data)


@router.post("/{tenant_id}/orders/{order_id}/status")
async def update_order_status(tenant_id: str, order_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Update an order status on the WordPress site."""
    tenant = await _get_tenant(tenant_id, db)
    data = await request.json()
    return await _wp_post(tenant, f"/orders/{order_id}/status", data)


@router.post("/{tenant_id}/options")
async def update_options(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Update site options on the WordPress site."""
    tenant = await _get_tenant(tenant_id, db)
    data = await request.json()
    return await _wp_post(tenant, "/options", data)


# ─── Content (read all pages/posts) ───

@router.get("/{tenant_id}/content")
async def get_content(
    tenant_id: str,
    type: str = Query("page"),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get all pages/posts from the WordPress site for content management."""
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_get(tenant, "/content", {"type": type, "limit": limit})
