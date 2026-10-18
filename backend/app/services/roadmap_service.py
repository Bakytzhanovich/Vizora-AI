"""The student's 14-step journey and the progress the student and their agency see.

Step titles, descriptions and tips live in the frontend locales
(public/locales/{ru,kz}/roadmap.json), keyed by step id.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.roadmap import RoadmapProgress
from app.services.document_progress import document_progress_many

# Ordered as the student walks them. A category groups consecutive steps on the
# page, so a step must never belong to a category that appears earlier: "visa"
# (step 8) sits under "interview", right after the interview itself.
ROADMAP_STEPS: list[dict[str, Any]] = [
    {"id": "profile", "number": 1, "category": "preparation", "auto_complete": True},
    {"id": "documents", "number": 2, "category": "preparation", "auto_complete": False},
    {"id": "ds160", "number": 3, "category": "visa", "auto_complete": False},
    {"id": "sevis", "number": 4, "category": "visa", "auto_complete": False},
    {"id": "appointment", "number": 5, "category": "visa", "auto_complete": False},
    {"id": "interview_prep", "number": 6, "category": "interview", "auto_complete": False},
    {"id": "interview", "number": 7, "category": "interview", "auto_complete": False},
    {"id": "visa", "number": 8, "category": "interview", "auto_complete": False},
    {"id": "flight", "number": 9, "category": "travel", "auto_complete": False},
    {"id": "arrival", "number": 10, "category": "travel", "auto_complete": False},
    {"id": "ssn", "number": 11, "category": "usa", "auto_complete": False},
    {"id": "work", "number": 12, "category": "usa", "auto_complete": False},
    {"id": "taxes", "number": 13, "category": "usa", "auto_complete": False},
    {"id": "return", "number": 14, "category": "return", "auto_complete": False},
]

STEP_IDS = [s["id"] for s in ROADMAP_STEPS]
# Agencies care about getting the visa, so their "readiness" stops at step 8.
VISA_STEP_IDS = STEP_IDS[: STEP_IDS.index("visa") + 1]


def calculate_completed_steps(doc_progress: int, manual_completions: set[str]) -> set[str]:
    """Return the set of all completed step IDs, merging auto and manual completions."""
    completed: set[str] = {"profile"}  # always done for authenticated users
    if doc_progress >= 100:
        completed.add("documents")
    return completed | (manual_completions & set(STEP_IDS))


def journey_progress(completed_ids: set[str], steps: list[str] = STEP_IDS) -> int:
    """Share of `steps` done, 0–100. Every step counts the same."""
    return round(len(completed_ids & set(steps)) / len(steps) * 100)


def find_current_step(completed_ids: set[str]) -> str | None:
    for step_id in STEP_IDS:
        if step_id not in completed_ids:
            return step_id
    return None  # all done


async def completed_steps_many(db: AsyncSession, user_ids: list[str]) -> dict[str, set[str]]:
    """Completed step ids per user, in two queries however many users there are."""
    manual: dict[str, set[str]] = {uid: set() for uid in user_ids}
    if user_ids:
        rows = await db.execute(
            select(RoadmapProgress.user_id, RoadmapProgress.step_id).where(
                RoadmapProgress.user_id.in_(user_ids), RoadmapProgress.status == "completed"
            )
        )
        for uid, step_id in rows.all():
            manual[uid].add(step_id)
    docs = await document_progress_many(db, user_ids)
    return {uid: calculate_completed_steps(docs[uid], manual[uid]) for uid in user_ids}


async def readiness_many(db: AsyncSession, user_ids: list[str]) -> dict[str, int]:
    """Visa readiness (0–100) per student, as agencies see it."""
    return {uid: journey_progress(done, VISA_STEP_IDS) for uid, done in (await completed_steps_many(db, user_ids)).items()}
