"""Internal endpoints for the Telegram notification bot."""

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.models.profile import StudentProfile
from app.models.roadmap import RoadmapProgress
from app.models.simulator import SimulatorSession
from app.models.user import User

router = APIRouter(prefix="/internal", tags=["internal"])


def _check_secret(request: Request) -> None:
    secret = request.headers.get("X-Notification-Secret", "")
    if not settings.NOTIFICATION_SECRET or secret != settings.NOTIFICATION_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _check_admin_secret(request: Request) -> None:
    secret = request.headers.get("X-Admin-Secret", "")
    if not settings.ADMIN_SECRET or secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


class BootstrapAdminRequest(BaseModel):
    email: EmailStr
    password: str | None = None
    reset_password: bool = False


def _safe_int(value: str | None) -> int | None:
    """Convert telegram_id string to int, returning None on any error."""
    try:
        return int(value) if value is not None else None
    except (ValueError, TypeError):
        return None


NOTIFICATION_TYPES = {
    "interview_3days",
    "interview_1day",
    "roadmap_stuck",
}


@router.post("/bootstrap-admin")
async def bootstrap_admin(
    request: Request,
    body: BootstrapAdminRequest,
    db: AsyncSession = Depends(get_db),
):
    _check_admin_secret(request)

    email = body.email.lower()
    user = await db.scalar(select(User).where(User.email == email))
    created = False
    password_changed = False

    if user:
        user.role = "admin"
        if body.reset_password:
            if not body.password or len(body.password) < 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must contain at least 8 characters",
                )
            user.password_hash = hash_password(body.password)
            password_changed = True
    else:
        if not body.password or len(body.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required and must contain at least 8 characters",
            )
        user = User(email=email, password_hash=hash_password(body.password), role="admin")
        db.add(user)
        created = True
        password_changed = True

    await db.commit()

    return {
        "email": email,
        "role": "admin",
        "created": created,
        "password_changed": password_changed,
    }


@router.get("/notifications/due")
async def notifications_due(
    request: Request,
    type: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    _check_secret(request)
    if type not in NOTIFICATION_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown type: {type}")

    today = date.today()
    students: list[dict] = []

    if type == "interview_3days":
        target_date = today + timedelta(days=3)

        # Single query: users with interview in 3 days and zero completed sessions
        has_session_subq = (
            select(SimulatorSession.user_id)
            .where(SimulatorSession.completed == True)
            .distinct()
            .scalar_subquery()
        )
        rows = await db.execute(
            select(User, StudentProfile)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .where(
                and_(
                    User.telegram_id.isnot(None),
                    StudentProfile.interview_date == target_date,
                    User.id.not_in(has_session_subq),
                )
            )
        )
        for user, profile in rows:
            tg_id = _safe_int(user.telegram_id)
            if tg_id is None:
                continue
            students.append({
                "telegram_id": tg_id,
                "name": profile.name.split()[0],
                "interview_date": str(profile.interview_date),
            })

    elif type == "interview_1day":
        target_date = today + timedelta(days=1)
        rows = await db.execute(
            select(User, StudentProfile)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .where(
                and_(
                    User.telegram_id.isnot(None),
                    StudentProfile.interview_date == target_date,
                )
            )
        )
        for user, profile in rows:
            tg_id = _safe_int(user.telegram_id)
            if tg_id is None:
                continue
            students.append({
                "telegram_id": tg_id,
                "name": profile.name.split()[0],
                "interview_date": str(profile.interview_date),
            })

    elif type == "roadmap_stuck":
        # Single query: users with no roadmap activity in the last 7 days
        cutoff = datetime.utcnow() - timedelta(days=7)

        active_subq = (
            select(RoadmapProgress.user_id)
            .where(RoadmapProgress.created_at >= cutoff)
            .distinct()
            .scalar_subquery()
        )
        rows = await db.execute(
            select(User, StudentProfile)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .where(
                and_(
                    User.telegram_id.isnot(None),
                    User.id.not_in(active_subq),
                )
            )
        )
        for user, profile in rows:
            tg_id = _safe_int(user.telegram_id)
            if tg_id is None:
                continue
            students.append({
                "telegram_id": tg_id,
                "name": profile.name.split()[0],
            })

    return {"students": students, "count": len(students)}
