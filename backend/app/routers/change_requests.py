"""
Change Requests — Raw SQL approach to avoid model registration issues.
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key

logger = logging.getLogger(__name__)

REQUEST_TYPES = ["page_edit", "product_edit", "form_edit", "content_add", "seo_update",
                 "translation", "design_change", "bug_report", "feature_request", "other"]
REQUEST_STATUSES = ["pending", "in_progress", "completed", "rejected"]
REQUEST_PRIORITIES = ["low", "normal", "high", "urgent"]

# ═══════════════════════════════════════════════════════════════
# PORTAL
# ═══════════════════════════════════════════════════════════════

portal_router = APIRouter(prefix="/api/portal/requests", tags=["portal-requests"])


class CreateRequestBody(BaseModel):
    tenant_id: str
    request_type: str = "other"
    priority: str = "normal"
    title: str
    description: str
    page_url: str | None = None


@portal_router.post("/")
async def create_request(body: CreateRequestBody, db: AsyncSession = Depends(get_db)):
    tid = uuid.UUID(body.tenant_id)
    row = (await db.execute(text("SELECT plan, whmcs_client_id, name FROM tenants WHERE id = :id"), {"id": str(tid)})).first()
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")

    plan, whmcs_id, tname = row[0], row[1], row[2]
    if plan == "tiny":
        raise HTTPException(status_code=403, detail="Wijzigingsverzoeken zijn beschikbaar vanaf het PRO pakket")

    req_type = body.request_type if body.request_type in REQUEST_TYPES else "other"
    priority = body.priority if body.priority in REQUEST_PRIORITIES else "normal"
    if plan == "pro" and priority in ("high", "urgent"):
        priority = "normal"

    rid = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO change_requests (id, tenant_id, whmcs_client_id, request_type, priority, status, title, description, page_url, created_at, updated_at)
        VALUES (:id, :tid, :wid, :rtype, :pri, 'pending', :title, :desc, :url, NOW(), NOW())
    """), {"id": str(rid), "tid": str(tid), "wid": whmcs_id, "rtype": req_type, "pri": priority,
           "title": body.title, "desc": body.description, "url": body.page_url})
    await db.commit()
    logger.info(f"[change-request] New: {body.title} for {tname} ({req_type})")
    return {"id": str(rid), "status": "pending", "message": "Wijzigingsverzoek ontvangen!"}


@portal_router.get("/by-tenant/{tenant_id}")
async def list_tenant_requests(tenant_id: str, db: AsyncSession = Depends(get_db)):
    tid = uuid.UUID(tenant_id)
    rows = (await db.execute(text(
        "SELECT id, request_type, priority, status, title, description, page_url, admin_notes, created_at, completed_at "
        "FROM change_requests WHERE tenant_id = :tid ORDER BY created_at DESC LIMIT 50"
    ), {"tid": str(tid)})).fetchall()
    return [
        {"id": str(r[0]), "request_type": r[1] or "other", "priority": r[2] or "normal",
         "status": r[3] or "pending", "title": r[4], "description": r[5], "page_url": r[6],
         "admin_notes": r[7], "created_at": r[8].isoformat() if r[8] else None,
         "completed_at": r[9].isoformat() if r[9] else None}
        for r in rows
    ]


# ═══════════════════════════════════════════════════════════════
# ADMIN
# ═══════════════════════════════════════════════════════════════

admin_router = APIRouter(prefix="/api/admin/requests", tags=["admin-requests"], dependencies=[Depends(verify_admin_key)])


class UpdateRequestBody(BaseModel):
    status: str | None = None
    admin_notes: str | None = None
    priority: str | None = None


@admin_router.get("/")
async def list_all_requests(status: str | None = Query(None), tenant_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    q = "SELECT cr.id, cr.tenant_id, cr.whmcs_client_id, cr.request_type, cr.priority, cr.status, cr.title, cr.description, cr.page_url, cr.admin_notes, cr.created_at, cr.completed_at, t.name, t.domain FROM change_requests cr LEFT JOIN tenants t ON t.id = cr.tenant_id WHERE 1=1"
    params: dict = {}
    if status:
        q += " AND cr.status = :status"
        params["status"] = status
    if tenant_id:
        q += " AND cr.tenant_id = :tid"
        params["tid"] = tenant_id
    q += " ORDER BY cr.created_at DESC LIMIT 100"
    rows = (await db.execute(text(q), params)).fetchall()
    return [
        {"id": str(r[0]), "tenant_id": str(r[1]), "whmcs_client_id": r[2],
         "request_type": r[3] or "other", "priority": r[4] or "normal", "status": r[5] or "pending",
         "title": r[6], "description": r[7], "page_url": r[8], "admin_notes": r[9],
         "created_at": r[10].isoformat() if r[10] else None, "completed_at": r[11].isoformat() if r[11] else None,
         "tenant_name": r[12] or "?", "tenant_domain": r[13] or "?"}
        for r in rows
    ]


@admin_router.get("/stats")
async def request_stats(db: AsyncSession = Depends(get_db)):
    row = (await db.execute(text(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE status='pending'), COUNT(*) FILTER (WHERE status='in_progress'), COUNT(*) FILTER (WHERE status='completed') FROM change_requests"
    ))).first()
    return {"total": row[0], "pending": row[1], "in_progress": row[2], "completed": row[3]}


@admin_router.patch("/{request_id}")
async def update_request(request_id: str, body: UpdateRequestBody, db: AsyncSession = Depends(get_db)):
    rid = uuid.UUID(request_id)
    existing = (await db.execute(text("SELECT id FROM change_requests WHERE id = :id"), {"id": str(rid)})).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")

    updates = []
    params: dict = {"id": str(rid)}
    if body.status and body.status in REQUEST_STATUSES:
        updates.append("status = :status")
        params["status"] = body.status
        if body.status == "completed":
            updates.append("completed_at = NOW()")
    if body.admin_notes is not None:
        updates.append("admin_notes = :notes")
        params["notes"] = body.admin_notes
    if body.priority and body.priority in REQUEST_PRIORITIES:
        updates.append("priority = :pri")
        params["pri"] = body.priority

    if updates:
        updates.append("updated_at = NOW()")
        await db.execute(text(f"UPDATE change_requests SET {', '.join(updates)} WHERE id = :id"), params)
        await db.commit()
    return {"status": "updated", "id": str(rid)}
