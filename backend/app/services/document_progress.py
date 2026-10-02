"""Document checklist progress — one formula for the student and the agency.

The student sees compute_progress over *their* checklist (its length depends
on the profile: 13 items for a parents-funded student, fewer for others). The
agency views used to divide the raw count of completed rows by 9 instead, so
an agency saw 100% — and counted the "documents" roadmap step done — while
the student still had items left, and any stray document_id counted too.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import DocumentProgress
from app.models.profile import StudentProfile
from app.services.documents_service import compute_progress, generate_checklist


def checklist_inputs(profile: StudentProfile | None) -> dict[str, Any]:
    """The profile fields generate_checklist depends on."""
    if not profile:
        return {}
    return {
        "financial_source": profile.financial_source,
        "travel_history": profile.travel_history,
        "job_offer": profile.job_offer,
        "country": profile.country,
    }


async def document_progress_many(db: AsyncSession, user_ids: list[str]) -> dict[str, int]:
    """Checklist progress (0-100, as the student sees it) for several users."""
    if not user_ids:
        return {}
    profiles = {
        p.user_id: p
        for p in (await db.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))).all()
    }
    completed: dict[str, set[str]] = {uid: set() for uid in user_ids}
    rows = await db.execute(
        select(DocumentProgress.user_id, DocumentProgress.document_id).where(
            DocumentProgress.user_id.in_(user_ids),
            DocumentProgress.completed.is_(True),
        )
    )
    for uid, doc_id in rows.all():
        completed[uid].add(doc_id)
    return {
        uid: compute_progress(generate_checklist(checklist_inputs(profiles.get(uid))), completed[uid])
        for uid in user_ids
    }


async def document_progress(db: AsyncSession, user_id: str) -> int:
    return (await document_progress_many(db, [user_id]))[user_id]
