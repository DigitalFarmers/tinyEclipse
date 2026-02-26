"""
WordPress Proxy — Forward requests from Eclipse Hub to WordPress REST API.

The Hub calls our backend, which proxies to the WordPress site's
tinyeclipse/v1/* endpoints. This avoids CORS issues and keeps
tenant auth centralized.
"""
import uuid
import logging
from typing import Optional, Dict, List, Union

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
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
    return await get_tenant_safe(db, tenant_id, require_domain=True)


async def _wp_get(tenant: Tenant, path: str, params: Optional[Dict] = None) -> Dict:
    """Try eclipse-ai/v1 first, then tinyeclipse/v1 fallback."""
    headers = {"X-Tenant-Id": str(tenant.id)}
    namespaces = ["eclipse-ai/v1", "tinyeclipse/v1"]
    for ns in namespaces:
        url = f"https://{tenant.domain}/wp-json/{ns}{path}"
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
                r = await client.get(url, headers=headers, params=params or {})
                if r.status_code == 200:
                    return r.json()
                if r.status_code != 404:
                    logger.warning(f"[wp-proxy] {url} returned {r.status_code}")
                    return {"error": True, "status": r.status_code, "detail": r.text[:200]}
        except Exception as e:
            logger.warning(f"[wp-proxy] Failed to reach {url}: {e}")
    return {"error": True, "detail": "No working endpoint found"}


async def _wp_rest_get(tenant: Tenant, path: str, params: Optional[Dict] = None) -> Union[Dict, List]:
    """Direct WP REST API call (wp/v2, wc/v3, etc)."""
    url = f"https://{tenant.domain}/wp-json/{path}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            r = await client.get(url, params=params or {})
            if r.status_code == 200:
                return r.json()
            return {"error": True, "status": r.status_code}
    except Exception as e:
        return {"error": True, "detail": str(e)}


# ─── Capabilities ───

