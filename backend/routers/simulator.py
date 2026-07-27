import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.security import get_current_user_id
from app.models.profile import StudentProfile
from app.models.simulator import SimulatorSession
from app.services.simulator_service import (
    INTERVIEW_QUESTION_BANK,
    generate_feedback,
    generate_simulator_response,
)
from app.services.stt_service import speech_to_text
from app.services.subscription_service import check_feature_access, increment_simulator_usage
from app.services.tts_service import text_to_speech

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
    mode: str  # 'trainer' | 'consul'
    difficulty: str = "medium"  # 'easy' | 'medium' | 'hard'


class RespondRequest(BaseModel):
    session_id: str
    student_answer: str
    question_number: int = 1


class EndRequest(BaseModel):
    session_id: str
    duration_seconds: int = 0


class TTSRequest(BaseModel):
    text: str
    mode: str = "consul"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_session(
    body: StartRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if body.mode not in ("trainer", "consul"):
        raise HTTPException(status_code=400, detail="mode must be 'trainer' or 'consul'")

    has_access, reason = await check_feature_access(user_id, "simulator", db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "subscription_required", "reason": reason, "upgrade_url": "/pricing"},
        )

    if body.mode == "consul":
        consul_ok, consul_reason = await check_feature_access(user_id, "consul_mode", db)
        if not consul_ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "subscription_required", "reason": consul_reason, "upgrade_url": "/pricing"},
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
async def respond(
    body: RespondRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not body.student_answer.strip():
        raise HTTPException(status_code=400, detail="Answer is empty")

    session = await _load_session(db, body.session_id, user_id)
    profile, risks = await _load_profile(db, user_id)

    transcript: list[dict] = json.loads(session.transcript)
    transcript.append({
        "role": "student",
        "content": body.student_answer.strip(),
        "timestamp": datetime.utcnow().isoformat(),
    })

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

        transcript.append({
            "role": "officer",
            "content": accumulated,
            "timestamp": datetime.utcnow().isoformat(),
        })
        student_turns = len([t for t in transcript if t["role"] == "student"])

        # Use a fresh session — the dependency-injected one closes when the
        # route handler returns StreamingResponse, before this generator runs.
        async with AsyncSessionLocal() as save_db:
            result = await save_db.execute(
                select(SimulatorSession).where(
                    SimulatorSession.id == body.session_id,
                    SimulatorSession.user_id == user_id,
                )
            )
            fresh = result.scalar_one_or_none()
            if fresh:
                fresh.transcript = json.dumps(transcript, ensure_ascii=False)
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

    feedback = await generate_feedback(transcript, session.mode, session.id)

    session.feedback = json.dumps(feedback, ensure_ascii=False)
    session.scores = json.dumps(feedback.get("scores", {}), ensure_ascii=False)
    session.completed = True
    session.duration_seconds = body.duration_seconds
    db.add(session)
    await db.commit()

    await increment_simulator_usage(user_id, db)

    return {"feedback": feedback, "session_id": session.id}


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    audio_bytes = await audio.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio too short")

    text = await speech_to_text(audio_bytes, audio.filename or "audio.webm")
    return {"text": text}


@router.post("/tts")
async def tts(
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
