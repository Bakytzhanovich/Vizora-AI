import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
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
    assess_test,
    band_levels,
    describe_speech,
    is_finished,
    is_usa_slot,
    ladder_next,
    pick_question,
    profile_bucket,
    scored,
    speech_metrics,
)
from app.services.risk_service import generate_risk_profile
from app.services.stt_service import speech_to_text, speech_to_text_timed
from middleware.rate_limit import limiter

# Open to every plan for now — no check_feature_access gate. When it moves
# into subscriptions, gate /start the same way /simulator/start gates consul.
router = APIRouter(prefix="/level-test", tags=["level-test"])
logger = logging.getLogger(__name__)

_MAX_AUDIO_SIZE = 10 * 1024 * 1024  # same cap as /simulator/transcribe


class SpeechMetrics(BaseModel):
    """What /level-test/transcribe measured, sent back with the answer."""
    words: int = Field(ge=0, le=2000)
    speaking_seconds: float = Field(ge=0, le=600)
    words_per_minute: float = Field(ge=0, le=600)
    long_pauses: int = Field(ge=0, le=500)
    longest_pause: float = Field(ge=0, le=600)
    fillers: int = Field(ge=0, le=500)


class FinishRequest(BaseModel):
    test_id: str = Field(min_length=1, max_length=100)


class AnswerRequest(BaseModel):
    test_id: str = Field(min_length=1, max_length=100)
    answer: str = Field(min_length=1, max_length=2000)
    # Recording length from the browser; absent for typed answers.
    duration_seconds: float | None = Field(default=None, ge=0, le=600)
    # Fluency measured from the recording; absent for typed answers and when
    # the speech recogniser returned no word timings.
    speech: SpeechMetrics | None = None


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


@router.post("/transcribe")
@limiter.limit("20/minute")
async def transcribe(
    request: Request,
    audio: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """Like /simulator/transcribe, but keeps fillers and measures how the
    answer was spoken — the level test judges fluency from this."""
    audio_bytes = await audio.read(_MAX_AUDIO_SIZE + 1)
    if len(audio_bytes) > _MAX_AUDIO_SIZE:
        raise HTTPException(status_code=400, detail="Audio too large (max 10MB)")
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio too short")
    filename = audio.filename or "audio.webm"
    try:
        text, words = await speech_to_text_timed(audio_bytes, filename)
    except Exception:
        # Some providers reject word timestamps — plain text still lets the
        # student answer; fluency is then judged from the text alone.
        logger.warning("timed transcription failed for user=%s, falling back to plain", user_id, exc_info=True)
        try:
            text, words = await speech_to_text(audio_bytes, filename), []
        except Exception:
            logger.exception("speech_to_text failed for user=%s", user_id)
            raise HTTPException(status_code=502, detail="Не удалось распознать речь. Попробуй ещё раз.")
    return {"text": text, "speech": speech_metrics(words) if text else None}


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
    band_done = len(band_levels(turns, level)) + 1 >= QUESTIONS_PER_LEVEL
    likely_next = LEVELS[min(LEVELS.index(level) + 1, len(LEVELS) - 1)] if band_done else level
    next_number = len(scored(turns)) + 2  # this answer, then the next question
    spoken = body.speech is not None or body.duration_seconds is not None
    metrics = body.speech.model_dump() if body.speech else None
    speech_note = describe_speech(text, metrics, spoken)
    assessment = await assess_answer(
        test.current_question, level, text, speech_note, [t["question"] for t in turns],
        likely_next, is_usa_slot(next_number),
    )
    if assessment is None:
        # Nothing is recorded — the student answers the same question again.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не удалось оценить ответ. Попробуй ответить ещё раз.",
        )
    turns.append({
        "question": test.current_question,
        "level": test.current_level,
        "answer": text,
        "attempted": assessment["attempted"],
        "answer_type": assessment["answer_type"],
        "overall": assessment["overall"],
        "levels": assessment["levels"],
        "structures": assessment["structures"],
        "error_count": assessment["error_count"],
        "corrections": assessment["corrections"],
        "spoken": spoken,
        "speech": metrics,
        "speech_note": speech_note,
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

    result = await assess_test(turns)
    final_level = result["level"]
    result["profile_updated"] = await _update_profile_level(db, user_id, final_level)

    test.completed = True
    test.completed_at = datetime.utcnow()
    test.final_level = final_level
    test.result = json.dumps(result, ensure_ascii=False)
    await db.commit()

    return {"done": True, "message": OUTRO, "result": result}


@router.post("/finish")
@limiter.limit("10/minute")
async def finish_early(
    request: Request,
    body: FinishRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """The student stops before the ladder ends. They still see a level from the
    answers so far, but only the bands they reached were measured, so it's
    likely too low: it doesn't touch the profile, and final_level stays NULL so
    the admin panel and agency cabinet keep showing the last full test."""
    test = await _load_test(db, body.test_id, user_id, lock=True)
    if test.completed:
        raise HTTPException(status_code=409, detail="Test already completed")

    turns: list[dict] = json.loads(test.transcript)
    if not scored(turns):
        raise HTTPException(status_code=400, detail="Нет ни одного ответа — уровень не определить")

    result = await assess_test(turns)
    result["profile_updated"] = False
    result["finished_early"] = True

    test.completed = True
    test.completed_at = datetime.utcnow()
    test.result = json.dumps(result, ensure_ascii=False)
    await db.commit()

    return {"done": True, "result": result}


@router.get("/latest")
async def latest_result(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    test = await db.scalar(
        select(LevelTest)
        .where(LevelTest.user_id == user_id, LevelTest.completed.is_(True), LevelTest.final_level.is_not(None))
        .order_by(LevelTest.completed_at.desc())
        .limit(1)
    )
    if not test:
        return {"result": None}
    return {"result": json.loads(test.result), "completed_at": test.completed_at.isoformat()}
