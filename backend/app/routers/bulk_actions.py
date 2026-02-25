"""
Bulk Actions API — Cross-domain operations at scale.
Agency power tools for managing multiple sites at once.
"""
import uuid
import logging
from typing import Optional, List
from pydantic import BaseModel

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.services.bulk_actions import (
    bulk_reindex,
    transfer_knowledge,
    bulk_command,
    bulk_resolve_gap,
    get_available_actions,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/bulk",
    tags=["bulk-actions"],
    dependencies=[Depends(verify_admin_key)],
)


class BulkReindexRequest(BaseModel):
    client_account_id: str
    tenant_ids: Optional[List[str]] = None


class KnowledgeTransferRequest(BaseModel):
    from_tenant_id: str
    to_tenant_id: str
    source_types: Optional[List[str]] = None


class BulkCommandRequest(BaseModel):
    client_account_id: str
    command_type: str
    payload: dict = {}
    tenant_ids: Optional[List[str]] = None
    priority: int = 5


class BulkGapResolveRequest(BaseModel):
    client_account_id: str
    category: str
    answer: str
    resolved_by: str = "admin"


@router.get("/actions/{client_account_id}")
async def available_actions(
    client_account_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get available bulk actions with context for a client."""
    return await get_available_actions(db, uuid.UUID(client_account_id))


@router.post("/reindex")
async def trigger_bulk_reindex(
    body: BulkReindexRequest,
    db: AsyncSession = Depends(get_db),
):
    """Queue reindex for all (or selected) client domains."""
    return await bulk_reindex(db, uuid.UUID(body.client_account_id), body.tenant_ids)


@router.post("/transfer")
async def trigger_knowledge_transfer(
    body: KnowledgeTransferRequest,
    db: AsyncSession = Depends(get_db),
):
    """Copy knowledge sources from one domain to a sibling domain."""
    return await transfer_knowledge(
        db, uuid.UUID(body.from_tenant_id), uuid.UUID(body.to_tenant_id), body.source_types
    )


@router.post("/command")
async def trigger_bulk_command(
    body: BulkCommandRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a command to all (or selected) client WP sites."""
    return await bulk_command(
        db, uuid.UUID(body.client_account_id), body.command_type, body.payload,
        body.tenant_ids, body.priority,
    )


@router.post("/resolve-gaps")
async def trigger_bulk_gap_resolve(
    body: BulkGapResolveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Resolve all open gaps of a category across all client domains."""
    return await bulk_resolve_gap(
        db, uuid.UUID(body.client_account_id), body.category, body.answer, body.resolved_by,
    )
