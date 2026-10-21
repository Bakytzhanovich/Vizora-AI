"""Referral program logic — code generation, reward tiers, reward granting."""
import random
import string
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.referral import Referral, ReferralCode, ReferralReward
from app.models.user import User

REWARD_TIERS: list[dict[str, Any]] = [
    {
        "referrals_needed": 1,
        "reward": "1 дополнительная сессия симулятора",
        "reward_type": "simulator_session",
        "reward_value": 1,
    },
    {
        "referrals_needed": 3,
        "reward": "Скидка 30% на любой пакет",
        "reward_type": "discount",
        "reward_value": 30,
    },
    {
        "referrals_needed": 5,
        "reward": "Месяц безлимитного доступа",
        "reward_type": "unlimited_access",
        "reward_value": 30,
    },
    {
        "referrals_needed": 10,
        "reward": "Полный доступ навсегда + badge «Амбассадор»",
        "reward_type": "lifetime_access",
        "reward_value": None,
    },
]

WELCOME_BONUS = {
    "reward": "1 бесплатная сессия симулятора (приветственный бонус)",
    "reward_type": "welcome_simulator_session",
    "reward_value": 1,
}


def _random_suffix(n: int = 4) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=n))


def generate_code_string(name: str = "") -> str:
    # ASCII-only for URL-safe codes
    prefix = "".join(c for c in name.upper() if c.isalpha() and c.isascii())[:4]
    if not prefix:
        prefix = _random_suffix(4)
    suffix = _random_suffix(3)
    return f"{prefix}{suffix}"


async def _insert_new_code(user_id: str, name: str, db: AsyncSession) -> str:
    """Generates a free code and inserts it. Raises IntegrityError (caller's
    problem to handle) if the insert itself fails — e.g. a FK violation."""
    for _ in range(10):
        code = generate_code_string(name)
        clash = await db.scalar(select(ReferralCode).where(ReferralCode.code == code))
        if not clash:
            break
    else:
        code = f"VZ{_random_suffix(6)}"  # very unlikely fallback

    db.add(ReferralCode(user_id=user_id, code=code))
    await db.commit()
    return code


async def get_or_create_code(user_id: str, name: str, db: AsyncSession) -> str:
    existing = await db.scalar(
        select(ReferralCode).where(ReferralCode.user_id == user_id)
    )
    if existing:
        return existing.code

    # Observed intermittently in practice: this runs moments after a fresh
    # registration and the INSERT can hit a ForeignKeyViolation as if the
    # just-committed users row isn't visible yet. Retries have always
    # succeeded within 1-2 attempts in testing — cheaper than root-causing
    # the exact visibility gap. Also covers the FK's own uniqueness
    # constraint racing against a concurrent request for the same user.
    for _ in range(2):  # up to 3 attempts total: these 2 catch IntegrityError and retry,
                        # the final unguarded attempt below lets it propagate
        try:
            return await _insert_new_code(user_id, name, db)
        except IntegrityError:
            await db.rollback()
            existing = await db.scalar(
                select(ReferralCode).where(ReferralCode.user_id == user_id)
            )
            if existing:
                return existing.code

    return await _insert_new_code(user_id, name, db)


async def count_completed_referrals(referrer_id: str, db: AsyncSession) -> int:
    result = await db.scalar(
        select(func.count()).where(
            and_(
                Referral.referrer_id == referrer_id,
                Referral.status == "completed",
            )
        )
    )
    return result or 0


# Far enough to read as "forever" while staying a plain date the plan logic
# already understands.
LIFETIME_PERIOD_END = datetime(2100, 1, 1)


def _extend_premium(user: User, days: int | None) -> None:
    """Month or lifetime Premium from a reward. A running paid period is
    extended rather than replaced, so the student never loses days they paid for."""
    now = datetime.utcnow()
    running = (
        user.subscription_plan in ("standard", "premium")
        and user.subscription_period_end
        and user.subscription_period_end > now
    )
    base = user.subscription_period_end if running else now
    user.subscription_plan = "premium"
    user.subscription_status = "active"
    user.subscription_period_end = LIFETIME_PERIOD_END if days is None else max(base, now) + timedelta(days=days)


async def check_and_grant_rewards(
    referrer_id: str, completed_count: int, db: AsyncSession
) -> list[dict[str, Any]]:
    """Grant all tiers up to completed_count that haven't been granted yet.
    Access tiers take effect right here; sessions and the discount are read
    from the reward rows by subscription_service and routers/payments.py."""
    granted = []
    referrer = await db.get(User, referrer_id)
    for tier in REWARD_TIERS:
        if completed_count < tier["referrals_needed"]:
            continue
        existing = await db.scalar(
            select(ReferralReward).where(
                and_(
                    ReferralReward.user_id == referrer_id,
                    ReferralReward.reward_type == tier["reward_type"],
                )
            )
        )
        if not existing:
            db.add(
                ReferralReward(
                    user_id=referrer_id,
                    reward_type=tier["reward_type"],
                    reward_value=tier["reward_value"],
                    description=tier["reward"],
                    status="earned",
                )
            )
            if referrer and tier["reward_type"] in ("unlimited_access", "lifetime_access"):
                _extend_premium(referrer, tier["reward_value"])
            granted.append(tier)
    if granted:
        await db.commit()
    return granted


async def complete_referral_on_payment(referred_id: str, db: AsyncSession) -> None:
    """A referral counts once the invited student pays: counting sign-ups let
    anyone farm lifetime access with throwaway accounts."""
    referral = await db.scalar(
        select(Referral).where(Referral.referred_id == referred_id, Referral.status == "pending")
    )
    if not referral:
        return
    referral.status = "completed"
    referral.completed_at = datetime.utcnow()
    await db.commit()
    completed = await count_completed_referrals(referral.referrer_id, db)
    await check_and_grant_rewards(referral.referrer_id, completed, db)


async def bonus_sessions(user_id: str, db: AsyncSession) -> int:
    """Extra simulator sessions from the welcome bonus and the first tier."""
    total = await db.scalar(
        select(func.sum(ReferralReward.reward_value)).where(
            ReferralReward.user_id == user_id,
            ReferralReward.reward_type.in_(("simulator_session", WELCOME_BONUS["reward_type"])),
        )
    )
    return total or 0


async def unused_referral_discount(user_id: str, db: AsyncSession) -> ReferralReward | None:
    return await db.scalar(
        select(ReferralReward).where(
            ReferralReward.user_id == user_id,
            ReferralReward.reward_type == "discount",
            ReferralReward.status == "earned",
        )
    )


async def grant_welcome_bonus(referred_id: str, db: AsyncSession) -> None:
    existing = await db.scalar(
        select(ReferralReward).where(
            and_(
                ReferralReward.user_id == referred_id,
                ReferralReward.reward_type == WELCOME_BONUS["reward_type"],
            )
        )
    )
    if not existing:
        db.add(
            ReferralReward(
                user_id=referred_id,
                reward_type=WELCOME_BONUS["reward_type"],
                reward_value=WELCOME_BONUS["reward_value"],
                description=WELCOME_BONUS["reward"],
                status="earned",
            )
        )
        await db.commit()


def next_tier(completed: int) -> dict[str, Any] | None:
    for tier in REWARD_TIERS:
        if completed < tier["referrals_needed"]:
            return tier
    return None
