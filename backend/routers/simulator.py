import json
import logging
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.security import get_current_user_id
from app.models.profile import StudentProfile
from app.models.simulator import SimulatorSession
from app.models.user import User
from app.services.simulator_service import (
    INTERVIEW_QUESTION_BANK,
    generate_feedback,
    generate_simulator_response,
)
from app.services.pdf_report_service import generate_session_pdf
from app.services.stt_service import speech_to_text
from app.services.subscription_service import check_feature_access, get_user_access, increment_simulator_usage
from app.services.tts_service import text_to_speech
from middleware.rate_limit import limiter

# Fixed count used only for the free-plan "here's what you missed" upsell
# copy (see /respond's trial_session_ended response) — it doesn't drive the
# actual question bank, which samples a variable mix per session.
FREE_SESSION_TOTAL_QUESTIONS = 15

router = APIRouter(prefix="/simulator", tags=["simulator"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _load_profile(db: AsyncSession, user_id: str) -> tuple[dict, list]:
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        return {}, []
    student_dict = {
        "country": profile.country,
        "course_year": profile.course_year,
        "profession": profile.profession,
        "english_level": profile.english_level,
        "travel_history": profile.travel_history,
        "financial_source": profile.financial_source,
        "interview_date": profile.interview_date.isoformat() if profile.interview_date else None,
    }
    risks = json.loads(profile.risk_profile).get("risks", []) if profile.risk_profile else []
    return student_dict, risks


async def _load_session(db: AsyncSession, session_id: str, user_id: str) -> SimulatorSession:
    result = await db.execute(
        select(SimulatorSession).where(
            SimulatorSession.id == session_id,
            SimulatorSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


# ─── Schemas ──────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    mode: Literal["trainer", "consul"]
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class RespondRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    student_answer: str = Field(min_length=1, max_length=1000)
    question_number: int = Field(default=1, ge=0, le=50)


class EndRequest(BaseModel):
    session_id: str
    duration_seconds: int = 0


class TTSRequest(BaseModel):
    text: str
    mode: str = "consul"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/start", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")  # expensive endpoint (AI-generated opening question)
async def start_session(
    request: Request,
    body: StartRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Row-locked (not db.get) so two concurrent /start calls for the same user
    # (e.g. two browser tabs) can't both read "under the limit" before either
    # has committed its new session — the second request blocks here until
    # the first's single commit (below, after the session insert) releases the
    # lock, so its own limit check (and the free plan's live COUNT(*) in
    # get_user_access) sees the first session that was just inserted. This
    # only holds if nothing in between commits early — increment_simulator_usage
    # deliberately does not commit for this reason.
    #
    # get_user_access() is the one exception: it commits internally when it
    # demotes a just-lapsed paid plan to free (subscription_service.py), which
    # would release this lock right before its own session-count check runs —
    # reopening the same race for exactly that transition. Call it once to
    # flush any pending demotion, then re-acquire the lock: the plan is now
    # already "free" and persisted, so this second call can't itself commit
    # and drop the lock before the insert further down.
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await get_user_access(user, db)

    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    access = await get_user_access(user, db)

    if not access.get("sessions_ok", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "subscription_required", "reason": "sessions_limit", "upgrade_url": "/pricing"},
        )

    if body.mode == "consul":
        if not access["limits"].get("consul_mode", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "subscription_required", "reason": "subscription_required", "upgrade_url": "/pricing"},
            )
        # Phase 1 of the structured interview — the real opening question a visa officer asks.
        opening = "Good morning. What is the purpose of your visit to the United States?"
    else:
        first_question = INTERVIEW_QUESTION_BANK["personal"][0]
        opening = (
            "Привет! Я буду симулировать визовое интервью и давать тебе фидбек после каждого ответа. "
            "Отвечай на вопросы на английском. Начнём!\n\n"
            f"First question: {first_question}"
        )

    # Consumed the moment a session starts, not when it ends — otherwise the
    # check above (sessions_used < limit) can never see a session that was
    # started but never finished, letting a user start unlimited concurrent
    # sessions (e.g. in separate tabs) that all pass the same stale count.
    await increment_simulator_usage(user_id, db)

    transcript = [{"role": "officer", "content": opening, "timestamp": datetime.utcnow().isoformat()}]

    session = SimulatorSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        mode=body.mode,
        difficulty=body.difficulty,
        transcript=json.dumps(transcript, ensure_ascii=False),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return {"session_id": session.id, "opening_question": opening, "mode": body.mode}


@router.post("/respond")
@limiter.limit("30/minute")
async def respond(
    request: Request,
    body: RespondRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not body.student_answer.strip():
        raise HTTPException(status_code=400, detail="Answer is empty")

    session = await _load_session(db, body.session_id, user_id)
    profile, risks = await _load_profile(db, user_id)

    student_message = {
        "role": "student",
        "content": body.student_answer.strip(),
        "timestamp": datetime.utcnow().isoformat(),
    }
    transcript: list[dict] = json.loads(session.transcript)
    transcript.append(student_message)

    user = await db.get(User, user_id)
    access = await get_user_access(user, db)
    max_minutes = access["limits"].get("simulator_session_max_minutes")
    if max_minutes is not None:
        elapsed_minutes = (datetime.utcnow() - session.created_at).total_seconds() / 60
        if elapsed_minutes >= max_minutes:
            answered = len([t for t in transcript if t["role"] == "student"])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "trial_session_ended",
                    "answered": answered,
                    "total": FREE_SESSION_TOTAL_QUESTIONS,
                    "upgrade_url": "/pricing",
                },
            )

    async def event_stream():
        accumulated = ""
        try:
            async for chunk in generate_simulator_response(session.mode, transcript, profile, risks, session.difficulty, session.id):
                accumulated += chunk
                yield chunk
        except Exception:
            logging.getLogger(__name__).exception("Simulator response generation failed")
            yield "I'm sorry, there seems to be a technical issue. Please try again."
            return  # Don't commit error text as a real officer turn

        officer_message = {
            "role": "officer",
            "content": accumulated,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Use a fresh session — the dependency-injected one closes when the
        # route handler returns StreamingResponse, before this generator runs.
        # Row-locked and re-read here (not reusing the `transcript` list built
        # at request start) so two overlapping /respond calls for the same
        # session — e.g. a client retry after a slow/timed-out request —
        # append on top of each other's committed work instead of the second
        # one's commit silently overwriting the first's exchange.
        async with AsyncSessionLocal() as save_db:
            result = await save_db.execute(
                select(SimulatorSession)
                .where(
                    SimulatorSession.id == body.session_id,
                    SimulatorSession.user_id == user_id,
                )
                .with_for_update()
            )
            fresh = result.scalar_one_or_none()
            if fresh:
                current_transcript: list[dict] = json.loads(fresh.transcript)
                current_transcript.append(student_message)
                current_transcript.append(officer_message)
                student_turns = len([t for t in current_transcript if t["role"] == "student"])
                fresh.transcript = json.dumps(current_transcript, ensure_ascii=False)
                fresh.question_count = student_turns
                save_db.add(fresh)
                await save_db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/end")
async def end_session(
    body: EndRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session(db, body.session_id, user_id)
    transcript: list[dict] = json.loads(session.transcript)
    profile, risks = await _load_profile(db, user_id)

    feedback = await generate_feedback(transcript, session.mode, session.id, profile, risks)

    session.feedback = json.dumps(feedback, ensure_ascii=False)
    session.scores = json.dumps(feedback.get("scores", {}), ensure_ascii=False)
    session.completed = True
    session.duration_seconds = body.duration_seconds
    db.add(session)
    await db.commit()

    return {"feedback": feedback, "session_id": session.id}


_MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB — generous for a single spoken answer


@router.post("/transcribe")
@limiter.limit("20/minute")
async def transcribe(
    request: Request,
    audio: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    audio_bytes = await audio.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio too short")
    if len(audio_bytes) > _MAX_AUDIO_SIZE:
        raise HTTPException(status_code=400, detail="Audio too large (max 10MB)")

    try:
        text = await speech_to_text(audio_bytes, audio.filename or "audio.webm")
    except Exception:
        logging.getLogger(__name__).exception("speech_to_text failed for user=%s", user_id)
        raise HTTPException(status_code=502, detail="Не удалось распознать речь. Попробуй ещё раз.")
    return {"text": text}


@router.post("/tts")
@limiter.limit("20/minute")  # consistency with sibling AI endpoints; text_to_speech uses edge-tts (free), but still a third-party call worth throttling
async def tts(
    request: Request,
    body: TTSRequest,
    user_id: str = Depends(get_current_user_id),
):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    audio_bytes = await text_to_speech(body.text, body.mode)
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.get("/history")
async def get_history(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SimulatorSession)
        .where(SimulatorSession.user_id == user_id)
        .order_by(SimulatorSession.created_at.desc())
        .limit(20)
    )
    sessions = result.scalars().all()
    return {
        "sessions": [
            {
                "id": s.id,
                "mode": s.mode,
                "difficulty": s.difficulty,
                "scores": json.loads(s.scores) if s.scores else None,
                "completed": s.completed,
                "duration_seconds": s.duration_seconds,
                "created_at": s.created_at.isoformat(),
                "question_count": s.question_count if s.question_count is not None else len([e for e in json.loads(s.transcript) if e["role"] == "student"]),
            }
            for s in sessions
        ]
    }


@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session(db, session_id, user_id)
    return {
        "session": {
            "id": session.id,
            "mode": session.mode,
            "difficulty": session.difficulty,
            "completed": session.completed,
            "duration_seconds": session.duration_seconds,
            "created_at": session.created_at.isoformat(),
        },
        "transcript": json.loads(session.transcript),
        "feedback": json.loads(session.feedback) if session.feedback else None,
    }


@router.get("/session/{session_id}/pdf-report")
async def get_session_pdf_report(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    has_access, reason = await check_feature_access(user_id, "pdf_report", db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "subscription_required", "reason": reason, "upgrade_url": "/pricing"},
        )

    session = await _load_session(db, session_id, user_id)
    if not session.completed or not session.feedback:
        raise HTTPException(status_code=400, detail="Session isn't finished yet")

    pdf_bytes = generate_session_pdf(
        session_mode=session.mode,
        difficulty=session.difficulty,
        created_at=session.created_at,
        duration_seconds=session.duration_seconds or 0,
        feedback=json.loads(session.feedback),
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="vizora-report-{session_id[:8]}.pdf"'},
    )
