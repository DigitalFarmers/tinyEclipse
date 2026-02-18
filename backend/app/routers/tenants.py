"""Admin tenant management endpoints."""
import uuid
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, PlanType, TenantStatus
from app.models.client_account import ClientAccount
from app.models.site_module import SiteModule, ModuleType, ModuleStatus
from app.models.conversation import Conversation
from app.models.usage_log import UsageLog
from app.models.source import Source, SourceType, SourceStatus
from app.services.scraper import scrape_sitemap, scrape_url
from app.services.embeddings import ingest_source
from app.services.module_detector import detect_modules

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/tenants",
    tags=["admin-tenants"],
    dependencies=[Depends(verify_admin_key)],
)


class TenantCreate(BaseModel):
    whmcs_client_id: int
    name: str
    plan: str = "tiny"
    domain: str | None = None
    settings: dict = {}
    auto_scrape: bool = True


async def _auto_scrape_site(tenant_id: uuid.UUID, domain: str):
    """Background task: scrape a tenant's domain and index all pages."""
    url = f"https://{domain}" if not domain.startswith("http") else domain
    logger.info(f"[auto-scrape] Starting for tenant {tenant_id}: {url}")

    async with async_session() as db:
        try:
            pages = await scrape_sitemap(url)
            if not pages:
                pages = [url]

            for page_url in pages[:50]:  # Cap at 50 pages per site
                try:
                    content = await scrape_url(page_url)
                    if not content or len(content.strip()) < 50:
                        continue

                    source = Source(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        type=SourceType.url,
                        url=page_url,
                        title=page_url.split("/")[-1] or domain,
                        content=content,
                        status=SourceStatus.pending,
                    )
                    db.add(source)
                    await db.flush()

                    chunks = await ingest_source(db, source)
                    logger.info(f"[auto-scrape] Indexed {page_url}: {chunks} chunks")
                except Exception as e:
                    logger.warning(f"[auto-scrape] Failed {page_url}: {e}")
                    continue

            await db.commit()
            logger.info(f"[auto-scrape] Completed for tenant {tenant_id}")

            # Auto-detect modules after scraping
            try:
                detected = await detect_modules(domain)
                for d in detected:
                    module = SiteModule(
                        tenant_id=tenant_id,
                        module_type=ModuleType(d["module_type"]),
                        name=d["name"],
                        status=ModuleStatus.active,
                        auto_detected=True,
                        config={"found_paths": d.get("found_paths", []), "found_markers": d.get("found_markers", [])},
                        stats={},
                    )
                    db.add(module)
                await db.commit()
                logger.info(f"[auto-detect] Found {len(detected)} modules for tenant {tenant_id}")
            except Exception as e:
                logger.warning(f"[auto-detect] Module detection failed for {tenant_id}: {e}")

        except Exception as e:
            logger.error(f"[auto-scrape] Fatal error for tenant {tenant_id}: {e}")
            await db.rollback()


class TenantUpdate(BaseModel):
    name: str | None = None
    plan: str | None = None
    status: str | None = None
    domain: str | None = None
    settings: dict | None = None


class TenantResponse(BaseModel):
    id: str
    whmcs_client_id: int
    name: str
    plan: str
    status: str
    domain: str | None
    settings: dict
    created_at: str


@router.get("/")
async def list_tenants(
    db: AsyncSession = Depends(get_db),
):
    """List all tenants."""
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()

    return [
        TenantResponse(
            id=str(t.id),
            whmcs_client_id=t.whmcs_client_id,
            name=t.name,
            plan=t.plan.value,
            status=t.status.value,
            domain=t.domain,
            settings=t.settings,
            created_at=t.created_at.isoformat(),
        )
        for t in tenants
    ]


