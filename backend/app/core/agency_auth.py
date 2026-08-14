import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services.security_logger import log_suspicious_activity

_bearer = HTTPBearer(auto_error=False)


@dataclass
class AgencyCtx:
    agency_id: str
    member_id: str | None
    role: str  # "admin" | "manager"


def create_member_token(agency_id: str, member_id: str, role: str) -> str:
    payload = {
        "sub": agency_id,
        "mid": member_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_member(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> AgencyCtx:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing agency token")
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        # Routine — every session hits this eventually. Not logged, matching
        # get_current_user_id's convention (app/core/security.py).
        raise HTTPException(status_code=401, detail="Agency token expired")
    except jwt.InvalidTokenError:
        asyncio.create_task(log_suspicious_activity(
            event_type="invalid_jwt",
            ip=get_remote_address(request),
            details={"reason": "Invalid agency token", "path": request.url.path},
        ))
        raise HTTPException(status_code=401, detail="Invalid agency token")

    role = payload.get("role")
    # Legacy "agency_manager" tokens are no longer accepted — require re-login.
    if role not in ("admin", "manager"):
        asyncio.create_task(log_suspicious_activity(
            event_type="invalid_jwt",
            ip=get_remote_address(request),
            details={"reason": "Unrecognized agency token role", "path": request.url.path},
        ))
        raise HTTPException(status_code=401, detail="Устаревший токен. Войдите снова.")

    ctx = AgencyCtx(
        agency_id=payload["sub"],
        member_id=payload.get("mid"),
        role=role,
    )

    # For managers: verify the account is still active on every request.
    if ctx.role == "manager" and ctx.member_id:
        from app.models.agency import AgencyMember  # local import avoids circular dep
        member = await db.get(AgencyMember, ctx.member_id)
        if not member or member.status != "active":
            asyncio.create_task(log_suspicious_activity(
                event_type="deactivated_account_access",
                ip=get_remote_address(request),
                user_id=ctx.member_id,
                details={"path": request.url.path},
            ))
            raise HTTPException(
                status_code=401,
                detail="Ваш аккаунт деактивирован. Обратитесь к администратору агентства.",
            )

    return ctx


def require_admin(ctx: AgencyCtx = Depends(get_current_member)) -> AgencyCtx:
    if ctx.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав. Обратитесь к администратору агентства.",
        )
    return ctx
