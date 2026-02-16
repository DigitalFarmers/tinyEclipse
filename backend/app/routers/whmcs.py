"""
WHMCS API Router — Client portal, billing sync, auto-provisioning.
The bridge between WHMCS billing and Eclipse AI.
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, PlanType, TenantStatus
from app.services.whmcs import get_whmcs_client, WHMCSError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/whmcs",
    tags=["admin-whmcs"],
    dependencies=[Depends(verify_admin_key)],
)


# ─── Health & Status ───

@router.get("/status/")
async def whmcs_status():
    """Check WHMCS connection status and configuration."""
    client = get_whmcs_client()
    if not client.configured:
        return {
            "status": "not_configured",
            "message": "Set WHMCS_API_URL, WHMCS_API_IDENTIFIER, WHMCS_API_SECRET, WHMCS_ADMIN_USER in environment",
        }
    health = await client.health_check()
    return health


# ─── Clients ───

@router.get("/clients/")
async def list_clients(limit: int = 100, offset: int = 0):
    """List all WHMCS clients."""
    client = get_whmcs_client()
    try:
        data = await client.get_clients(limit=limit, offset=offset)
        clients_data = data.get("clients", {}).get("client", [])
        return {
            "total": data.get("totalresults", 0),
            "clients": clients_data,
        }
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/clients/{client_id}")
async def get_client(client_id: int):
    """Get detailed info for a WHMCS client."""
    client = get_whmcs_client()
    try:
        data = await client.get_client(client_id)
        return data
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/clients/{client_id}/products")
async def get_client_products(client_id: int):
    """Get all products/services for a WHMCS client."""
    client = get_whmcs_client()
    try:
        data = await client.get_client_products(client_id)
        products = data.get("products", {}).get("product", [])
        return {"total": len(products), "products": products}
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/clients/{client_id}/domains")
async def get_client_domains(client_id: int):
    """Get all domains for a WHMCS client."""
    client = get_whmcs_client()
    try:
        data = await client.get_client_domains(client_id)
        domains = data.get("domains", {}).get("domain", [])
        return {"total": len(domains), "domains": domains}
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/clients/{client_id}/invoices")
async def get_client_invoices(client_id: int, status: str = "Unpaid"):
    """Get invoices for a WHMCS client."""
    client = get_whmcs_client()
    try:
        data = await client.get_invoices(client_id=client_id, status=status)
        invoices = data.get("invoices", {}).get("invoice", [])
        return {"total": data.get("totalresults", 0), "invoices": invoices}
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── Products ───

@router.get("/products/")
async def list_products():
    """List all WHMCS products — use this to find product IDs for plan mapping."""
    client = get_whmcs_client()
    try:
        data = await client.get_products()
        products = data.get("products", {}).get("product", [])
        return {
            "total": len(products),
            "products": [
                {
                    "id": p.get("pid"),
                    "name": p.get("name"),
                    "group": p.get("groupname"),
                    "type": p.get("type"),
                    "pricing": p.get("pricing"),
                    "description": p.get("description", "")[:200],
                }
                for p in products
            ],
            "plan_mapping": {
                "tiny": client.plan_to_product_id("tiny"),
                "pro": client.plan_to_product_id("pro"),
                "pro_plus": client.plan_to_product_id("pro_plus"),
            },
        }
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── Orders ───

@router.get("/orders/")
async def list_orders(limit: int = 50):
    """List recent WHMCS orders."""
    client = get_whmcs_client()
    try:
        data = await client.get_orders(limit=limit)
        orders = data.get("orders", {}).get("order", [])
        return {"total": data.get("totalresults", 0), "orders": orders}
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── Tickets ───

@router.get("/tickets/")
async def list_tickets(status: str = "Open"):
    """List WHMCS support tickets."""
    client = get_whmcs_client()
    try:
        data = await client.get_tickets(status=status)
        tickets = data.get("tickets", {}).get("ticket", [])
        return {"total": data.get("totalresults", 0), "tickets": tickets}
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/tickets/{client_id}")
async def get_client_tickets(client_id: int, status: str = "Open"):
    """Get tickets for a specific client."""
    client = get_whmcs_client()
    try:
        data = await client.get_tickets(client_id=client_id, status=status)
        tickets = data.get("tickets", {}).get("ticket", [])
        return {"total": data.get("totalresults", 0), "tickets": tickets}
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── Sync: WHMCS → Eclipse ───

class SyncResult(BaseModel):
    synced: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[dict] = []


@router.post("/sync/clients/")
async def sync_clients_to_eclipse(db: AsyncSession = Depends(get_db)):
    """Sync WHMCS clients to Eclipse tenants.
    Creates new tenants for clients that don't exist yet.
    Updates plan for existing tenants if their WHMCS product changed.
    """
    whmcs = get_whmcs_client()
    result = SyncResult()

    try:
        clients_data = await whmcs.get_clients(limit=250)
        clients = clients_data.get("clients", {}).get("client", [])
    except WHMCSError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch WHMCS clients: {e}")

    for c in clients:
        whmcs_id = c.get("id")
        if not whmcs_id:
            continue

        try:
            # Check if tenant exists
            existing = await db.execute(
                select(Tenant).where(Tenant.whmcs_client_id == int(whmcs_id))
            )
            tenant = existing.scalar_one_or_none()

            # Get client products to determine plan
            products_data = await whmcs.get_client_products(int(whmcs_id))
            products = products_data.get("products", {}).get("product", [])

            # Find Eclipse plan from products
            plan = None
            domain = None
            for p in products:
                pid = p.get("pid")
                mapped = whmcs.product_id_to_plan(pid)
                if mapped:
                    plan = mapped
                    domain = p.get("domain") or domain
                    break

            if not plan:
                result.skipped += 1
                continue

            name = c.get("companyname") or f"{c.get('firstname', '')} {c.get('lastname', '')}".strip()
            if not name:
                name = f"Client {whmcs_id}"

            if tenant:
                # Update existing
                changed = False
                if tenant.plan.value != plan:
                    tenant.plan = PlanType(plan)
                    changed = True
                if domain and tenant.domain != domain:
                    tenant.domain = domain
                    changed = True
                if changed:
                    result.updated += 1
                else:
                    result.skipped += 1
            else:
                # Create new tenant
                tenant = Tenant(
                    id=uuid.uuid4(),
                    whmcs_client_id=int(whmcs_id),
                    name=name,
                    plan=PlanType(plan),
                    domain=domain or "",
                )
                db.add(tenant)
                result.created += 1

            result.synced += 1

        except Exception as e:
            result.errors.append({"whmcs_client_id": whmcs_id, "error": str(e)})

    await db.flush()

    return {
        "status": "completed",
        "synced": result.synced,
        "created": result.created,
        "updated": result.updated,
        "skipped": result.skipped,
        "errors": result.errors,
    }


# ─── Sync: Eclipse → WHMCS (push tenant_id back) ───

@router.post("/sync/push-tenant-ids/")
async def push_tenant_ids_to_whmcs(db: AsyncSession = Depends(get_db)):
    """Push Eclipse tenant IDs back to WHMCS as custom fields.
    This allows WHMCS to know which Eclipse tenant belongs to which client.
    """
    whmcs = get_whmcs_client()
    tenants_result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id.isnot(None))
    )
    tenants = tenants_result.scalars().all()

    pushed = 0
    errors = []

    for tenant in tenants:
        try:
            # Get client products
            products_data = await whmcs.get_client_products(tenant.whmcs_client_id)
            products = products_data.get("products", {}).get("product", [])

            for p in products:
                pid = p.get("pid")
                if whmcs.product_id_to_plan(pid):
                    service_id = p.get("id")
                    if service_id:
                        await whmcs.update_client_custom_field(
                            service_id, "eclipse_tenant_id", str(tenant.id)
                        )
                        pushed += 1
                    break
        except Exception as e:
            errors.append({"tenant_id": str(tenant.id), "error": str(e)})

    return {"pushed": pushed, "errors": errors}


# ─── Provisioning Webhook ───

class WHMCSWebhookPayload(BaseModel):
    action: str  # OrderPaid, ServiceActivate, ServiceSuspend, ServiceTerminate, etc.
    client_id: int | None = None
    service_id: int | None = None
    product_id: int | None = None
    domain: str | None = None
    custom_fields: dict = {}


@router.post("/webhook/")
async def whmcs_webhook(
    payload: WHMCSWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """Receive webhooks from WHMCS for auto-provisioning.
    Configure WHMCS to POST here on order events.
    """
    whmcs = get_whmcs_client()
    action = payload.action.lower()

    logger.info(f"WHMCS webhook: {payload.action} client={payload.client_id} service={payload.service_id}")

    if action in ("orderpaid", "serviceactivate", "aftermodulecreate"):
        # Auto-provision: create Eclipse tenant
        if not payload.client_id:
            raise HTTPException(status_code=400, detail="client_id required")

        # Check if already exists
        existing = await db.execute(
            select(Tenant).where(Tenant.whmcs_client_id == payload.client_id)
        )
        if existing.scalar_one_or_none():
            return {"status": "already_exists", "message": "Tenant already provisioned"}

        # Determine plan
        plan = whmcs.product_id_to_plan(payload.product_id) if payload.product_id else None
        if not plan:
            plan = "tiny"

        # Get client name
        name = f"Client {payload.client_id}"
        try:
            client_data = await whmcs.get_client(payload.client_id)
            name = client_data.get("companyname") or \
                   f"{client_data.get('firstname', '')} {client_data.get('lastname', '')}".strip() or name
        except Exception:
            pass

        tenant = Tenant(
            id=uuid.uuid4(),
            whmcs_client_id=payload.client_id,
            name=name,
            plan=PlanType(plan),
            domain=payload.domain or "",
        )
        db.add(tenant)
        await db.flush()

        # Auto-setup monitoring if domain provided and plan supports it
        if payload.domain and plan in ("pro", "pro_plus"):
            try:
                from app.services.monitor import setup_default_checks
                await setup_default_checks(db, tenant.id, payload.domain)
            except Exception as e:
                logger.error(f"Auto-setup monitoring failed: {e}")

        return {
            "status": "provisioned",
            "tenant_id": str(tenant.id),
            "plan": plan,
            "domain": payload.domain,
        }

    elif action in ("servicesuspend", "aftermodulesuspend"):
        # Suspend tenant
        if not payload.client_id:
            raise HTTPException(status_code=400, detail="client_id required")

        tenant_result = await db.execute(
            select(Tenant).where(Tenant.whmcs_client_id == payload.client_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            tenant.status = TenantStatus.suspended
            await db.flush()
            return {"status": "suspended", "tenant_id": str(tenant.id)}
        return {"status": "not_found"}

    elif action in ("serviceunsuspend", "aftermoduleunsuspend"):
        # Reactivate tenant
        if not payload.client_id:
            raise HTTPException(status_code=400, detail="client_id required")

        tenant_result = await db.execute(
            select(Tenant).where(Tenant.whmcs_client_id == payload.client_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            tenant.status = TenantStatus.active
            await db.flush()
            return {"status": "reactivated", "tenant_id": str(tenant.id)}
        return {"status": "not_found"}

    elif action in ("serviceterminate", "aftermoduleterminate"):
        # Terminate — we don't delete, just suspend
        if not payload.client_id:
            raise HTTPException(status_code=400, detail="client_id required")

        tenant_result = await db.execute(
            select(Tenant).where(Tenant.whmcs_client_id == payload.client_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            tenant.status = TenantStatus.suspended
            await db.flush()
            return {"status": "terminated_suspended", "tenant_id": str(tenant.id)}
        return {"status": "not_found"}

    return {"status": "ignored", "action": payload.action}


# ─── Client Portal: Tenant lookup by WHMCS client ───

@router.get("/portal/{client_id}")
async def client_portal_data(client_id: int, db: AsyncSession = Depends(get_db)):
    """Get Eclipse data for a WHMCS client — used by client portal integration.
    Returns tenant info, monitoring summary, recent conversations, etc.
    """
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id == client_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="No Eclipse tenant found for this WHMCS client")

    from sqlalchemy import func
    from app.models.monitor import MonitorCheck, Alert
    from app.models.conversation import Conversation

    # Monitoring summary
    checks_count = await db.execute(
        select(func.count()).select_from(MonitorCheck).where(MonitorCheck.tenant_id == tenant.id)
    )
    active_alerts = await db.execute(
        select(func.count()).select_from(Alert).where(
            and_(Alert.tenant_id == tenant.id, Alert.resolved == False)
        )
    )

    # Recent conversations
    convs = await db.execute(
        select(Conversation).where(Conversation.tenant_id == tenant.id)
        .order_by(Conversation.created_at.desc()).limit(5)
    )
    recent_convs = [
        {
            "id": str(c.id),
            "status": c.status,
            "created_at": c.created_at.isoformat(),
        }
        for c in convs.scalars().all()
    ]

    return {
        "tenant_id": str(tenant.id),
        "name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value,
        "status": tenant.status.value,
        "monitoring": {
            "checks": checks_count.scalar(),
            "active_alerts": active_alerts.scalar(),
        },
        "recent_conversations": recent_convs,
        "dashboard_url": f"https://tinyeclipse.digitalfarmers.be/tenants/{tenant.id}",
        "embed_code": (
            f'<script src="https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js" '
            f'data-tenant="{tenant.id}" '
            f'data-api="https://api.tinyeclipse.digitalfarmers.be" '
            f'async></script>'
        ),
    }