@router.get("/{tenant_id}/capabilities")
async def get_capabilities(tenant_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _get_tenant(tenant_id, db)
    # Try eclipse-ai hub/status first (has capabilities), then tinyeclipse capabilities
    status = await _wp_rest_get(tenant, "eclipse-ai/v1/hub/status")
    if isinstance(status, dict) and not status.get("error"):
        return status
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

async def _wp_post(tenant: Tenant, path: str, data: Optional[Dict] = None) -> Dict:
    """POST to eclipse-ai/v1 first, then tinyeclipse/v1 fallback."""
    headers = {"X-Tenant-Id": str(tenant.id), "Content-Type": "application/json"}
    for ns in ["eclipse-ai/v1", "tinyeclipse/v1"]:
        url = f"https://{tenant.domain}/wp-json/{ns}{path}"
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                r = await client.post(url, headers=headers, json=data or {})
                if r.status_code == 200:
                    return r.json()
                if r.status_code != 404:
                    return {"error": True, "status": r.status_code, "detail": r.text[:200]}
        except Exception as e:
            logger.warning(f"[wp-proxy] Failed to POST {url}: {e}")
    return {"error": True, "detail": "No working endpoint found"}


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
# DEEP SCAN — Receive site intelligence from first-connect scan
# ═══════════════════════════════════════════════════════════════

@router.post("/{tenant_id}/deep-scan")
async def receive_deep_scan(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Receive deep scan results from the connector and store in tenant settings."""
    tenant = await _get_tenant(tenant_id, db)
    scan_data = await request.json()

    # Store in tenant settings
    settings = dict(tenant.settings) if tenant.settings else {}
    settings["deep_scan"] = scan_data
    settings["deep_scan_at"] = scan_data.get("scanned_at")

    # Extract key metrics for quick access
    if "content" in scan_data:
        c = scan_data["content"]
        settings["content_units"] = {
            "unique_total": c.get("total_content_units", 0),
            "wp_total": c.get("total_wp_posts", 0),
            "wpml_grouped": c.get("wpml_grouped", False),
            "language_count": c.get("language_count", 1),
        }
    if "rating" in scan_data:
        settings["site_rating"] = scan_data["rating"]
    if "languages" in scan_data:
        settings["languages"] = {
            "wpml_active": scan_data["languages"].get("wpml_active", False),
            "default_language": scan_data["languages"].get("default_language"),
            "language_count": scan_data["languages"].get("language_count", 1),
        }

    tenant.settings = settings
    await db.commit()

    logger.info(
        f"[deep-scan] Stored scan for {tenant.name} ({tenant.domain}): "
        f"rating={scan_data.get('rating', {}).get('overall_rating', '?')}, "
        f"content_units={scan_data.get('content', {}).get('total_content_units', '?')}"
    )

    return {
        "status": "stored",
        "tenant": tenant.name,
        "rating": scan_data.get("rating", {}).get("overall_rating"),
        "content_units": scan_data.get("content", {}).get("total_content_units"),
    }


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


@router.post("/{tenant_id}/fix/security-headers")
async def fix_security_headers(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Tell the WP plugin to add security headers to .htaccess."""
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_post(tenant, "/security/fix", {"fix_type": "add_security_headers", "auto_confirm": True})


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


# ═══════════════════════════════════════════════════════════════
# DIRECT WP REST API — Public data without plugin auth
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/pages")
async def get_wp_pages(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get all pages directly from WP REST API."""
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_rest_get(tenant, "wp/v2/pages", {"per_page": 100, "_fields": "id,title,slug,link,status,modified,template,menu_order"})


@router.get("/{tenant_id}/posts")
async def get_wp_posts(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get all posts directly from WP REST API."""
    tenant = await _get_tenant(tenant_id, db)
    return await _wp_rest_get(tenant, "wp/v2/posts", {"per_page": 100, "_fields": "id,title,slug,link,status,modified,categories"})


@router.get("/{tenant_id}/site-info")
async def get_site_info(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get comprehensive site info: eclipse-ai status + WP types + media count."""
    tenant = await _get_tenant(tenant_id, db)
    info: dict = {"domain": tenant.domain, "name": tenant.name}

    # Eclipse-AI status
    status = await _wp_rest_get(tenant, "eclipse-ai/v1/hub/status")
    if not isinstance(status, dict) or not status.get("error"):
        info["agent"] = status

    # Post types
    types = await _wp_rest_get(tenant, "wp/v2/types")
    if isinstance(types, dict) and not types.get("error"):
        info["post_types"] = list(types.keys())

    # Pages count
    pages = await _wp_rest_get(tenant, "wp/v2/pages", {"per_page": 1})
    if isinstance(pages, list):
        info["pages_count"] = len(pages)  # Will be 1 max, but header has total

    # Media count
    media = await _wp_rest_get(tenant, "wp/v2/media", {"per_page": 1})
    if isinstance(media, list):
        info["has_media"] = True

    return info


# ═══════════════════════════════════════════════════════════════
# UPDATE GUARD — Receive update/rollback notifications from WP
# ═══════════════════════════════════════════════════════════════

@router.post("/{tenant_id}/update-guard")
async def receive_update_guard_event(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive update guard events from the WP plugin (pre-update, post-verify, rollback)."""
    tenant = await _get_tenant(tenant_id, db)
    body = await request.json()

    action = body.get("action", "unknown")
    data = body.get("data", {})

    # Map action to severity
    severity_map = {
        "pre_update": "info",
        "post_update_verify": "info",
        "auto_rollback": "critical",
    }
    verdict = data.get("verdict", "ok")
    if verdict == "critical":
        severity = "critical"
    elif verdict == "warning":
        severity = "warning"
    else:
        severity = severity_map.get(action, "info")

    # Log as system event
    try:
        from app.services.event_bus import emit
        await emit(
            db, domain="system", action=f"update_guard_{action}",
            title=f"Update Guard: {action.replace('_', ' ').title()} — {verdict}",
            severity=severity, tenant_id=tenant.id, source="update_guard",
            data=data,
        )
    except Exception:
        pass

    # Store latest update guard state in tenant settings
    settings = tenant.settings or {}
    settings["update_guard"] = {
        "last_action": action,
        "last_verdict": verdict,
        "timestamp": body.get("timestamp"),
        "data": {k: v for k, v in data.items() if k in ("verdict", "issues", "rolled_back", "vitals")},
    }
    tenant.settings = settings
    await db.flush()

    return {"status": "received", "action": action}
