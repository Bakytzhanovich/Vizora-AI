"""APScheduler setup for monthly knowledge base updates."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from scraper.pipeline import run_scraping_pipeline

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="Asia/Almaty")
    return _scheduler


def start_kb_scheduler() -> AsyncIOScheduler:
    """Start the monthly scraping job. Called once at app startup."""
    scheduler = get_scheduler()
    if scheduler.running:
        return scheduler

    scheduler.add_job(
        run_scraping_pipeline,
        trigger="cron",
        day=1,
        hour=3,
        minute=0,
        id="monthly_kb_update",
        replace_existing=True,
        misfire_grace_time=3600,  # allow 1h late start
    )

    scheduler.start()
    logger.info("KB scheduler started: monthly run on day=1 at 03:00 Almaty")
    return scheduler


def stop_kb_scheduler() -> None:
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("KB scheduler stopped")
