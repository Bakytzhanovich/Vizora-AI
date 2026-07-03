from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.profile import StudentProfile
from app.models.referral import Referral, ReferralCode, ReferralReward
from app.models.user import User
from app.services.referral_service import (
    REWARD_TIERS,
    get_or_create_code,
    count_completed_referrals,
    next_tier,
)

router = APIRouter(prefix="/referral", tags=["referral"])

APP_URL = getattr(settings, "APP_URL", "http://localhost:3000")


def _make_link(code: str) -> str:
    return f"{APP_URL}/register?ref={code}"


@router.get("/my-code")
async def my_code(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Get user's name from profile (best-effort)
    profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    name = profile.name if profile else ""

    code = await get_or_create_code(user_id, name, db)
    link = _make_link(code)

    # Stats
    total_invited = await db.scalar(
        select(func.count()).where(Referral.referrer_id == user_id)
    ) or 0
    total_registered = total_invited  # registered = created referral record
    total_active = await count_completed_referrals(user_id, db)

    rewards = await db.scalars(
        select(ReferralReward).where(ReferralReward.user_id == user_id)
    )
    rewards_list = [
        {
            "reward_type": r.reward_type,
            "description": r.description,
            "reward_value": r.reward_value,
            "status": r.status,
            "earned_at": r.earned_at.isoformat(),
        }
        for r in rewards
        if r.reward_type != "welcome_simulator_session"
    ]

    nt = next_tier(total_active)

    return {
        "code": code,
        "link": link,
        "stats": {
            "total_invited": total_invited,
            "total_registered": total_registered,
            "total_active": total_active,
            "rewards": rewards_list,
            "next_tier": nt,
            "tiers": REWARD_TIERS,
        },
    }


class ApplyCodeBody(BaseModel):
    referral_code: str


@router.post("/apply")
async def apply_code(
    body: ApplyCodeBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    code = body.referral_code.strip().upper()

    ref_code_row = await db.scalar(
        select(ReferralCode).where(ReferralCode.code == code)
    )
    if not ref_code_row:
        raise HTTPException(status_code=404, detail="Реферальный код не найден")

    if ref_code_row.user_id == user_id:
        raise HTTPException(status_code=400, detail="Нельзя использовать собственный код")

    existing = await db.scalar(
        select(Referral).where(Referral.referred_id == user_id)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ты уже использовал реферальный код")

    referrer_profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == ref_code_row.user_id)
    )
    referrer_name = referrer_profile.name if referrer_profile else "Друг"

    from app.models.referral import Referral as ReferralModel
    db.add(
        ReferralModel(
            referrer_id=ref_code_row.user_id,
            referred_id=user_id,
            referral_code=code,
            status="pending",
        )
    )
    await db.commit()
    return {"success": True, "referrer_name": referrer_name}


@router.get("/stats")
async def get_stats(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total_invited = await db.scalar(
        select(func.count()).where(Referral.referrer_id == user_id)
    ) or 0
    total_registered = total_invited
    total_active = await count_completed_referrals(user_id, db)

    rewards = list(await db.scalars(
        select(ReferralReward).where(
            and_(
                ReferralReward.user_id == user_id,
                ReferralReward.reward_type != "welcome_simulator_session",
            )
        )
    ))
    earned = [r for r in rewards if r.status == "earned"]
    pending_tiers = [
        t for t in REWARD_TIERS
        if not any(r.reward_type == t["reward_type"] for r in earned)
    ]

    return {
        "total_invited": total_invited,
        "total_registered": total_registered,
        "total_active": total_active,
        "rewards_earned": [
            {"reward_type": r.reward_type, "description": r.description, "status": r.status}
            for r in earned
        ],
        "pending_rewards": pending_tiers,
        "next_tier": next_tier(total_active),
    }


@router.get("/leaderboard")
async def leaderboard(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            Referral.referrer_id,
            func.count(Referral.id).label("count"),
        )
        .where(Referral.status == "completed")
        .group_by(Referral.referrer_id)
        .order_by(func.count(Referral.id).desc())
        .limit(10)
    )
    entries = rows.all()

    result = []
    for rank, (rid, count) in enumerate(entries, 1):
        profile = await db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == rid)
        )
        if profile and profile.name:
            parts = profile.name.strip().split()
            first = parts[0]
            last_initial = f"{parts[1][0]}." if len(parts) > 1 else ""
            display = f"{first} {last_initial}".strip()
        else:
            display = f"Студент #{rank}"

        result.append({
            "rank": rank,
            "name": display,
            "count": count,
            "is_me": rid == user_id,
        })

    return {"top_referrers": result}
