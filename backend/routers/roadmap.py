from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.documents import DocumentProgress
from app.models.profile import StudentProfile
from app.models.roadmap import RoadmapProgress
from app.services.documents_service import compute_progress as compute_doc_progress
from app.services.documents_service import generate_checklist
from app.services.roadmap_service import (
    ROADMAP_STEPS,
    calculate_completed_steps,
    compute_journey_progress,
    find_current_step,
)

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


async def _get_doc_progress(db: AsyncSession, user_id: str) -> int:
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile_row = profile_result.scalar_one_or_none()
    profile_dict = (
        {
            "financial_source": profile_row.financial_source,
            "travel_history": profile_row.travel_history,
            "job_offer": profile_row.job_offer,
            "country": profile_row.country,
        }
        if profile_row
        else {}
    )
    checklist = generate_checklist(profile_dict)

    doc_result = await db.execute(
        select(DocumentProgress).where(
            DocumentProgress.user_id == user_id,
            DocumentProgress.completed == True,  # noqa: E712
        )
    )
    completed_ids = {r.document_id for r in doc_result.scalars().all()}
    return compute_doc_progress(checklist, completed_ids)


@router.get("/roadmap")
async def get_roadmap(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Document progress (for auto-complete of "documents" step)
    doc_pct = await _get_doc_progress(db, user_id)

    # Manual roadmap completions from DB
    rp_result = await db.execute(
        select(RoadmapProgress).where(RoadmapProgress.user_id == user_id)
    )
    rp_rows = {r.step_id: r for r in rp_result.scalars().all()}

    manual_completed = {sid for sid, r in rp_rows.items() if r.status == "completed"}
    completed_ids = calculate_completed_steps(doc_pct, manual_completed)
    current_step_id = find_current_step(completed_ids)
    journey_progress = compute_journey_progress(completed_ids)

    steps = []
    for s in ROADMAP_STEPS:
        sid = s["id"]
        if sid in completed_ids:
            st = "completed"
            completed_at = rp_rows[sid].completed_at.isoformat() if sid in rp_rows and rp_rows[sid].completed_at else None
        elif sid == current_step_id:
            st = "in_progress"
            completed_at = None
        else:
            st = "pending"
            completed_at = None

        steps.append({**s, "status": st, "completed_at": completed_at})

    return {
        "steps": steps,
        "current_step": current_step_id,
        "progress": journey_progress,
    }


StepStatus = Literal["pending", "in_progress", "completed"]


class UpdateRequest(BaseModel):
    step_id: str
    status: StepStatus


@router.post("/roadmap/update")
async def update_roadmap(
    body: UpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    valid_ids = {s["id"] for s in ROADMAP_STEPS}
    if body.step_id not in valid_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid step_id")

    rp_result = await db.execute(
        select(RoadmapProgress).where(
            RoadmapProgress.user_id == user_id,
            RoadmapProgress.step_id == body.step_id,
        )
    )
    row = rp_result.scalar_one_or_none()

    now = datetime.utcnow()
    if row:
        row.status = body.status
        row.completed_at = now if body.status == "completed" else None
    else:
        row = RoadmapProgress(
            user_id=user_id,
            step_id=body.step_id,
            status=body.status,
            completed_at=now if body.status == "completed" else None,
        )
        db.add(row)

    await db.commit()

    # Figure out the next step
    doc_pct = await _get_doc_progress(db, user_id)
    rp_all = await db.execute(
        select(RoadmapProgress).where(RoadmapProgress.user_id == user_id)
    )
    manual_completed = {r.step_id for r in rp_all.scalars().all() if r.status == "completed"}
    completed_ids = calculate_completed_steps(doc_pct, manual_completed)
    next_step = find_current_step(completed_ids)

    return {"success": True, "next_step": next_step}
