"""
Background scheduler for TinyEclipse.
Runs monitoring checks and AI learning loop at configured intervals.
"""
import asyncio
import logging

from app.database import async_session
from app.services.monitor import run_due_checks

logger = logging.getLogger(__name__)

_scheduler_task = None
_learning_task = None


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
    await asyncio.sleep(120)  # Wait 2 min after startup before first run
    while True:
        try:
            from app.services.learning import process_stale_conversations
            async with async_session() as db:
                results = await process_stale_conversations(db, inactive_minutes=30)
                if results:
                    cached_total = sum(r.get("qa_cached", 0) for r in results)
                    gaps_total = sum(len(r.get("knowledge_gaps", [])) for r in results)
                    logger.info(f"[learning] Processed {len(results)} stale conversations, cached {cached_total} Q&A pairs, found {gaps_total} knowledge gaps")
        except Exception as e:
            logger.error(f"[scheduler] Error in learning loop: {e}")

        await asyncio.sleep(300)  # Every 5 minutes


def start_scheduler():
    """Start the background monitoring and learning schedulers."""
    global _scheduler_task, _learning_task
    loop = asyncio.get_event_loop()
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = loop.create_task(_monitoring_loop())
        logger.info("[scheduler] Background monitoring scheduler started")
    if _learning_task is None or _learning_task.done():
        _learning_task = loop.create_task(_learning_loop())
        logger.info("[scheduler] Background AI learning loop started")


def stop_scheduler():
    """Stop all background schedulers."""
    global _scheduler_task, _learning_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("[scheduler] Background monitoring scheduler stopped")
    if _learning_task and not _learning_task.done():
        _learning_task.cancel()
        logger.info("[scheduler] Background AI learning loop stopped")
