"""
Background scheduler for TinyEclipse.
Runs monitoring checks, AI learning loop, and command queue processing at configured intervals.
All optional service imports are LAZY (inside functions) to avoid crashing the app if a module is missing.
"""
import asyncio
import logging

from app.database import async_session
from app.services.monitor import run_due_checks

logger = logging.getLogger(__name__)

_scheduler_task = None
_learning_task = None
_command_queue_task = None
_cleanup_task = None


async def _monitoring_loop():
    """Main monitoring loop — runs every 60 seconds, checks which monitors are due."""
    logger.info("[scheduler] Monitoring scheduler started")
    while True:
        try:
            async with async_session() as db:
                results = await run_due_checks(db)
                if results:
                    logger.info(f"[scheduler] Completed {len(results)} checks")
        except Exception as e:
            logger.error(f"[scheduler] Error in monitoring loop: {e}")

        await asyncio.sleep(60)


async def _learning_loop():
    """AI Learning loop — runs every 5 minutes, processes stale conversations."""
    logger.info("[scheduler] AI Learning loop started")
    await asyncio.sleep(120)
    while True:
        try:
            from app.services.learning import process_stale_conversations
            async with async_session() as db:
                results = await process_stale_conversations(db, inactive_minutes=30)
                if results:
                    cached_total = sum(r.get("qa_cached", 0) for r in results)
                    gaps_total = sum(len(r.get("knowledge_gaps", [])) for r in results)
                    logger.info(f"[learning] Processed {len(results)} stale conversations, cached {cached_total} Q&A pairs, found {gaps_total} knowledge gaps")
                    try:
                        from app.services.event_bus import emit
                        await emit(db, domain="ai", action="learning_cycle", title=f"Learning cycle: {len(results)} conversations", severity="info", source="scheduler", data={"conversations": len(results), "qa_cached": cached_total, "gaps_found": gaps_total})
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"[scheduler] Error in learning loop: {e}")

        await asyncio.sleep(300)


async def _command_queue_loop():
    """Command queue maintenance loop — runs every 5 minutes."""
    logger.info("[scheduler] Command queue maintenance scheduler started")
    await asyncio.sleep(300)
    while True:
        try:
            from app.services.command_queue import retry_failed_commands, cleanup_old_commands
            async with async_session() as db:
                retried = await retry_failed_commands(db)
                if retried:
                    logger.info(f"[scheduler] Retried {retried} failed commands")
                cleaned = await cleanup_old_commands(db, days=7)
                if cleaned:
                    logger.info(f"[scheduler] Cleaned up {cleaned} old commands")
        except Exception as e:
            logger.error(f"[scheduler] Error in command queue loop: {e}")

        await asyncio.sleep(300)


async def _event_cleanup_loop():
    """Cleanup old system events — runs daily, removes events older than 90 days."""
    logger.info("[scheduler] Event cleanup scheduler started")
    await asyncio.sleep(3600)
    while True:
        try:
            from app.models.system_event import SystemEvent
            from sqlalchemy import delete
            from datetime import datetime, timezone, timedelta
            async with async_session() as db:
                cutoff = datetime.now(timezone.utc) - timedelta(days=90)
                result = await db.execute(
                    delete(SystemEvent).where(SystemEvent.created_at < cutoff)
                )
                cleaned = result.rowcount
                await db.commit()
                if cleaned:
                    logger.info(f"[scheduler] Cleaned up {cleaned} old system events (>90 days)")
        except Exception as e:
            logger.error(f"[scheduler] Error in event cleanup loop: {e}")

        await asyncio.sleep(86400)


def start_scheduler():
    """Start all background schedulers."""
    global _scheduler_task, _learning_task, _command_queue_task, _cleanup_task
    loop = asyncio.get_event_loop()
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = loop.create_task(_monitoring_loop())
        logger.info("[scheduler] Background monitoring scheduler started")
    if _learning_task is None or _learning_task.done():
        _learning_task = loop.create_task(_learning_loop())
        logger.info("[scheduler] Background AI learning loop started")
    if _command_queue_task is None or _command_queue_task.done():
        _command_queue_task = loop.create_task(_command_queue_loop())
        logger.info("[scheduler] Background command queue maintenance started")
    if _cleanup_task is None or _cleanup_task.done():
        _cleanup_task = loop.create_task(_event_cleanup_loop())
        logger.info("[scheduler] Background event cleanup started")


def stop_scheduler():
    """Stop all background schedulers."""
    global _scheduler_task, _learning_task, _command_queue_task, _cleanup_task
    for name, task in [("monitoring", _scheduler_task), ("learning", _learning_task), ("command_queue", _command_queue_task), ("cleanup", _cleanup_task)]:
        if task and not task.done():
            task.cancel()
            logger.info(f"[scheduler] Background {name} scheduler stopped")
