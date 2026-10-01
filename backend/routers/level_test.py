import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.level_test import LevelTest
from app.models.profile import StudentProfile
from app.services.level_test_service import (
    EXPECTED_QUESTIONS,
    FIRST_QUESTION,
    INTRO,
    LEVELS,
    OUTRO,
    QUESTIONS_PER_LEVEL,
    START_LEVEL,
    assess_answer,
    band_scores,
    build_result,
    is_usa_slot,
    compute_final_level,
    is_finished,
    ladder_next,
    pick_question,
    profile_bucket,
    scored,
    summarize,
)
from app.services.risk_service import generate_risk_profile
from middleware.rate_limit import limiter

# Open to every plan for now — no check_feature_access gate. When it moves
# into subscriptions, gate /start the same way /simulator/start gates consul.
router = APIRouter(prefix="/level-test", tags=["level-test"])


class AnswerRequest(BaseModel):
    test_id: str = Field(min_length=1, max_length=100)
    answer: str = Field(min_length=1, max_length=2000)
    # Recording length from the browser; absent for typed answers.
    duration_seconds: float | None = Field(default=None, ge=0, le=600)


async def _load_test(db: AsyncSession, test_id: str, user_id: str, lock: bool = False) -> LevelTest:
    query = select(LevelTest).where(LevelTest.id == test_id, LevelTest.user_id == user_id)
    if lock:
        query = query.with_for_update()
    test = await db.scalar(query)
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found")
    return test


async def _update_profile_level(db: AsyncSession, user_id: str, final_level: str) -> bool:
    """Write the measured level into the profile and recompute risks, since
    "weak_english" is derived from it. No profile yet (test before onboarding)
    is fine — onboarding will ask for the level as usual."""
    profile = await db.scalar(select(StudentProfile).where(StudentProfile.user_id == user_id))
    if not profile:
        return False
    profile.english_level = profile_bucket(final_level)
    risk = generate_risk_profile(
        travel_history=profile.travel_history,
        financial_source=profile.financial_source,
        course_year=profile.course_year,
        english_level=profile.english_level,
    )
    profile.risk_profile = json.dumps(risk, ensure_ascii=False)
    db.add(profile)
    return True


@router.post("/start", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def start_test(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    test_id = str(uuid.uuid4())
    test = LevelTest(
        id=test_id,
        user_id=user_id,
        transcript="[]",
        current_level=START_LEVEL,
        current_question=FIRST_QUESTION,
    )
    db.add(test)
    await db.commit()

    return {
        "test_id": test.id,
        "message": INTRO + test.current_question,
        "question_number": 1,
        "max_questions": EXPECTED_QUESTIONS,
    }


@router.post("/answer")
@limiter.limit("30/minute")
async def answer(
    request: Request,
    body: AnswerRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    text = body.answer.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Answer is empty")

    # Locked so a double-submitted answer can't be scored twice or skip a question.
    test = await _load_test(db, body.test_id, user_id, lock=True)
    if test.completed:
        raise HTTPException(status_code=409, detail="Test already completed")

    turns: list[dict] = json.loads(test.transcript)
    # Where the ladder goes if this answer counts: same band until it has two
    # answers, then one up. Lets the same model call write that next question.
    level = test.current_level
    band_done = len(band_scores(turns, level)) + 1 >= QUESTIONS_PER_LEVEL
    likely_next = LEVELS[min(LEVELS.index(level) + 1, len(LEVELS) - 1)] if band_done else level
    next_number = len(scored(turns)) + 2  # this answer, then the next question
    assessment = await assess_answer(
        test.current_question, level, text, [t["question"] for t in turns],
        likely_next, is_usa_slot(next_number),
    )
    if assessment is None:
        # Nothing is recorded — the student answers the same question again.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не удалось оценить ответ. Попробуй ответить ещё раз.",
        )
    words = len(text.split())
    turns.append({
        "question": test.current_question,
        "level": test.current_level,
        "answer": text,
        "attempted": assessment["attempted"],
        "answer_type": assessment["answer_type"],
        "scores": assessment["scores"],
        "corrections": assessment["corrections"],
        "words_per_minute": round(words / body.duration_seconds * 60, 1)
        if body.duration_seconds and body.duration_seconds >= 2 else None,
    })
    test.transcript = json.dumps(turns, ensure_ascii=False)

    # A refusal isn't counted, so the ladder stays on the same band.
    if not is_finished(turns):
        upcoming = ladder_next(turns)
        asked = {t["question"] for t in turns}
        # The drafted follow-up was written for the band and topic this slot
        # would have had if the answer counted — reuse it only when that held.
        drafted_for_this_slot = upcoming == likely_next and assessment["attempted"]
        follow_up = assessment["next_question"] if drafted_for_this_slot else None
        test.current_level = upcoming
        test.current_question = (
            follow_up
            if follow_up and follow_up not in asked
            else pick_question(upcoming, asked, test.id, is_usa_slot(len(scored(turns)) + 1))
        )
        await db.commit()
        return {
            "done": False,
            "message": f'{assessment["reaction"]} {test.current_question}',
            "question_number": len(turns) + 1,
            "max_questions": EXPECTED_QUESTIONS,
        }

    final_level = compute_final_level(turns)
    result = build_result(turns, final_level, await summarize(turns, final_level))
    result["profile_updated"] = await _update_profile_level(db, user_id, final_level)

    test.completed = True
    test.completed_at = datetime.utcnow()
    test.final_level = final_level
    test.result = json.dumps(result, ensure_ascii=False)
    await db.commit()

    return {"done": True, "message": OUTRO, "result": result}


@router.get("/latest")
async def latest_result(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    test = await db.scalar(
        select(LevelTest)
        .where(LevelTest.user_id == user_id, LevelTest.completed.is_(True))
        .order_by(LevelTest.completed_at.desc())
        .limit(1)
    )
    if not test:
        return {"result": None}
    return {"result": json.loads(test.result), "completed_at": test.completed_at.isoformat()}
