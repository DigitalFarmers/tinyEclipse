"""Admin tenant management endpoints."""
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.helpers import get_tenant_safe
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, PlanType, TenantStatus, TenantEnvironment
from app.models.client_account import ClientAccount
from app.models.site_module import SiteModule, ModuleType, ModuleStatus
from app.models.conversation import Conversation
from app.models.usage_log import UsageLog
from app.models.source import Source, SourceType, SourceStatus
from app.services.scraper import scrape_sitemap, scrape_url
from app.services.deep_scraper import deep_scrape_site
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
    domain: Optional[str] = None
    environment: str = "production"
    settings: Dict = {}
    auto_scrape: bool = True


async def _auto_scrape_site(tenant_id: uuid.UUID, domain: str, clear_existing: bool = False):
    """Background task: deep scrape a tenant's domain and index all content.
    Uses Deep Scraper v2: WordPress REST API + WooCommerce + structured knowledge extraction."""
    logger.info(f"[deep-scrape] Starting for tenant {tenant_id}: {domain}")

    async with async_session() as db:
        try:
            # Optionally clear existing sources
            if clear_existing:
                from sqlalchemy import delete as sql_delete
                from app.models.embedding import Embedding
                # Delete embeddings first (FK constraint)
                existing_sources = await db.execute(
                    select(Source.id).where(Source.tenant_id == tenant_id)
                )
                source_ids = [row[0] for row in existing_sources.all()]
                if source_ids:
                    await db.execute(sql_delete(Embedding).where(Embedding.source_id.in_(source_ids)))
                    await db.execute(sql_delete(Source).where(Source.tenant_id == tenant_id))
                    await db.flush()
                    logger.info(f"[deep-scrape] Cleared {len(source_ids)} existing sources for tenant {tenant_id}")

            # Run deep scraper
            result = await deep_scrape_site(domain)

            indexed_count = 0

            # Index pages and posts
            for page in result["pages"]:
                try:
                    source = Source(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        type=SourceType.url,
                        url=page.get("url", ""),
                        title=page.get("title", domain),
                        content=page.get("content", ""),
                        status=SourceStatus.pending,
                    )
                    db.add(source)
                    await db.flush()
                    chunks = await ingest_source(db, source)
                    indexed_count += 1
                    logger.info(f"[deep-scrape] Indexed page: {page.get('title', '?')} ({chunks} chunks)")
                except Exception as e:
                    logger.warning(f"[deep-scrape] Failed page {page.get('url', '?')}: {e}")
                    continue

            # Index products
            for product in result["products"]:
                try:
                    source = Source(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        type=SourceType.text,
                        url=product.get("url", ""),
                        title=product.get("title", "Product"),
                        content=product.get("content", ""),
                        status=SourceStatus.pending,
                    )
                    db.add(source)
                    await db.flush()
                    chunks = await ingest_source(db, source)
                    indexed_count += 1
                except Exception as e:
                    logger.warning(f"[deep-scrape] Failed product {product.get('title', '?')}: {e}")
                    continue

            # Index knowledge points (high-value structured facts)
            for kp in result["knowledge_points"]:
                try:
                    source = Source(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        type=SourceType.faq,
                        title=kp.get("title", "Knowledge Point"),
                        content=kp.get("content", ""),
                        status=SourceStatus.pending,
                    )
                    db.add(source)
                    await db.flush()
                    chunks = await ingest_source(db, source)
                    indexed_count += 1
                    logger.info(f"[deep-scrape] Indexed knowledge point: {kp.get('title', '?')}")
                except Exception as e:
                    logger.warning(f"[deep-scrape] Failed knowledge point: {e}")
                    continue

            await db.commit()
            logger.info(f"[deep-scrape] Completed for {domain}: {indexed_count} items indexed (stats: {result['stats']})")

            # Auto-detect modules after scraping
            try:
                detected = await detect_modules(domain)
                for d in detected:
                    # Check if module already exists
                    existing = await db.execute(
                        select(SiteModule).where(
                            SiteModule.tenant_id == tenant_id,
                            SiteModule.module_type == ModuleType(d["module_type"]),
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue
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
            logger.error(f"[deep-scrape] Fatal error for tenant {tenant_id}: {e}")
            await db.rollback()


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    status: Optional[str] = None
    domain: Optional[str] = None
    environment: Optional[str] = None
    settings: Optional[Dict] = None


class TenantResponse(BaseModel):
    id: str
    whmcs_client_id: int
    name: str
    plan: str
    status: str
    domain: Optional[str]
    environment: str = "production"
    settings: Dict
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
            environment=t.environment.value if hasattr(t, 'environment') and t.environment else "production",
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
        environment=TenantEnvironment(body.environment),
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
            environment=tenant.environment.value,
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
    tenant = await get_tenant_safe(db, tenant_id)

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


@router.post("/{tenant_id}/rescrape")
async def rescrape_tenant(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    clear_existing: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a deep re-scrape of a tenant's site.
    Uses Deep Scraper v2: WordPress REST API + WooCommerce + structured knowledge extraction.
    Set clear_existing=True to wipe old sources first (recommended for re-scrape)."""
    tenant = await get_tenant_safe(db, tenant_id, require_domain=True)
    if not tenant.domain:
        raise HTTPException(status_code=400, detail="Tenant has no domain set")

    # Get current source count
    source_count = await db.execute(
        select(func.count()).select_from(Source).where(Source.tenant_id == tenant.id)
    )
    current_sources = source_count.scalar() or 0

    background_tasks.add_task(_auto_scrape_site, tenant.id, tenant.domain, clear_existing)

    return {
        "status": "rescrape_started",
        "tenant_id": tenant_id,
        "domain": tenant.domain,
        "clear_existing": clear_existing,
        "previous_sources": current_sources,
        "message": f"Deep scrape v2 started for {tenant.domain}. WordPress REST API + WooCommerce + structured knowledge extraction.",
    }


@router.patch("/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    body: TenantUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update tenant settings."""
    tenant = await get_tenant_safe(db, tenant_id)

    if body.name is not None:
        tenant.name = body.name
    if body.plan is not None:
        tenant.plan = PlanType(body.plan)
    if body.status is not None:
        tenant.status = TenantStatus(body.status)
    if body.domain is not None:
        tenant.domain = body.domain
    if body.environment is not None:
        tenant.environment = TenantEnvironment(body.environment)
    if body.settings is not None:
        # Merge instead of replace — preserves existing settings not sent in this update
        existing = tenant.settings or {}
        existing.update(body.settings)
        tenant.settings = existing

    await db.flush()

    return {
        "status": "updated",
        "id": str(tenant.id),
        "name": tenant.name,
        "domain": tenant.domain,
        "environment": tenant.environment.value if hasattr(tenant, 'environment') and tenant.environment else "production",
    }
