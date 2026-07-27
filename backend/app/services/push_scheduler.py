"""APScheduler setup for web push inactivity/interview reminders.

Mirrors scraper/scheduler.py's structure and telegram-bot/notifications.py's
schedule (10:00 and 18:00 Almaty time).
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.push_service import run_all_push_checks

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="Asia/Almaty")
    return _scheduler


def start_push_scheduler() -> AsyncIOScheduler:
    scheduler = get_scheduler()
    if scheduler.running:
        return scheduler

    scheduler.add_job(
        run_all_push_checks,
        trigger="cron",
        hour="10,18",
        id="vizora_web_push_notifications",
        replace_existing=True,
        misfire_grace_time=1800,
    )

    scheduler.start()
    logger.info("Push scheduler started: checks at 10:00 and 18:00 Almaty time.")
    return scheduler


def stop_push_scheduler() -> None:
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Push scheduler stopped")
