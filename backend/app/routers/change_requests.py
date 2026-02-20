"""
Change Requests — Klanten vragen wijzigingen aan, admins beheren ze.

Portal endpoints (klant): create, list own requests
Admin endpoints: list all, update status, add notes
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.change_request import ChangeRequest, REQUEST_TYPES, REQUEST_STATUSES, REQUEST_PRIORITIES
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# PORTAL — Klant endpoints (no admin key needed, uses tenant_id)
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
    """Klant dient een wijzigingsverzoek in."""
    tenant_uuid = uuid.UUID(body.tenant_id)
    tenant = await db.get(Tenant, tenant_uuid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Validate type
    req_type = body.request_type if body.request_type in REQUEST_TYPES else "other"
    priority = body.priority if body.priority in REQUEST_PRIORITIES else "normal"

    # PRO+ gets high/urgent priority, PRO gets normal max
    plan = tenant.plan.value if hasattr(tenant.plan, 'value') else str(tenant.plan)
    if plan == "tiny":
        raise HTTPException(status_code=403, detail="Wijzigingsverzoeken zijn beschikbaar vanaf het PRO pakket")
    if plan == "pro" and priority in ("high", "urgent"):
        priority = "normal"

    cr = ChangeRequest(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        whmcs_client_id=tenant.whmcs_client_id,
        request_type=req_type,
        priority=priority,
        title=body.title,
        description=body.description,
        page_url=body.page_url,
    )
    db.add(cr)
    await db.commit()

    logger.info(f"[change-request] New: {cr.title} for {tenant.name} ({req_type.value})")

    return {
        "id": str(cr.id),
        "status": "pending",
        "message": "Wijzigingsverzoek ontvangen! We gaan ermee aan de slag.",
    }


@portal_router.get("/by-tenant/{tenant_id}")
async def list_tenant_requests(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Klant ziet eigen verzoeken."""
    tenant_uuid = uuid.UUID(tenant_id)
    result = await db.execute(
        select(ChangeRequest)
        .where(ChangeRequest.tenant_id == tenant_uuid)
        .order_by(desc(ChangeRequest.created_at))
        .limit(50)
    )
    requests = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "request_type": r.request_type or "other",
            "priority": r.priority or "normal",
            "status": r.status or "pending",
            "title": r.title,
            "description": r.description,
            "page_url": r.page_url,
            "admin_notes": r.admin_notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in requests
    ]


# ═══════════════════════════════════════════════════════════════
# ADMIN — Beheer endpoints
# ═══════════════════════════════════════════════════════════════

admin_router = APIRouter(
    prefix="/api/admin/requests",
    tags=["admin-requests"],
    dependencies=[Depends(verify_admin_key)],
)


class UpdateRequestBody(BaseModel):
    status: str | None = None
    admin_notes: str | None = None
    priority: str | None = None


@admin_router.get("/")
async def list_all_requests(
    status: str | None = Query(None),
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Admin ziet alle verzoeken."""
    q = select(ChangeRequest).order_by(desc(ChangeRequest.created_at)).limit(100)
    if status:
        q = q.where(ChangeRequest.status == status)
    if tenant_id:
        q = q.where(ChangeRequest.tenant_id == uuid.UUID(tenant_id))

    result = await db.execute(q)
    requests = result.scalars().all()

    # Get tenant names
    tenant_ids = list(set(r.tenant_id for r in requests))
    tenant_map = {}
    if tenant_ids:
        t_result = await db.execute(select(Tenant).where(Tenant.id.in_(tenant_ids)))
        for t in t_result.scalars().all():
            tenant_map[t.id] = {"name": t.name, "domain": t.domain}

    return [
        {
            "id": str(r.id),
            "tenant_id": str(r.tenant_id),
            "tenant_name": tenant_map.get(r.tenant_id, {}).get("name", "?"),
            "tenant_domain": tenant_map.get(r.tenant_id, {}).get("domain", "?"),
            "whmcs_client_id": r.whmcs_client_id,
            "request_type": r.request_type or "other",
            "priority": r.priority or "normal",
            "status": r.status or "pending",
            "title": r.title,
            "description": r.description,
            "page_url": r.page_url,
            "admin_notes": r.admin_notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in requests
    ]


@admin_router.get("/stats")
async def request_stats(db: AsyncSession = Depends(get_db)):
    """Stats over alle verzoeken."""
    total = (await db.execute(select(func.count(ChangeRequest.id)))).scalar() or 0
    pending = (await db.execute(select(func.count(ChangeRequest.id)).where(ChangeRequest.status == "pending"))).scalar() or 0
    in_progress = (await db.execute(select(func.count(ChangeRequest.id)).where(ChangeRequest.status == "in_progress"))).scalar() or 0
    completed = (await db.execute(select(func.count(ChangeRequest.id)).where(ChangeRequest.status == "completed"))).scalar() or 0

    return {"total": total, "pending": pending, "in_progress": in_progress, "completed": completed}


@admin_router.patch("/{request_id}")
async def update_request(request_id: str, body: UpdateRequestBody, db: AsyncSession = Depends(get_db)):
    """Admin update status/notes."""
    rid = uuid.UUID(request_id)
    cr = await db.get(ChangeRequest, rid)
    if not cr:
        raise HTTPException(status_code=404, detail="Request not found")

    if body.status and body.status in REQUEST_STATUSES:
        cr.status = body.status
        if body.status == "completed":
            cr.completed_at = datetime.now(timezone.utc)
    if body.admin_notes is not None:
        cr.admin_notes = body.admin_notes
    if body.priority and body.priority in REQUEST_PRIORITIES:
        cr.priority = body.priority

    await db.commit()
    return {"status": "updated", "id": str(cr.id), "new_status": cr.status}
