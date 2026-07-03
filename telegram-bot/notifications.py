"""
Vizora AI — Notification scheduler

Sends Telegram reminders to students based on interview dates and activity.
Can run as a standalone process or be imported and started from bot.py.

Usage:
  python notifications.py
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://vizora.kz")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000")
NOTIFICATION_SECRET = os.getenv("NOTIFICATION_SECRET", "")

# Kazakhstan Standard Time: UTC+5, no DST
KZ_TZ = timezone(timedelta(hours=5))
QUIET_HOUR_START = 22  # 10pm
QUIET_HOUR_END = 8    # 8am

logger = logging.getLogger(__name__)


def _is_quiet_hours() -> bool:
    """Return True during quiet hours in Kazakhstan (22:00–08:00 KZ time)."""
    hour = datetime.now(KZ_TZ).hour
    return hour >= QUIET_HOUR_START or hour < QUIET_HOUR_END


async def _send_message(
    telegram_id: int,
    text: str,
    button_text: str | None = None,
    button_url: str | None = None,
) -> bool:
    """Send a message through Telegram Bot API.

    Uses JSON body throughout. Inline buttons use the 'url' type — 'web_app'
    is only valid inside an active Mini App session, not in proactive messages.
    """
    payload: dict = {
        "chat_id": telegram_id,
        "text": text,
        "parse_mode": "Markdown",
    }
    if button_text and button_url:
        payload["reply_markup"] = {
            "inline_keyboard": [[{"text": button_text, "url": button_url}]]
        }

    api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(api_url, json=payload)
            if r.status_code != 200:
                logger.warning(f"Telegram API returned {r.status_code} for chat_id={telegram_id}: {r.text}")
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Failed to send to telegram_id={telegram_id}: {e}")
        return False


async def _get_students(notification_type: str) -> list[dict]:
    """Fetch students needing a specific notification from the backend."""
    if not NOTIFICATION_SECRET:
        logger.warning("NOTIFICATION_SECRET not set — skipping notification check")
        return []
    headers = {"X-Notification-Secret": NOTIFICATION_SECRET}
    url = f"{BACKEND_API_URL}/api/internal/notifications/due?type={notification_type}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=headers)
            if r.status_code == 200:
                return r.json().get("students", [])
            logger.warning(f"Backend returned {r.status_code} for type={notification_type}")
    except Exception as e:
        logger.error(f"Error fetching students for {notification_type}: {e}")
    return []


async def send_3day_reminders() -> None:
    """3 days before interview, if zero simulator sessions."""
    if _is_quiet_hours():
        return
    students = await _get_students("interview_3days")
    for s in students:
        name = s.get("name", "студент")
        await _send_message(
            s["telegram_id"],
            (
                f"🔔 *Напоминание от Vizora AI*\n\n"
                f"Привет, {name}! До твоего интервью осталось *3 дня*.\n"
                f"Ты ещё не прошёл ни одной тренировки с симулятором.\n\n"
                f"Самое время попрактиковаться 💪"
            ),
            button_text="🎤 Открыть симулятор",
            button_url=f"{MINI_APP_URL}/simulator",
        )
        logger.info(f"3-day reminder → telegram_id={s['telegram_id']}")


async def send_1day_reminders() -> None:
    """1 day before interview — always send encouragement."""
    if _is_quiet_hours():
        return
    students = await _get_students("interview_1day")
    for s in students:
        name = s.get("name", "студент")
        await _send_message(
            s["telegram_id"],
            (
                f"🍀 *Удачи завтра, {name}!*\n\n"
                f"Завтра твоё интервью в консульстве. Ты готов!\n\n"
                f"*Последние советы:*\n"
                f"• Приходи за 30 минут до назначенного времени\n"
                f"• Отвечай уверенно и по существу\n"
                f"• Если не понял вопрос — попроси повторить\n"
                f"• Vizora AI верит в тебя! 🚀"
            ),
        )
        logger.info(f"1-day reminder → telegram_id={s['telegram_id']}")


async def send_roadmap_stuck_reminders() -> None:
    """No roadmap activity for 7 days."""
    if _is_quiet_hours():
        return
    students = await _get_students("roadmap_stuck")
    for s in students:
        name = s.get("name", "студент")
        await _send_message(
            s["telegram_id"],
            (
                f"📍 *{name}, ты пропустил неделю!*\n\n"
                f"Ты не заходил в Vizora AI уже 7 дней.\n"
                f"Не останавливайся — продолжи готовиться к интервью."
            ),
            button_text="🗺️ Продолжить подготовку",
            button_url=f"{MINI_APP_URL}/roadmap",
        )
        logger.info(f"Roadmap-stuck reminder → telegram_id={s['telegram_id']}")


async def run_all() -> None:
    logger.info("Running notification checks...")
    await asyncio.gather(
        send_3day_reminders(),
        send_1day_reminders(),
        send_roadmap_stuck_reminders(),
    )
    logger.info("Notification checks done.")


def start_scheduler() -> AsyncIOScheduler:
    """Start APScheduler: runs at 10:00 and 18:00 Almaty time every day."""
    scheduler = AsyncIOScheduler(timezone="Asia/Almaty")
    scheduler.add_job(run_all, "cron", hour="10,18", id="vizora_notifications")
    scheduler.start()
    logger.info("Scheduler started: checks at 10:00 and 18:00 Almaty time.")
    return scheduler


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s - %(levelname)s - %(message)s",
        level=logging.INFO,
    )

    async def _main() -> None:
        scheduler = start_scheduler()
        await run_all()  # Run once on startup
        try:
            while True:
                await asyncio.sleep(3600)
        except (KeyboardInterrupt, SystemExit):
            scheduler.shutdown()
            logger.info("Scheduler stopped.")

    asyncio.run(_main())
