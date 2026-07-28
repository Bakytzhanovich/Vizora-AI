import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.agency import Agency, AgencyStudent
from app.models.profile import StudentProfile
from app.models.referral import Referral
from app.models.user import User
from app.services.referral_service import (
    check_and_grant_rewards,
    count_completed_referrals,
    grant_welcome_bonus,
)
from app.services.risk_service import generate_risk_profile

router = APIRouter(prefix="/profile", tags=["profile"])


class LanguageRequest(BaseModel):
    language: str


class OnboardingRequest(BaseModel):
    name: str
    university: str
    course_year: int
    profession: str
    interview_date: date | None = None
    english_level: str
    travel_history: bool
    financial_source: str
    job_offer: str
    country: str
    via_agency: bool

    model_config = {"str_strip_whitespace": True}


@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
async def onboarding(
    body: OnboardingRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Profile already exists")

    risk = generate_risk_profile(
        travel_history=body.travel_history,
        financial_source=body.financial_source,
        course_year=body.course_year,
        english_level=body.english_level,
    )

    profile = StudentProfile(
        user_id=user_id,
        name=body.name,
        university=body.university,
        course_year=body.course_year,
        profession=body.profession,
        interview_date=body.interview_date,
        english_level=body.english_level,
        travel_history=body.travel_history,
        financial_source=body.financial_source,
        job_offer=body.job_offer,
        country=body.country,
        via_agency=body.via_agency,
        risk_profile=json.dumps(risk, ensure_ascii=False),
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    # Complete referral if this user was invited
    referral = await db.scalar(
        select(Referral).where(
            and_(Referral.referred_id == user_id, Referral.status == "pending")
        )
    )
    if referral:
        referral.status = "completed"
        referral.completed_at = datetime.utcnow()
        await db.commit()
        await grant_welcome_bonus(user_id, db)
        completed = await count_completed_referrals(referral.referrer_id, db)
        await check_and_grant_rewards(referral.referrer_id, completed, db)

    return {
        "profile": {
            "id": profile.id,
            "name": profile.name,
            "university": profile.university,
            "course_year": profile.course_year,
            "profession": profile.profession,
            "interview_date": profile.interview_date.isoformat() if profile.interview_date else None,
            "english_level": profile.english_level,
            "travel_history": profile.travel_history,
            "financial_source": profile.financial_source,
            "job_offer": profile.job_offer,
            "country": profile.country,
            "via_agency": profile.via_agency,
        },
        "risk_profile": risk,
    }


@router.post("/language")
async def update_language(
    body: LanguageRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if body.language not in ("ru", "kz"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported language")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.language = body.language
    await db.commit()
    return {"success": True, "language": user.language}


@router.get("/me")
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    risk = json.loads(profile.risk_profile) if profile and profile.risk_profile else None

    # Build branding block
    branding = {"name": "Vizora AI", "logo_url": None, "primary_color": "#6C63FF", "is_white_label": False}
    if profile and profile.via_agency:
        link = await db.scalar(
            select(AgencyStudent).where(AgencyStudent.user_id == user_id)
        )
        if link:
            agency = await db.get(Agency, link.agency_id)
            if agency and agency.white_label_enabled:
                branding = {
                    "name": agency.white_label_name or "Vizora AI",
                    "logo_url": agency.white_label_logo_url,
                    "primary_color": agency.white_label_primary_color or "#6C63FF",
                    "is_white_label": True,
                }

    return {
        "user": {"id": user.id, "email": user.email, "role": user.role, "language": user.language},
        "profile": {
            "id": profile.id,
            "name": profile.name,
            "university": profile.university,
            "course_year": profile.course_year,
            "profession": profile.profession,
            "interview_date": profile.interview_date.isoformat() if profile.interview_date else None,
            "english_level": profile.english_level,
            "travel_history": profile.travel_history,
            "financial_source": profile.financial_source,
            "job_offer": profile.job_offer,
            "country": profile.country,
            "via_agency": profile.via_agency,
        } if profile else None,
        "risk_profile": risk,
        "branding": branding,
    }
