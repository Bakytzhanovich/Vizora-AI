from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.documents import DocumentProgress
from app.models.profile import StudentProfile
from app.services.documents_service import (
    COMMON_MISTAKES,
    DS160_STEPS,
    compute_progress,
    generate_checklist,
)
from app.services.subscription_service import check_feature_access

router = APIRouter(prefix="/documents", tags=["documents"])


async def _load_profile_dict(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {}
    return {
        "financial_source": profile.financial_source,
        "travel_history": profile.travel_history,
        "job_offer": profile.job_offer,
        "country": profile.country,
    }


@router.get("/checklist")
async def get_checklist(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    profile = await _load_profile_dict(db, user_id)
    checklist = generate_checklist(profile)

    # Load saved progress
    result = await db.execute(
        select(DocumentProgress).where(
            DocumentProgress.user_id == user_id,
            DocumentProgress.completed == True,  # noqa: E712
        )
    )
    completed_ids = {row.document_id for row in result.scalars().all()}

    # Attach completed flag to each item
    for doc in checklist:
        doc["completed"] = doc["id"] in completed_ids

    progress = compute_progress(checklist, completed_ids)
    return {"checklist": checklist, "progress": progress}


class UpdateRequest(BaseModel):
    document_id: str
    completed: bool


@router.post("/checklist/update")
async def update_checklist(
    body: UpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not body.document_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="document_id is required")

    result = await db.execute(
        select(DocumentProgress).where(
            DocumentProgress.user_id == user_id,
            DocumentProgress.document_id == body.document_id,
        )
    )
    row = result.scalar_one_or_none()

    if row:
        row.completed = body.completed
        row.updated_at = datetime.utcnow()
    else:
        row = DocumentProgress(
            user_id=user_id,
            document_id=body.document_id,
            completed=body.completed,
        )
        db.add(row)

    await db.commit()

    # Recompute progress
    profile = await _load_profile_dict(db, user_id)
    checklist = generate_checklist(profile)

    completed_result = await db.execute(
        select(DocumentProgress).where(
            DocumentProgress.user_id == user_id,
            DocumentProgress.completed == True,  # noqa: E712
        )
    )
    completed_ids = {r.document_id for r in completed_result.scalars().all()}
    progress = compute_progress(checklist, completed_ids)

    return {"success": True, "progress": progress}


@router.get("/ds160-guide")
async def ds160_guide(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    has_access, reason = await check_feature_access(user_id, "ds160_guide", db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "subscription_required", "reason": reason, "upgrade_url": "/pricing"},
        )
    return {"steps": DS160_STEPS}


@router.get("/common-mistakes")
async def common_mistakes(_: str = Depends(get_current_user_id)):
    return {"mistakes": COMMON_MISTAKES}
