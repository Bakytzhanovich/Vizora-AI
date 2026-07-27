"""APScheduler jobs resetting usage counters: sessions monthly, FAQ daily.

Mirrors scraper/scheduler.py and app/services/push_scheduler.py's structure.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="Asia/Almaty")
    return _scheduler


async def reset_monthly_sessions() -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(text("UPDATE users SET sessions_used_this_month = 0"))
        await db.commit()
    logger.info("Monthly simulator session counters reset")


async def reset_daily_faq() -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            text("UPDATE users SET faq_used_today = 0, faq_reset_date = CURRENT_DATE")
        )
        await db.commit()
    logger.info("Daily FAQ counters reset")


def start_subscription_scheduler() -> AsyncIOScheduler:
    scheduler = get_scheduler()
    if scheduler.running:
        return scheduler

    scheduler.add_job(
        reset_monthly_sessions,
        trigger="cron",
        day=1,
        hour=0,
        id="monthly_session_reset",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        reset_daily_faq,
        trigger="cron",
        hour=0,
        id="daily_faq_reset",
        replace_existing=True,
        misfire_grace_time=1800,
    )

    scheduler.start()
    logger.info("Subscription scheduler started: monthly sessions (day=1 00:00), daily FAQ (00:00) Almaty time")
    return scheduler


def stop_subscription_scheduler() -> None:
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Subscription scheduler stopped")
