"""Student feedback: free-form messages and simulator session ratings, read in /admin/feedback."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.feedback import Feedback
from app.models.simulator import SimulatorSession
from app.models.user import User
from app.services.push_service import notify_admins

router = APIRouter(prefix="/feedback", tags=["feedback"])

MAX_MESSAGES_PER_DAY = 10
KIND_LABELS = {"idea": "Идея", "bug": "Ошибка", "question": "Вопрос"}


class FeedbackIn(BaseModel):
    kind: Literal["idea", "bug", "question"]
    message: str = Field(min_length=3, max_length=2000)
    page: str | None = Field(None, max_length=200)


class SessionRatingIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    message: str | None = Field(None, max_length=2000)


@router.post("", status_code=status.HTTP_201_CREATED)
async def send_feedback(
    body: FeedbackIn,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    sent_today = await db.scalar(
        select(func.count()).select_from(Feedback).where(
            Feedback.user_id == user_id,
            Feedback.kind != "session",
            Feedback.created_at >= datetime.utcnow() - timedelta(days=1),
        )
    )
    if sent_today >= MAX_MESSAGES_PER_DAY:
        raise HTTPException(status_code=429, detail="Too many messages today")
    user = await db.get(User, user_id)
    message = body.message.strip()
    db.add(Feedback(user_id=user_id, kind=body.kind, message=message, page=body.page))
    await db.commit()
    background_tasks.add_task(
        notify_admins, f"Отзыв: {KIND_LABELS[body.kind]}", f"{user.email if user else ''} · {message[:120]}", "/admin/feedback"
    )
    return {"status": "sent"}


@router.put("/session/{session_id}")
async def rate_session(
    session_id: str,
    body: SessionRatingIn,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(SimulatorSession, session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    message = (body.message or "").strip() or None
    row = await db.scalar(select(Feedback).where(Feedback.user_id == user_id, Feedback.session_id == session_id))
    if row:
        row.rating, row.message = body.rating, message
    else:
        db.add(Feedback(user_id=user_id, kind="session", rating=body.rating, message=message, session_id=session_id))
    await db.commit()
    # A bare 4–5 star tap isn't worth a push; low scores and comments are.
    if body.rating <= 3 or message:
        user = await db.get(User, user_id)
        background_tasks.add_task(
            notify_admins,
            f"Оценка тренировки: {body.rating}/5",
            f"{user.email if user else ''}{' · ' + message[:120] if message else ''}",
            "/admin/feedback",
        )
    return {"status": "saved"}
