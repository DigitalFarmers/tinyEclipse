"""
Portal Data Proxy — CRUD proxy for the client Hub portal.

All requests are proxied to the WordPress site's tinyeclipse/v1 REST API.
Auth: portal session (tenant_id match). No admin key required.

Covers: Products, Services, Rentals, Bookings, Portfolio, Packages,
        Orders, Forms, FAQ, Business Profile, SEO/OpenGraph, Links.
"""
import uuid
import logging
from typing import Optional, Dict, List, Union

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/data", tags=["portal-data"])

TIMEOUT = 20


async def _tenant(tenant_id: str, db: AsyncSession) -> Tenant:
    t = await db.get(Tenant, uuid.UUID(tenant_id))
    if not t or not t.domain:
        raise HTTPException(status_code=404, detail="Tenant not found or no domain")
    return t


async def _get(tenant: Tenant, path: str, params: Optional[Dict] = None) -> Union[Dict, List]:
    headers = {"X-Tenant-Id": str(tenant.id)}
    for ns in ["tinyeclipse/v1", "eclipse-ai/v1"]:
        url = f"https://{tenant.domain}/wp-json/{ns}{path}"
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as c:
                r = await c.get(url, headers=headers, params=params or {})
                if r.status_code == 200:
                    return r.json()
                if r.status_code != 404:
                    return {"error": True, "status": r.status_code, "detail": r.text[:200]}
        except Exception as e:
            logger.warning(f"[portal-data] GET {url}: {e}")
    return {"error": True, "detail": "No working endpoint"}


async def _post(tenant: Tenant, path: str, data: Optional[Dict] = None) -> Dict:
    headers = {"X-Tenant-Id": str(tenant.id), "Content-Type": "application/json"}
    for ns in ["tinyeclipse/v1", "eclipse-ai/v1"]:
        url = f"https://{tenant.domain}/wp-json/{ns}{path}"
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
                r = await c.post(url, headers=headers, json=data or {})
                if r.status_code in (200, 201):
                    return r.json()
                if r.status_code != 404:
                    return {"error": True, "status": r.status_code, "detail": r.text[:200]}
        except Exception as e:
            logger.warning(f"[portal-data] POST {url}: {e}")
    return {"error": True, "detail": "No working endpoint"}


