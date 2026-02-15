"""
Background scheduler for TinyEclipse monitoring.
Runs monitoring checks at their configured intervals automatically.
"""
import asyncio
import logging

from app.database import async_session
from app.services.monitor import run_due_checks

logger = logging.getLogger(__name__)

_scheduler_task = None


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


def start_scheduler():
    """Start the background monitoring scheduler."""
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        loop = asyncio.get_event_loop()
        _scheduler_task = loop.create_task(_monitoring_loop())
        logger.info("[scheduler] Background monitoring scheduler started")


def stop_scheduler():
    """Stop the background monitoring scheduler."""
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("[scheduler] Background monitoring scheduler stopped")
