"""
Command Queue Service — Centralized command processing for WordPress sites.

Handles:
- Queuing commands for sites
- Bulk command processing with deduplication
- Exponential backoff retry logic
- Priority-based execution
- Command result tracking
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from enum import Enum

from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tenant import Tenant

logger = logging.getLogger(__name__)


class CommandStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class CommandPriority(int, Enum):
    critical = 1  # Security, emergency fixes
    high = 2      # Plugin updates, config changes
    normal = 5    # Regular scans, reports
    low = 10      # Analytics, non-urgent


class CommandType(str, Enum):
    scan = "scan"
    report = "report"
    sync = "sync"
    heartbeat = "heartbeat"
    flush_cache = "flush_cache"
    update_config = "update_config"
    plugin_update = "plugin_update"
    security_scan = "security_scan"
    deep_scan = "deep_scan"
    custom = "custom"


async def queue_command(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    command_type: str,
    payload: Dict[str, Any],
    priority: int = CommandPriority.normal.value,
    scheduled_at: Optional[datetime] = None,
    deduplication_window: int = 300,  # 5 minutes
) -> uuid.UUID:
    """
    Queue a command for a tenant with optional deduplication.
    
    Args:
        db: Database session
        tenant_id: Target tenant UUID
        command_type: Type of command
        payload: Command data
        priority: Priority level (lower = higher priority)
        scheduled_at: When to execute (default: now)
        deduplication_window: Seconds to prevent duplicate commands
    
    Returns:
        Command UUID
    """
    from app.models.command_queue import CommandQueue
    
    # Check for duplicate commands within window
    if deduplication_window > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=deduplication_window)
        duplicate = await db.execute(
            select(CommandQueue).where(
                and_(
                    CommandQueue.tenant_id == tenant_id,
                    CommandQueue.command_type == command_type,
                    CommandQueue.status.in_([CommandStatus.pending, CommandStatus.processing]),
                    CommandQueue.created_at >= cutoff,
                )
            )
        )
        existing = duplicate.scalar_one_or_none()
        if existing:
            logger.info(f"[command_queue] Skipping duplicate command {command_type} for tenant {tenant_id}")
            return existing.id
    
    # Create new command
    command = CommandQueue(
        tenant_id=tenant_id,
        command_type=command_type,
        payload=payload,
        priority=priority,
        scheduled_at=scheduled_at or datetime.now(timezone.utc),
    )
    db.add(command)
    await db.flush()
    
    logger.info(f"[command_queue] Queued command {command_type} for tenant {tenant_id} (ID: {command.id})")
    return command.id


async def queue_bulk_commands(
    db: AsyncSession,
    tenant_ids: List[uuid.UUID],
    command_type: str,
    payload: Dict[str, Any],
    priority: int = CommandPriority.normal.value,
    scheduled_at: Optional[datetime] = None,
    batch_size: int = 100,
) -> List[uuid.UUID]:
    """
    Queue commands for multiple tenants efficiently.
    
    Args:
        db: Database session
        tenant_ids: List of target tenant UUIDs
        command_type: Type of command
        payload: Command data
        priority: Priority level
        scheduled_at: When to execute
        batch_size: Process in batches to avoid memory issues
    
    Returns:
        List of command UUIDs
    """
    from app.models.command_queue import CommandQueue
    
    command_ids = []
    
    # Process in batches
    for i in range(0, len(tenant_ids), batch_size):
        batch_tenant_ids = tenant_ids[i:i + batch_size]
        
        # Create commands for batch
        commands = []
        for tenant_id in batch_tenant_ids:
            command = CommandQueue(
                tenant_id=tenant_id,
                command_type=command_type,
                payload=payload,
                priority=priority,
                scheduled_at=scheduled_at or datetime.now(timezone.utc),
            )
            commands.append(command)
        
        db.add_all(commands)
        await db.flush()
        
        batch_ids = [cmd.id for cmd in commands]
        command_ids.extend(batch_ids)
        
        logger.info(f"[command_queue] Batch queued {len(batch_ids)} commands of type {command_type}")
    
    logger.info(f"[command_queue] Total queued {len(command_ids)} commands for bulk operation")
    return command_ids


async def get_pending_commands(
    db: AsyncSession,
    limit: int = 100,
    tenant_id: Optional[uuid.UUID] = None,
) -> List[Dict[str, Any]]:
    """
    Get pending commands ordered by priority and scheduled time.
    
    Args:
        db: Database session
        limit: Maximum commands to return
        tenant_id: Filter by specific tenant
    
    Returns:
        List of command dictionaries
    """
    from app.models.command_queue import CommandQueue
    
    query = select(CommandQueue).where(
        and_(
            CommandQueue.status == CommandStatus.pending,
            CommandQueue.scheduled_at <= datetime.now(timezone.utc),
        )
    )
    
    if tenant_id:
        query = query.where(CommandQueue.tenant_id == tenant_id)
    
    query = query.order_by(
        CommandQueue.priority.asc(),
        CommandQueue.scheduled_at.asc(),
        CommandQueue.created_at.asc(),
    ).limit(limit)
    
    result = await db.execute(query)
    commands = result.scalars().all()
    
    return [
        {
            "id": cmd.id,
            "tenant_id": cmd.tenant_id,
            "command_type": cmd.command_type,
            "payload": cmd.payload,
            "priority": cmd.priority,
            "retry_count": cmd.retry_count,
            "scheduled_at": cmd.scheduled_at.isoformat(),
        }
        for cmd in commands
    ]


async def mark_command_processing(
    db: AsyncSession,
    command_id: uuid.UUID,
) -> bool:
    """Mark a command as processing (atomically)."""
    from app.models.command_queue import CommandQueue
    
    result = await db.execute(
        update(CommandQueue)
        .where(
            and_(
                CommandQueue.id == command_id,
                CommandQueue.status == CommandStatus.pending,
            )
        )
        .values(
            status=CommandStatus.processing,
            executed_at=datetime.now(timezone.utc),
        )
        .returning(CommandQueue.id)
    )
    
    return result.scalar_one_or_none() is not None


async def complete_command(
    db: AsyncSession,
    command_id: uuid.UUID,
    result: Optional[Dict[str, Any]] = None,
    success: bool = True,
    error_message: Optional[str] = None,
) -> bool:
    """
    Mark a command as completed or failed.
    
    Args:
        db: Database session
        command_id: Command UUID
        result: Command result data
        success: Whether command succeeded
        error_message: Error message if failed
    
    Returns:
        True if updated, False if not found
    """
    from app.models.command_queue import CommandQueue
    
    status = CommandStatus.completed if success else CommandStatus.failed
    
    values = {
        "status": status,
        "result": result,
        "error_message": error_message,
    }
    
    if success:
        values["executed_at"] = datetime.now(timezone.utc)
    
    result = await db.execute(
        update(CommandQueue)
        .where(CommandQueue.id == command_id)
        .values(**values)
    )
    
    updated = result.rowcount > 0
    
    if updated:
        logger.info(f"[command_queue] Command {command_id} marked as {status}")
    
    return updated


async def retry_failed_commands(
    db: AsyncSession,
    max_retries: int = 3,
    backoff_multiplier: float = 2.0,
    base_delay: int = 60,  # 1 minute
) -> int:
    """
    Retry failed commands with exponential backoff.
    
    Args:
        db: Database session
        max_retries: Maximum retry attempts
        backoff_multiplier: Backoff multiplier for each retry
        base_delay: Base delay in seconds
    
    Returns:
        Number of commands retried
    """
    from app.models.command_queue import CommandQueue
    
    # Get failed commands that haven't exceeded max retries
    result = await db.execute(
        select(CommandQueue).where(
            and_(
                CommandQueue.status == CommandStatus.failed,
                CommandQueue.retry_count < max_retries,
            )
        )
    )
    commands = result.scalars().all()
    
    retried_count = 0
    
    for cmd in commands:
        # Calculate delay with exponential backoff
        delay = base_delay * (backoff_multiplier ** cmd.retry_count)
        scheduled_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
        
        # Reset to pending with new schedule
        await db.execute(
            update(CommandQueue)
            .where(CommandQueue.id == cmd.id)
            .values(
                status=CommandStatus.pending,
                retry_count=cmd.retry_count + 1,
                scheduled_at=scheduled_at,
                executed_at=None,
                error_message=None,
            )
        )
        
        retried_count += 1
        logger.info(f"[command_queue] Retrying command {cmd.id} (attempt {cmd.retry_count + 1}) in {delay}s")
    
    if retried_count > 0:
        logger.info(f"[command_queue] Retried {retried_count} failed commands")
    
    return retried_count


async def cleanup_old_commands(
    db: AsyncSession,
    days: int = 30,
) -> int:
    """
    Clean up old completed/failed commands.
    
    Args:
        db: Database session
        days: Keep commands newer than this many days
    
    Returns:
        Number of commands cleaned up
    """
    from app.models.command_queue import CommandQueue
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    result = await db.execute(
        delete(CommandQueue).where(
            and_(
                CommandQueue.status.in_([CommandStatus.completed, CommandStatus.failed]),
                CommandQueue.created_at < cutoff,
            )
        )
    )
    
    cleaned_count = result.rowcount
    
    if cleaned_count > 0:
        logger.info(f"[command_queue] Cleaned up {cleaned_count} old commands")
    
    return cleaned_count


async def get_command_stats(
    db: AsyncSession,
    tenant_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Get command queue statistics."""
    from app.models.command_queue import CommandQueue
    
    # Base query
    base_query = select(CommandQueue)
    if tenant_id:
        base_query = base_query.where(CommandQueue.tenant_id == tenant_id)
    
    # Status counts
    status_counts = {}
    for status in CommandStatus:
        result = await db.execute(
            select(func.count(CommandQueue.id))
            .where(and_(CommandQueue.status == status, *([CommandQueue.tenant_id == tenant_id] if tenant_id else [])))
        )
        status_counts[status.value] = result.scalar() or 0
    
    # Command type counts
    type_result = await db.execute(
        select(CommandQueue.command_type, func.count(CommandQueue.id))
        .where(*([CommandQueue.tenant_id == tenant_id] if tenant_id else []))
        .group_by(CommandQueue.command_type)
    )
    type_counts = dict(type_result.all())
    
    # Age stats
    pending_result = await db.execute(
        select(
            func.count(CommandQueue.id),
            func.avg(func.extract('epoch', datetime.now(timezone.utc) - CommandQueue.created_at))
        )
        .where(and_(
            CommandQueue.status == CommandStatus.pending,
            *([CommandQueue.tenant_id == tenant_id] if tenant_id else [])
        ))
    )
    pending_count, avg_age_seconds = pending_result.first() or (0, 0)
    
    return {
        "status_counts": status_counts,
        "type_counts": type_counts,
        "pending_count": pending_count,
        "avg_pending_age_seconds": float(avg_age_seconds) if avg_age_seconds else 0,
        "total": sum(status_counts.values()),
    }
