import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.security import get_current_user_id
from app.models.chat import ChatMessage
from app.models.profile import StudentProfile
from app.models.user import User
from app.services.ai_service import generate_chat_response
from app.services.rag_service import search_knowledge
from app.services.subscription_service import PLAN_LIMITS, check_feature_access
from middleware.rate_limit import limiter

router = APIRouter(prefix="/chat", tags=["chat"])


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=100)


@router.post("/message")
@limiter.limit("20/minute")  # OpenAI cost protection
async def send_message(
    request: Request,
    body: MessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not body.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is empty")

    has_access, reason = await check_feature_access(user_id, "faq", db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "faq_limit_reached",
                "message": f"Лимит {PLAN_LIMITS['free']['faq_per_day']} вопросов на сегодня",
                "upgrade_url": "/pricing",
            },
        )

    session_id = body.session_id or str(uuid.uuid4())

    user = await db.get(User, user_id)
    language = user.language if user else "ru"

    # Load student profile for personalization
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile: dict = {}
    if profile:
        student_profile = {
            "name": profile.name,
            "country": profile.country,
            "course_year": profile.course_year,
            "profession": profile.profession,
            "english_level": profile.english_level,
            "travel_history": profile.travel_history,
            "financial_source": profile.financial_source,
            "interview_date": profile.interview_date.isoformat() if profile.interview_date else None,
        }

    # Load recent chat history for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history_rows = list(reversed(history_result.scalars().all()))
    chat_history = [{"role": m.role, "content": m.content} for m in history_rows]

    # RAG: find relevant knowledge
    knowledge_context = await search_knowledge(body.message, top_k=3, db=db)

    # Save user message
    user_msg = ChatMessage(
        user_id=user_id,
        session_id=session_id,
        role="user",
        content=body.message.strip(),
        created_at=datetime.utcnow(),
    )
    db.add(user_msg)
    await db.commit()

    # Stream AI response and collect full text
    async def event_stream():
        full_response = ""
        try:
            async for chunk in generate_chat_response(
                user_message=body.message,
                student_profile=student_profile,
                knowledge_context=knowledge_context,
                chat_history=chat_history,
                language=language,
            ):
                full_response += chunk
                yield chunk
        except Exception as e:
            error_msg = (
                "Что-то пошло не так. Попробуй ещё раз."
                if language != "kz"
                else "Бірдеңе дұрыс болмады. Қайталап көр."
            )
            yield error_msg
            full_response = error_msg

        # Use a fresh session — the dependency-injected one closes when the
        # route handler returns StreamingResponse, before this generator runs.
        async with AsyncSessionLocal() as save_db:
            ai_msg = ChatMessage(
                user_id=user_id,
                session_id=session_id,
                role="assistant",
                content=full_response,
                created_at=datetime.utcnow(),
            )
            save_db.add(ai_msg)
            await save_db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/plain; charset=utf-8",
        headers={
            "X-Session-ID": session_id,
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history")
async def get_history(
    limit: int = Query(default=50, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
    }


@router.delete("/history")
async def clear_history(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(ChatMessage).where(ChatMessage.user_id == user_id))
    await db.commit()
    return {"success": True}