# ═══════════════════════════════════════════════════════════════
# PRODUCTS (WooCommerce)
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/products")
async def list_products(tenant_id: str, limit: int = Query(100, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/shop/products", {"limit": limit})


@router.get("/{tenant_id}/products/categories")
async def list_product_categories(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/shop/categories")


@router.post("/{tenant_id}/products/create")
async def create_product(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/products/create", await request.json())


@router.post("/{tenant_id}/products/{product_id}")
async def update_product(tenant_id: str, product_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/products/{product_id}", await request.json())


@router.post("/{tenant_id}/products/{product_id}/delete")
async def delete_product(tenant_id: str, product_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/products/{product_id}/delete")


@router.post("/{tenant_id}/products/{product_id}/duplicate")
async def duplicate_product(tenant_id: str, product_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/products/{product_id}/duplicate")


# ═══════════════════════════════════════════════════════════════
# ORDERS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/orders")
async def list_orders(
    tenant_id: str,
    limit: int = Query(50, ge=1, le=200),
    status: str = Query("any"),
    db: AsyncSession = Depends(get_db),
):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/shop/orders", {"limit": limit, "status": status})


@router.get("/{tenant_id}/orders/{order_id}")
async def get_order(tenant_id: str, order_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, f"/shop/orders/{order_id}")


@router.post("/{tenant_id}/orders/{order_id}/status")
async def update_order_status(tenant_id: str, order_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/orders/{order_id}/status", await request.json())


@router.post("/{tenant_id}/orders/{order_id}/note")
async def add_order_note(tenant_id: str, order_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/orders/{order_id}/note", await request.json())


@router.get("/{tenant_id}/orders/stats")
async def order_stats(tenant_id: str, days: int = Query(30, ge=1, le=365), db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/shop/stats", {"days": days})


# ═══════════════════════════════════════════════════════════════
# SERVICES
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/services")
async def list_services(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/services")


@router.post("/{tenant_id}/services/create")
async def create_service(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/services/create", await request.json())


@router.post("/{tenant_id}/services/{service_id}")
async def update_service(tenant_id: str, service_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/services/{service_id}", await request.json())


@router.post("/{tenant_id}/services/{service_id}/delete")
async def delete_service(tenant_id: str, service_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/services/{service_id}/delete")


# ═══════════════════════════════════════════════════════════════
# RENTALS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/rentals")
async def list_rentals(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/rentals")


@router.post("/{tenant_id}/rentals/create")
async def create_rental(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/rentals/create", await request.json())


@router.post("/{tenant_id}/rentals/{rental_id}")
async def update_rental(tenant_id: str, rental_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/rentals/{rental_id}", await request.json())


@router.post("/{tenant_id}/rentals/{rental_id}/delete")
async def delete_rental(tenant_id: str, rental_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/rentals/{rental_id}/delete")


@router.get("/{tenant_id}/rentals/{rental_id}/availability")
async def rental_availability(tenant_id: str, rental_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, f"/rentals/{rental_id}/availability")


# ═══════════════════════════════════════════════════════════════
# BOOKINGS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/bookings")
async def list_bookings(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/bookings")


@router.get("/{tenant_id}/bookings/upcoming")
async def upcoming_bookings(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/bookings/upcoming")


@router.post("/{tenant_id}/bookings/{booking_id}/confirm")
async def confirm_booking(tenant_id: str, booking_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/bookings/{booking_id}/confirm")


@router.post("/{tenant_id}/bookings/{booking_id}/cancel")
async def cancel_booking(tenant_id: str, booking_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/bookings/{booking_id}/cancel")


# ═══════════════════════════════════════════════════════════════
# PORTFOLIO / PROJECTS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/portfolio")
async def list_portfolio(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/portfolio")


@router.post("/{tenant_id}/portfolio/create")
async def create_project(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/portfolio/create", await request.json())


@router.post("/{tenant_id}/portfolio/{project_id}")
async def update_project(tenant_id: str, project_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/portfolio/{project_id}", await request.json())


@router.post("/{tenant_id}/portfolio/{project_id}/delete")
async def delete_project(tenant_id: str, project_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/portfolio/{project_id}/delete")


# ═══════════════════════════════════════════════════════════════
# PACKAGES
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/packages")
async def list_packages(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/packages")


@router.post("/{tenant_id}/packages/create")
async def create_package(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/packages/create", await request.json())


@router.post("/{tenant_id}/packages/{package_id}")
async def update_package(tenant_id: str, package_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/packages/{package_id}", await request.json())


@router.post("/{tenant_id}/packages/{package_id}/delete")
async def delete_package(tenant_id: str, package_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/packages/{package_id}/delete")


# ═══════════════════════════════════════════════════════════════
# JOBS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/jobs")
async def list_jobs(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/jobs/audit")


@router.get("/{tenant_id}/jobs/{job_id}")
async def get_job(tenant_id: str, job_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, f"/jobs/{job_id}")


@router.post("/{tenant_id}/jobs/create")
async def create_job(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/jobs/create", await request.json())


@router.post("/{tenant_id}/jobs/{job_id}")
async def update_job(tenant_id: str, job_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/jobs/update/{job_id}", await request.json())


@router.post("/{tenant_id}/jobs/{job_id}/publish")
async def publish_job(tenant_id: str, job_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/jobs/publish/{job_id}")


@router.post("/{tenant_id}/jobs/{job_id}/close")
async def close_job(tenant_id: str, job_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/jobs/close/{job_id}")


@router.post("/{tenant_id}/jobs/{job_id}/delete")
async def delete_job(tenant_id: str, job_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/jobs/{job_id}/delete")


@router.post("/{tenant_id}/jobs/ai-generate")
async def ai_generate_job(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/jobs/ai-generate", await request.json())


@router.get("/{tenant_id}/jobs/applications")
async def job_applications(tenant_id: str, limit: int = Query(50, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/jobs/applications", {"limit": limit})


# ═══════════════════════════════════════════════════════════════
# FORMS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/forms")
async def list_forms(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/forms/audit")


@router.get("/{tenant_id}/forms/{form_id}/entries")
async def form_entries(tenant_id: str, form_id: int, limit: int = Query(50, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, f"/forms/{form_id}/entries", {"limit": limit})


@router.get("/{tenant_id}/forms/submissions")
async def form_submissions(tenant_id: str, form_id: int = Query(...), limit: int = Query(50), db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/forms/submissions", {"form_id": form_id, "limit": limit})


# ═══════════════════════════════════════════════════════════════
# FAQ
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/faq")
async def list_faq(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/faq")


@router.post("/{tenant_id}/faq/create")
async def create_faq(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/faq/create", await request.json())


@router.post("/{tenant_id}/faq/{faq_id}")
async def update_faq(tenant_id: str, faq_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/faq/{faq_id}", await request.json())


@router.post("/{tenant_id}/faq/{faq_id}/delete")
async def delete_faq(tenant_id: str, faq_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/faq/{faq_id}/delete")


@router.post("/{tenant_id}/faq/reorder")
async def reorder_faq(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/faq/reorder", await request.json())


# ═══════════════════════════════════════════════════════════════
# BUSINESS PROFILE & LOCATIONS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/business/profile")
async def get_business_profile(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/business/profile")


@router.post("/{tenant_id}/business/profile")
async def save_business_profile(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/business/profile", await request.json())


@router.get("/{tenant_id}/business/locations")
async def list_locations(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/business/locations")


@router.post("/{tenant_id}/business/locations")
async def create_location(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/business/locations", await request.json())


@router.post("/{tenant_id}/business/locations/{location_id}")
async def update_location(tenant_id: str, location_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/business/locations/{location_id}", await request.json())


@router.post("/{tenant_id}/business/locations/{location_id}/delete")
async def delete_location(tenant_id: str, location_id: int, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/business/locations/{location_id}/delete")


# ═══════════════════════════════════════════════════════════════
# SEO & OPENGRAPH
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/seo/audit")
async def seo_audit(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/seo/audit")


@router.get("/{tenant_id}/seo/pages")
async def seo_pages(tenant_id: str, limit: int = Query(50), db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/seo/pages", {"limit": limit})


@router.get("/{tenant_id}/seo/opengraph")
async def list_opengraph(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/seo/opengraph")


@router.post("/{tenant_id}/seo/opengraph/{page_id}")
async def update_opengraph(tenant_id: str, page_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, f"/seo/opengraph/{page_id}", await request.json())


@router.get("/{tenant_id}/seo/links")
async def list_links(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/seo/links")


@router.get("/{tenant_id}/seo/links/broken")
async def broken_links(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/seo/links/broken")


@router.post("/{tenant_id}/seo/links/redirect")
async def create_redirect(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/seo/links/redirect", await request.json())


# ═══════════════════════════════════════════════════════════════
# SITE INTELLIGENCE & TRANSLATIONS
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/intelligence/scan")
async def get_intelligence_scan(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/site-intelligence/scan")


@router.post("/{tenant_id}/intelligence/deep-scan")
async def trigger_deep_scan(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _post(t, "/site-intelligence/deep-scan")


@router.get("/{tenant_id}/intelligence/pages")
async def get_intelligence_pages(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/site-intelligence/pages")


@router.get("/{tenant_id}/intelligence/translations")
async def get_intelligence_translations(tenant_id: str, db: AsyncSession = Depends(get_db)):
    t = await _tenant(tenant_id, db)
    return await _get(t, "/site-intelligence/translations")


# ═══════════════════════════════════════════════════════════════
# PRODUCT INTELLIGENCE
# ═══════════════════════════════════════════════════════════════

@router.get("/{tenant_id}/product-intelligence")
async def portal_product_intelligence(
    tenant_id: str,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Product intelligence for portal users (shop admins)."""
    t = await _tenant(tenant_id, db)
    from app.services.product_intelligence import analyze_products
    result = await analyze_products(t.domain, str(t.id), limit=limit)
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result.get("detail", "Failed to fetch products"))
    return result
