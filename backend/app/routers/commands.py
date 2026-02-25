"""
Commands API — Queue and manage commands for WordPress sites.

Provides:
- Queue commands for individual sites
- Bulk command operations
- Command queue monitoring
- Command retry and cleanup
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant
from app.services.command_queue import (
    queue_command, queue_bulk_commands, get_pending_commands,
    mark_command_processing, complete_command, retry_failed_commands,
    cleanup_old_commands, get_command_stats, CommandPriority, CommandType
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/commands",
    tags=["admin-commands"],
    dependencies=[Depends(verify_admin_key)],
)


# ─── Request Models ───

class CommandCreate(BaseModel):
    tenant_id: str
    command_type: str
    payload: Dict
    priority: int = CommandPriority.normal.value
    scheduled_at: Optional[str] = None  # ISO datetime
    deduplication_window: int = 300  # 5 minutes


class BulkCommandCreate(BaseModel):
    tenant_ids: List[str]
    command_type: str
    payload: Dict
    priority: int = CommandPriority.normal.value
    scheduled_at: Optional[str] = None
    batch_size: int = 100


class CommandRetry(BaseModel):
    command_id: str
    max_retries: int = 3
    backoff_multiplier: float = 2.0
    base_delay: int = 60


# ─── Queue Commands ───

@router.post("/queue", status_code=201)
async def queue_single_command(
    body: CommandCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Queue a command for a single tenant."""
    try:
        tenant_id = uuid.UUID(body.tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant_id")
    
    # Verify tenant exists
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Parse scheduled_at
    scheduled_at = None
    if body.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(body.scheduled_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at format")
    
    # Queue command
    command_id = await queue_command(
        db=db,
        tenant_id=tenant_id,
        command_type=body.command_type,
        payload=body.payload,
        priority=body.priority,
        scheduled_at=scheduled_at,
        deduplication_window=body.deduplication_window,
    )
    
    return {
        "status": "queued",
        "command_id": str(command_id),
        "tenant_id": body.tenant_id,
        "command_type": body.command_type,
        "priority": body.priority,
    }


@router.post("/queue/bulk", status_code=201)
async def queue_bulk_commands(
    body: BulkCommandCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Queue commands for multiple tenants."""
    # Validate tenant IDs
    tenant_uuids = []
    for tid in body.tenant_ids:
        try:
            tenant_uuids.append(uuid.UUID(tid))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid tenant_id: {tid}")
    
    # Verify all tenants exist
    result = await db.execute(
        select(Tenant.id).where(Tenant.id.in_(tenant_uuids))
    )
    existing_ids = {str(row[0]) for row in result.all()}
    
    missing = set(body.tenant_ids) - existing_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Tenants not found: {', '.join(missing)}")
    
    # Parse scheduled_at
    scheduled_at = None
    if body.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(body.scheduled_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at format")
    
    # Queue bulk commands
    command_ids = await queue_bulk_commands(
        db=db,
        tenant_ids=tenant_uuids,
        command_type=body.command_type,
        payload=body.payload,
        priority=body.priority,
        scheduled_at=scheduled_at,
        batch_size=body.batch_size,
    )
    
    return {
        "status": "queued",
        "command_count": len(command_ids),
        "tenant_count": len(body.tenant_ids),
        "command_type": body.command_type,
        "command_ids": [str(cid) for cid in command_ids],
    }


# ─── Queue Management ───

@router.get("/queue")
async def get_queue(
    limit: int = Query(default=100, le=1000),
    tenant_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Get pending commands from the queue."""
    tenant_uuid = None
    if tenant_id:
        try:
            tenant_uuid = uuid.UUID(tenant_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid tenant_id")
    
    commands = await get_pending_commands(
        db=db,
        limit=limit,
        tenant_id=tenant_uuid,
    )
    
    return {
        "total": len(commands),
        "commands": commands,
    }


@router.post("/{command_id}/retry")
async def retry_command(
    command_id: str,
    body: CommandRetry,
    db: AsyncSession = Depends(get_db),
):
    """Retry a failed command."""
    try:
        cmd_uuid = uuid.UUID(command_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid command_id")
    
    retried = await retry_failed_commands(
        db=db,
        max_retries=body.max_retries,
        backoff_multiplier=body.backoff_multiplier,
        base_delay=body.base_delay,
    )
    
    return {
        "status": "retried",
        "commands_retried": retried,
    }


@router.post("/retry/all")
async def retry_all_failed(
    max_retries: int = 3,
    backoff_multiplier: float = 2.0,
    base_delay: int = 60,
    db: AsyncSession = Depends(get_db),
):
    """Retry all failed commands in the queue."""
    retried = await retry_failed_commands(
        db=db,
        max_retries=max_retries,
        backoff_multiplier=backoff_multiplier,
        base_delay=base_delay,
    )
    
    return {
        "status": "retried",
        "commands_retried": retried,
    }


@router.delete("/cleanup")
async def cleanup_old(
    days: int = Query(default=30, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Clean up old completed/failed commands."""
    cleaned = await cleanup_old_commands(db=db, days=days)
    
    return {
        "status": "cleaned",
        "commands_cleaned": cleaned,
        "days_kept": days,
    }


# ─── Statistics ───

@router.get("/stats")
async def get_queue_stats(
    tenant_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Get command queue statistics."""
    tenant_uuid = None
    if tenant_id:
        try:
            tenant_uuid = uuid.UUID(tenant_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid tenant_id")
    
    stats = await get_command_stats(db=db, tenant_id=tenant_uuid)
    
    return stats


@router.get("/stats/summary")
async def get_global_stats(db: AsyncSession = Depends(get_db)):
    """Get global command queue statistics."""
    # Get tenant count
    tenant_result = await db.execute(select(func.count(Tenant.id)))
    tenant_count = tenant_result.scalar() or 0
    
    # Get queue stats
    stats = await get_command_stats(db=db)
    
    return {
        "tenant_count": tenant_count,
        "queue_stats": stats,
        "health": "healthy" if stats["pending_count"] < 100 else "warning",
    }


# ─── Site Command Polling (for WordPress sites) ───

public_router = APIRouter(prefix="/api/commands", tags=["commands"])


@public_router.get("/{tenant_id}/poll")
async def poll_commands(
    tenant_id: str,
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Poll for pending commands for a specific tenant.
    Called by WordPress sites to get their command queue.
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant_id")
    
    # Verify tenant exists
    tenant = await db.get(Tenant, tenant_uuid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get pending commands
    commands = await get_pending_commands(
        db=db,
        limit=limit,
        tenant_id=tenant_uuid,
    )
    
    # Mark commands as processing
    processed_ids = []
    for cmd in commands:
        if await mark_command_processing(db, cmd["id"]):
            processed_ids.append(str(cmd["id"]))
    
    return {
        "commands": [cmd for cmd in commands if str(cmd["id"]) in processed_ids],
        "count": len(processed_ids),
        "tenant_id": tenant_id,
    }


@public_router.post("/{command_id}/result")
async def report_command_result(
    command_id: str,
    result: Dict,
    success: bool = True,
    error_message: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Report the result of a command execution.
    Called by WordPress sites after completing a command.
    """
    try:
        cmd_uuid = uuid.UUID(command_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid command_id")
    
    updated = await complete_command(
        db=db,
        command_id=cmd_uuid,
        result=result,
        success=success,
        error_message=error_message,
    )
    
    if not updated:
        raise HTTPException(status_code=404, detail="Command not found")
    
    return {
        "status": "reported",
        "command_id": command_id,
        "success": success,
    }
