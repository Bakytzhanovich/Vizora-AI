from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.after_visa import AfterVisaProgress
from app.models.roadmap import RoadmapProgress
from app.services.after_visa_service import (
    AFTER_VISA_MODULES,
    compute_module_progress,
    get_module,
    get_modules_summary,
)
from app.services.subscription_service import check_feature_access

router = APIRouter(prefix="/after-visa", tags=["after-visa"])


async def _require_after_visa_access(user_id: str, db: AsyncSession) -> None:
    has_access, reason = await check_feature_access(user_id, "after_visa", db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "subscription_required", "reason": reason, "upgrade_url": "/pricing"},
        )


async def _visa_received(user_id: str, db: AsyncSession) -> bool:
    return True  # TEMP: always unlocked for testing


async def _get_completed_ids(user_id: str, db: AsyncSession) -> set[str]:
    rows = await db.scalars(
        select(AfterVisaProgress).where(
            and_(
                AfterVisaProgress.user_id == user_id,
                AfterVisaProgress.completed == True,  # noqa: E712
            )
        )
    )
    return {f"{r.module_id}:{r.section_id}" for r in rows}


@router.get("/modules")
async def list_modules(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _require_after_visa_access(user_id, db)
    unlocked = await _visa_received(user_id, db)
    completed_ids = await _get_completed_ids(user_id, db) if unlocked else set()

    modules_summary = get_modules_summary()
    total_sections = sum(len(m["sections"]) for m in AFTER_VISA_MODULES)
    completed_sections = len(completed_ids)

    modules_with_progress = []
    for m in modules_summary:
        prog = compute_module_progress(completed_ids, m["id"])
        modules_with_progress.append({**m, **prog})

    return {
        "unlocked": unlocked,
        "modules": modules_with_progress,
        "overall_completed": completed_sections,
        "overall_total": total_sections,
        "overall_pct": round(completed_sections / total_sections * 100) if total_sections else 0,
    }


@router.get("/content/{module_id}")
async def get_module_content(
    module_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _require_after_visa_access(user_id, db)
    module = get_module(module_id)
    if not module:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

    completed_ids = await _get_completed_ids(user_id, db)

    sections_with_status = [
        {
            **s,
            "completed": f"{module_id}:{s['id']}" in completed_ids,
        }
        for s in module["sections"]
    ]

    prog = compute_module_progress(completed_ids, module_id)

    return {
        "module": {
            "id": module["id"],
            "icon": module["icon"],
            "title": module["title"],
            "description": module["description"],
            "sections": sections_with_status,
        },
        **prog,
    }


class ProgressBody(BaseModel):
    module_id: str
    section_id: str
    completed: bool


@router.post("/progress")
async def update_progress(
    body: ProgressBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _require_after_visa_access(user_id, db)
    existing = await db.scalar(
        select(AfterVisaProgress).where(
            and_(
                AfterVisaProgress.user_id == user_id,
                AfterVisaProgress.module_id == body.module_id,
                AfterVisaProgress.section_id == body.section_id,
            )
        )
    )

    if existing:
        existing.completed = body.completed
        existing.completed_at = datetime.utcnow() if body.completed else None
    else:
        db.add(
            AfterVisaProgress(
                user_id=user_id,
                module_id=body.module_id,
                section_id=body.section_id,
                completed=body.completed,
                completed_at=datetime.utcnow() if body.completed else None,
            )
        )

    await db.commit()

    # Compute overall progress
    completed_ids = await _get_completed_ids(user_id, db)
    total_sections = sum(len(m["sections"]) for m in AFTER_VISA_MODULES)
    overall_pct = round(len(completed_ids) / total_sections * 100) if total_sections else 0

    return {"success": True, "overall_progress": overall_pct}
