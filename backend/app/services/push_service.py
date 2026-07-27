"""Web Push (VAPID) notifications for users without a linked Telegram account.

Mirrors telegram-bot/notifications.py's structure and thresholds (3-day /
1-day interview reminders, 7-day roadmap-stuck nudge) but delivers via the
browser Push API instead of the Telegram Bot API, and runs in-process since
the backend already owns the DB (no separate bot process needed).
"""

import asyncio
import json
import logging
from datetime import date, datetime, timedelta

from pywebpush import WebPushException, webpush
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.profile import StudentProfile
from app.models.push_subscription import PushSubscription
from app.models.roadmap import RoadmapProgress
from app.models.simulator import SimulatorSession
from app.models.user import User

logger = logging.getLogger(__name__)


async def send_push(subscription: PushSubscription, title: str, body: str, url: str = "/") -> bool:
    """Send a single push message. Returns False (and deletes the subscription)
    if the browser reports it as gone (410/404) — matches how browsers signal
    that a subscription has expired or been revoked."""
    payload = json.dumps({"title": title, "body": body, "url": url})
    subscription_info = {
        "endpoint": subscription.endpoint,
        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
    }
    try:
        await asyncio.to_thread(
            webpush,
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}"},
        )
        return True
    except WebPushException as e:
        status_code = e.response.status_code if e.response is not None else None
        if status_code in (404, 410):
            logger.info("Push subscription gone, removing: %s", subscription.id)
            async with AsyncSessionLocal() as db:
                sub = await db.get(PushSubscription, subscription.id)
                if sub:
                    await db.delete(sub)
                    await db.commit()
        else:
            logger.warning("Push send failed for %s: %s", subscription.id, e)
        return False


async def _send_to_user(db: AsyncSession, user_id: str, title: str, body: str, url: str = "/") -> None:
    subs = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))).scalars().all()
    for sub in subs:
        await send_push(sub, title, body, url)


async def send_interview_3day_reminders(db: AsyncSession) -> None:
    target_date = date.today() + timedelta(days=3)
    has_session_subq = (
        select(SimulatorSession.user_id).where(SimulatorSession.completed == True).distinct().scalar_subquery()
    )
    has_push_subq = select(PushSubscription.user_id).distinct().scalar_subquery()
    rows = await db.execute(
        select(User, StudentProfile)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .where(
            and_(
                User.id.in_(has_push_subq),
                StudentProfile.interview_date == target_date,
                User.id.not_in(has_session_subq),
            )
        )
    )
    for user, profile in rows:
        name = profile.name.split()[0]
        await _send_to_user(
            db,
            user.id,
            "До интервью 3 дня",
            f"{name}, ты ещё не прошёл ни одной тренировки. Самое время попрактиковаться в симуляторе.",
            "/simulator",
        )


async def send_interview_1day_reminders(db: AsyncSession) -> None:
    target_date = date.today() + timedelta(days=1)
    has_push_subq = select(PushSubscription.user_id).distinct().scalar_subquery()
    rows = await db.execute(
        select(User, StudentProfile)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .where(and_(User.id.in_(has_push_subq), StudentProfile.interview_date == target_date))
    )
    for user, profile in rows:
        name = profile.name.split()[0]
        await _send_to_user(
            db,
            user.id,
            "Удачи завтра!",
            f"{name}, завтра твоё интервью в консульстве. Ты готов — Vizora AI верит в тебя!",
            "/dashboard",
        )


async def send_roadmap_stuck_reminders(db: AsyncSession) -> None:
    cutoff = datetime.utcnow() - timedelta(days=7)
    active_subq = select(RoadmapProgress.user_id).where(RoadmapProgress.created_at >= cutoff).distinct().scalar_subquery()
    has_push_subq = select(PushSubscription.user_id).distinct().scalar_subquery()
    rows = await db.execute(
        select(User, StudentProfile)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .where(and_(User.id.in_(has_push_subq), User.id.not_in(active_subq)))
    )
    for user, profile in rows:
        name = profile.name.split()[0]
        await _send_to_user(
            db,
            user.id,
            "Мы скучаем!",
            f"{name}, ты не заходил в Vizora AI уже 7 дней. Не останавливайся — продолжи готовиться к интервью.",
            "/roadmap",
        )


async def run_all_push_checks() -> None:
    if not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not set — skipping web push checks")
        return
    logger.info("Running web push notification checks...")
    async with AsyncSessionLocal() as db:
        await send_interview_3day_reminders(db)
        await send_interview_1day_reminders(db)
        await send_roadmap_stuck_reminders(db)
    logger.info("Web push notification checks done.")
