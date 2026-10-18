from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.roadmap import RoadmapProgress
from app.services.roadmap_service import (
    ROADMAP_STEPS,
    STEP_IDS,
    completed_steps_many,
    find_current_step,
    journey_progress,
)

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


@router.get("/roadmap")
async def get_roadmap(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    completed_ids = (await completed_steps_many(db, [user_id]))[user_id]
    completed_at = {
        r.step_id: r.completed_at
        for r in (await db.scalars(select(RoadmapProgress).where(RoadmapProgress.user_id == user_id))).all()
    }
    current_step_id = find_current_step(completed_ids)

    steps = []
    for s in ROADMAP_STEPS:
        sid = s["id"]
        if sid in completed_ids:
            st = "completed"
        elif sid == current_step_id:
            st = "in_progress"
        else:
            st = "pending"
        done_at = completed_at.get(sid) if st == "completed" else None
        # Stored as naive UTC; the "Z" stops browsers reading it as local time.
        steps.append({**s, "status": st, "completed_at": f"{done_at.isoformat()}Z" if done_at else None})

    return {
        "steps": steps,
        "current_step": current_step_id,
        "progress": journey_progress(completed_ids),
    }


StepStatus = Literal["pending", "in_progress", "completed"]


class UpdateRequest(BaseModel):
    step_id: str
    status: StepStatus


async def _save_step(db: AsyncSession, user_id: str, body: UpdateRequest) -> None:
    row = await db.scalar(
        select(RoadmapProgress).where(RoadmapProgress.user_id == user_id, RoadmapProgress.step_id == body.step_id)
    )
    completed_at = datetime.utcnow() if body.status == "completed" else None
    if row:
        row.status, row.completed_at = body.status, completed_at
    else:
        db.add(RoadmapProgress(user_id=user_id, step_id=body.step_id, status=body.status, completed_at=completed_at))
    await db.commit()


@router.post("/roadmap/update")
async def update_roadmap(
    body: UpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if body.step_id not in STEP_IDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid step_id")

    try:
        await _save_step(db, user_id, body)
    except IntegrityError:
        # A double tap raced us to the insert; the row exists now, so update it.
        await db.rollback()
        await _save_step(db, user_id, body)

    completed_ids = (await completed_steps_many(db, [user_id]))[user_id]
    return {"success": True, "next_step": find_current_step(completed_ids)}
