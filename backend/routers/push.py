from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.push_subscription import PushSubscription

router = APIRouter(prefix="/push", tags=["push"])


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
async def vapid_public_key():
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    body: SubscribeRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Push not configured")

    existing = await db.scalar(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))
    if existing:
        existing.user_id = user_id
        existing.p256dh = body.keys.p256dh
        existing.auth = body.keys.auth
    else:
        db.add(
            PushSubscription(
                user_id=user_id,
                endpoint=body.endpoint,
                p256dh=body.keys.p256dh,
                auth=body.keys.auth,
            )
        )
    await db.commit()
    return {"success": True}


@router.post("/unsubscribe")
async def unsubscribe(
    body: UnsubscribeRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == body.endpoint,
            PushSubscription.user_id == user_id,
        )
    )
    await db.commit()
    return {"success": True}