@router.post("/", status_code=201)
async def create_tenant(
    body: TenantCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create a new tenant. If domain is provided and auto_scrape=True,
    automatically scrapes and indexes the site in the background.
    Supports multi-project: same whmcs_client_id can have multiple tenants.
    Auto-creates ClientAccount if needed."""
    # Check for duplicate domain (same domain shouldn't exist twice)
    if body.domain:
        existing = await db.execute(
            select(Tenant).where(Tenant.domain == body.domain)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Domain {body.domain} already exists")

    # Auto-create or link ClientAccount
    account_result = await db.execute(
        select(ClientAccount).where(ClientAccount.whmcs_client_id == body.whmcs_client_id)
    )
    client_account = account_result.scalar_one_or_none()
    if not client_account:
        client_account = ClientAccount(
            whmcs_client_id=body.whmcs_client_id,
            name=body.name,
        )
        db.add(client_account)
        await db.flush()

    tenant = Tenant(
        id=uuid.uuid4(),
        whmcs_client_id=body.whmcs_client_id,
        client_account_id=client_account.id,
        name=body.name,
        plan=PlanType(body.plan),
        domain=body.domain,
        settings=body.settings,
    )
    db.add(tenant)
    await db.flush()

    # Auto-scrape in background if domain is provided
    scrape_status = "skipped"
    if body.domain and body.auto_scrape:
        background_tasks.add_task(_auto_scrape_site, tenant.id, body.domain)
        scrape_status = "started"

    return {
        **TenantResponse(
            id=str(tenant.id),
            whmcs_client_id=tenant.whmcs_client_id,
            name=tenant.name,
            plan=tenant.plan.value,
            status=tenant.status.value,
            domain=tenant.domain,
            settings=tenant.settings,
            created_at=tenant.created_at.isoformat(),
        ).model_dump(),
        "auto_scrape": scrape_status,
        "widget_snippet": f'<script src="/widget/v1/widget.js" data-tenant="{tenant.id}" async></script>',
    }


@router.get("/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get tenant details with usage stats."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get conversation count
    conv_count_result = await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.tenant_id == tenant.id)
    )
    conv_count = conv_count_result.scalar()

    # Get total token usage
    usage_result = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
        ).where(UsageLog.tenant_id == tenant.id)
    )
    tokens_in, tokens_out = usage_result.one()

    return {
        "id": str(tenant.id),
        "whmcs_client_id": tenant.whmcs_client_id,
        "name": tenant.name,
        "plan": tenant.plan.value,
        "status": tenant.status.value,
        "domain": tenant.domain,
        "settings": tenant.settings,
        "created_at": tenant.created_at.isoformat(),
        "stats": {
            "conversations": conv_count,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
        },
    }


@router.post("/link-account")
async def link_tenant_to_account(
    db: AsyncSession = Depends(get_db),
    whmcs_client_id: int = 0,
    account_name: str = "",
):
    """Link all tenants with a given whmcs_client_id to a ClientAccount.
    Creates the ClientAccount if it doesn't exist. Links any unlinked tenants."""
    if not whmcs_client_id:
        raise HTTPException(status_code=400, detail="whmcs_client_id required")

    # Find or create ClientAccount
    result = await db.execute(
        select(ClientAccount).where(ClientAccount.whmcs_client_id == whmcs_client_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        account = ClientAccount(
            whmcs_client_id=whmcs_client_id,
            name=account_name or f"Client #{whmcs_client_id}",
        )
        db.add(account)
        await db.flush()

    # Link all tenants with this whmcs_client_id
    tenants_result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id == whmcs_client_id)
    )
    tenants = tenants_result.scalars().all()
    linked = 0
    for t in tenants:
        if not t.client_account_id:
            t.client_account_id = account.id
            linked += 1
    await db.flush()

    return {
        "account_id": str(account.id),
        "whmcs_client_id": whmcs_client_id,
        "name": account.name,
        "total_tenants": len(tenants),
        "newly_linked": linked,
        "tenants": [{"id": str(t.id), "name": t.name, "domain": t.domain} for t in tenants],
    }


@router.get("/accounts")
async def list_client_accounts(
    db: AsyncSession = Depends(get_db),
):
    """List all client accounts with their tenants."""
    result = await db.execute(select(ClientAccount).order_by(ClientAccount.created_at))
    accounts = result.scalars().all()

    output = []
    for a in accounts:
        tenants_result = await db.execute(
            select(Tenant).where(Tenant.client_account_id == a.id)
        )
        tenants = tenants_result.scalars().all()
        output.append({
            "id": str(a.id),
            "whmcs_client_id": a.whmcs_client_id,
            "name": a.name,
            "email": a.email,
            "company": a.company,
            "tenant_count": len(tenants),
            "tenants": [
                {"id": str(t.id), "name": t.name, "domain": t.domain, "plan": t.plan.value}
                for t in tenants
            ],
        })
    return output


@router.patch("/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    body: TenantUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update tenant settings."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if body.name is not None:
        tenant.name = body.name
    if body.plan is not None:
        tenant.plan = PlanType(body.plan)
    if body.status is not None:
        tenant.status = TenantStatus(body.status)
    if body.domain is not None:
        tenant.domain = body.domain
    if body.settings is not None:
        tenant.settings = body.settings

    await db.flush()

    return {"status": "updated", "id": str(tenant.id)}
