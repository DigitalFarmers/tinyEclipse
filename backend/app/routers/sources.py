"""Source management and ingestion endpoints."""
import uuid
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.helpers import get_tenant_safe
from app.middleware.auth import verify_admin_key
from sqlalchemy import delete as sa_delete

from app.models.source import Source, SourceType, SourceStatus
from app.models.embedding import Embedding
from app.models.tenant import Tenant
from app.services.embeddings import ingest_source
from app.services.scraper import scrape_url, scrape_sitemap

logger = structlog.get_logger()

router = APIRouter(
    prefix="/api/admin/sources",
    tags=["admin-sources"],
    dependencies=[Depends(verify_admin_key)],
)


class SourceCreate(BaseModel):
    tenant_id: str
    type: str = "url"
    url: Optional[str] = None
    title: str
    content: Optional[str] = None


class SourceResponse(BaseModel):
    id: str
    tenant_id: str
    type: str
    url: Optional[str]
    title: str
    status: str
    last_indexed_at: Optional[str]
    created_at: str


@router.get("/")
async def list_sources(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all sources for a tenant."""
    result = await db.execute(
        select(Source)
        .where(Source.tenant_id == uuid.UUID(tenant_id))
        .order_by(Source.created_at.desc())
    )
    sources = result.scalars().all()

    return [
        SourceResponse(
            id=str(s.id),
            tenant_id=str(s.tenant_id),
            type=s.type.value,
            url=s.url,
            title=s.title,
            status=s.status.value,
            last_indexed_at=s.last_indexed_at.isoformat() if s.last_indexed_at else None,
            created_at=s.created_at.isoformat(),
        )
        for s in sources
    ]


@router.post("/", status_code=201)
async def create_source(
    body: SourceCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new source for a tenant."""
    tenant_uuid = uuid.UUID(body.tenant_id)

    tenant = await get_tenant_safe(db, body.tenant_id)

    source = Source(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        type=SourceType(body.type),
        url=body.url,
        title=body.title,
        content=body.content,
    )
    db.add(source)
    await db.flush()

    return SourceResponse(
        id=str(source.id),
        tenant_id=str(source.tenant_id),
        type=source.type.value,
        url=source.url,
        title=source.title,
        status=source.status.value,
        last_indexed_at=None,
        created_at=source.created_at.isoformat(),
    )


async def _ingest_source_background(source_id: uuid.UUID):
    """Background task to ingest a source."""
    async with async_session() as db:
        try:
            source = await db.get(Source, source_id)
            if not source:
                return

            # If URL source without content, scrape it first
            if source.type == SourceType.url and source.url and not source.content:
                scraped = await scrape_url(source.url)
                source.content = scraped["content"]
                if not source.title or source.title == source.url:
                    source.title = scraped["title"]
                await db.flush()

            count = await ingest_source(db, source)
            await db.commit()

            logger.info(
                "source_ingested",
                source_id=str(source_id),
                tenant_id=str(source.tenant_id),
                chunks=count,
            )
        except Exception as e:
            await db.rollback()
            logger.error(
                "source_ingestion_failed",
                source_id=str(source_id),
                error=str(e),
            )


@router.post("/{source_id}/ingest")
async def trigger_ingest(
    source_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger ingestion for a source (scrape + embed)."""
    source = await db.get(Source, uuid.UUID(source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    source.status = SourceStatus.pending
    await db.flush()

    background_tasks.add_task(_ingest_source_background, source.id)

    return {"status": "ingestion_started", "source_id": source_id}


@router.post("/scrape-site")
async def scrape_site(
    tenant_id: str,
    url: str,
    background_tasks: BackgroundTasks,
    fresh: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Scrape an entire site (via sitemap) and create sources for each page.
    
    If fresh=True, deletes all existing URL sources for this tenant first.
    Otherwise skips URLs that already exist.
    """
    tenant = await get_tenant_safe(db, tenant_id)
    tid = tenant.id

    if fresh:
        # Delete embeddings for URL sources, then delete the sources
        url_source_ids = (await db.execute(
            select(Source.id).where(Source.tenant_id == tid, Source.type == SourceType.url)
        )).scalars().all()
        if url_source_ids:
            await db.execute(sa_delete(Embedding).where(Embedding.source_id.in_(url_source_ids)))
            await db.execute(sa_delete(Source).where(Source.id.in_(url_source_ids)))
            await db.flush()
        logger.info("scrape_site_fresh_cleanup", tenant_id=str(tid), deleted=len(url_source_ids))

    # Get existing URLs to skip duplicates
    existing_urls = set((await db.execute(
        select(Source.url).where(Source.tenant_id == tid, Source.type == SourceType.url)
    )).scalars().all())

    urls = await scrape_sitemap(url)
    if not urls:
        urls = [url]

    created = []
    skipped = 0
    for page_url in urls:
        if page_url in existing_urls:
            skipped += 1
            continue
        source = Source(
            id=uuid.uuid4(),
            tenant_id=tid,
            type=SourceType.url,
            url=page_url,
            title=page_url,
        )
        db.add(source)
        await db.flush()
        created.append(str(source.id))
        background_tasks.add_task(_ingest_source_background, source.id)

    return {
        "status": "scraping_started",
        "sources_created": len(created),
        "skipped_existing": skipped,
        "source_ids": created,
    }


@router.delete("/{source_id}")
async def delete_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a source and its embeddings."""
    sid = uuid.UUID(source_id)
    source = await db.get(Source, sid)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    await db.execute(sa_delete(Embedding).where(Embedding.source_id == sid))
    await db.delete(source)
    await db.commit()
    return {"status": "deleted", "source_id": source_id}


@router.delete("/tenant/{tenant_id}/failed")
async def delete_failed_sources(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete all failed sources for a tenant."""
    tid = uuid.UUID(tenant_id)
    failed_ids = (await db.execute(
        select(Source.id).where(Source.tenant_id == tid, Source.status == SourceStatus.failed)
    )).scalars().all()
    if failed_ids:
        await db.execute(sa_delete(Embedding).where(Embedding.source_id.in_(failed_ids)))
        await db.execute(sa_delete(Source).where(Source.id.in_(failed_ids)))
        await db.commit()
    return {"status": "cleaned", "deleted": len(failed_ids)}
