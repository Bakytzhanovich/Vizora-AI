import json
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token, get_current_user_id
from app.models.analytics import AnalyticsEvent

router = APIRouter(prefix="/analytics", tags=["analytics"])

_bearer = HTTPBearer(auto_error=False)


def _optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    """Extract user_id from Bearer token if present and valid; return None otherwise."""
    if not credentials:
        return None
    try:
        return decode_token(credentials.credentials, expected_type="access")
    except Exception:
        return None


class TrackPayload(BaseModel):
    event: str
    properties: dict[str, Any] | None = None
    url: str | None = None
    session_id: str | None = Field(default=None, max_length=64)


@router.post("/track", status_code=204)
async def track_event(
    payload: TrackPayload,
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Depends(_optional_user_id),
):
    """Accept an analytics event. Attaches user_id if a valid token is present."""
    db.add(
        AnalyticsEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            session_id=payload.session_id,
            event=payload.event,
            properties=json.dumps(payload.properties) if payload.properties else None,
            url=payload.url,
            created_at=datetime.utcnow(),
        )
    )
    await db.commit()


@router.get("/summary")
async def analytics_summary(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Admin: event counts for the last N days."""
    since = datetime.utcnow() - timedelta(days=days)
    rows = await db.execute(
        select(AnalyticsEvent.event, func.count().label("count"))
        .where(AnalyticsEvent.created_at >= since)
        .group_by(AnalyticsEvent.event)
        .order_by(func.count().desc())
    )
    counts = [{"event": r.event, "count": r.count} for r in rows]

    total = await db.scalar(
        select(func.count()).where(AnalyticsEvent.created_at >= since)
    )
    unique_users = await db.scalar(
        select(func.count(AnalyticsEvent.user_id.distinct())).where(
            AnalyticsEvent.created_at >= since,
            AnalyticsEvent.user_id.isnot(None),
        )
    )

    return {
        "period_days": days,
        "total_events": total or 0,
        "unique_users": unique_users or 0,
        "by_event": counts,
    }
