import hashlib
import hmac
import json
import secrets
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user_id,
    hash_password,
    verify_password,
)
from app.models.profile import StudentProfile
from app.models.referral import Referral, ReferralCode
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    referral_code: str | None = None

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен содержать минимум 8 символов")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    user_id: str
    referrer_name: str | None = None


class AccessTokenResponse(BaseModel):
    access_token: str


class TelegramAuthRequest(BaseModel):
    init_data: str
    telegram_id: int
    telegram_username: str | None = None
    referral_code: str | None = None


class TelegramTokenResponse(BaseModel):
    access_token: str
    user_id: str
    is_new_user: bool


REFRESH_COOKIE_NAME = "refresh_token"


def _refresh_cookie_options() -> dict[str, object]:
    secure = not settings.FRONTEND_URL.startswith("http://localhost")
    return {
        "httponly": True,
        "secure": secure,
        "samesite": "lax",
        "path": "/api/auth",
        "max_age": settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    }


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(REFRESH_COOKIE_NAME, refresh_token, **_refresh_cookie_options())


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/auth")


def _hash_refresh_token(refresh_token: str) -> str:
    return hashlib.sha256(refresh_token.encode()).hexdigest()


def _validate_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin not in settings.ALLOWED_ORIGINS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid origin")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = User(email=body.email.lower(), password_hash=hash_password(body.password))
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email уже используется")

    referrer_name: str | None = None

    if body.referral_code:
        code = body.referral_code.strip().upper()
        ref_code_row = await db.scalar(
            select(ReferralCode).where(ReferralCode.code == code)
        )
        if ref_code_row and ref_code_row.user_id != user.id:
            # Check not already referred
            existing = await db.scalar(
                select(Referral).where(Referral.referred_id == user.id)
            )
            if not existing:
                db.add(
                    Referral(
                        referrer_id=ref_code_row.user_id,
                        referred_id=user.id,
                        referral_code=code,
                        status="pending",
                    )
                )
                await db.commit()

                # Get referrer's display name
                from app.models.profile import StudentProfile
                referrer_profile = await db.scalar(
                    select(StudentProfile).where(
                        StudentProfile.user_id == ref_code_row.user_id
                    )
                )
                if referrer_profile:
                    referrer_name = referrer_profile.name.split()[0]

    refresh_token = create_refresh_token(user.id)
    user.refresh_token_hash = _hash_refresh_token(refresh_token)
    await db.commit()
    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        referrer_name=referrer_name,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")

    refresh_token = create_refresh_token(user.id)
    user.refresh_token_hash = _hash_refresh_token(refresh_token)
    await db.commit()
    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    _validate_origin(request)
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = decode_token(refresh_token, expected_type="refresh")
    user = await db.get(User, user_id)
    if not user or user.refresh_token_hash != _hash_refresh_token(refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    new_refresh_token = create_refresh_token(user.id)
    user.refresh_token_hash = _hash_refresh_token(new_refresh_token)
    await db.commit()
    _set_refresh_cookie(response, new_refresh_token)

    return AccessTokenResponse(access_token=create_access_token(user_id))


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _validate_origin(request)
    user = await db.get(User, user_id)
    if user:
        user.refresh_token_hash = None
        await db.commit()
    _clear_refresh_cookie(response)
    return {"success": True}


def _validate_telegram_init_data(init_data: str, bot_token: str) -> dict | None:
    """Verify Telegram WebApp initData signature. Returns parsed user dict or None.

    Telegram spec: secret_key = HMAC_SHA256(key=bot_token, data="WebAppData")
                   hash = HMAC_SHA256(key=secret_key, data=data_check_string)
    """
    if not init_data or not bot_token:
        return None
    params = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    # key=bot_token, msg="WebAppData" — order matters
    secret_key = hmac.new(bot_token.encode(), b"WebAppData", hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed, received_hash):
        return None

    user_raw = params.get("user")
    if not user_raw:
        return None  # user field required in valid Mini App initData
    try:
        return json.loads(user_raw)
    except json.JSONDecodeError:
        return None  # malformed JSON = reject


@router.post("/telegram", response_model=TelegramTokenResponse)
@limiter.limit("20/minute")
async def telegram_auth(
    request: Request,
    body: TelegramAuthRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate via Telegram WebApp initData. Creates account if new user."""
    user_data = _validate_telegram_init_data(body.init_data, settings.TELEGRAM_BOT_TOKEN)
    if not user_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверная подпись Telegram")

    # Cross-check: telegram_id in signed initData must match what client claims
    tg_id_signed = user_data.get("id")
    if tg_id_signed and str(tg_id_signed) != str(body.telegram_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверная подпись Telegram")

    tg_id = str(body.telegram_id)

    # Try to find existing user by telegram_id
    user = await db.scalar(select(User).where(User.telegram_id == tg_id))
    is_new = False

    if not user:
        is_new = True
        synthetic_email = f"tg_{tg_id}@tg.vizora.internal"
        user = User(
            email=synthetic_email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            telegram_id=tg_id,
            telegram_username=body.telegram_username,
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            await db.rollback()
            # Rare: race condition — re-fetch
            user = await db.scalar(select(User).where(User.telegram_id == tg_id))
            if not user:
                raise HTTPException(status_code=500, detail="Не удалось создать аккаунт")
            is_new = False

        # Handle referral code from deep link.
        # We're inside `if not user:` so the account is newly created regardless
        # of whether this request or a concurrent one won the INSERT race.
        # The `if not existing_ref:` guard below prevents double-granting.
        if body.referral_code:
            code = body.referral_code.strip().upper()
            ref_code_row = await db.scalar(
                select(ReferralCode).where(ReferralCode.code == code)
            )
            if ref_code_row and ref_code_row.user_id != user.id:
                existing_ref = await db.scalar(
                    select(Referral).where(Referral.referred_id == user.id)
                )
                if not existing_ref:
                    db.add(Referral(
                        referrer_id=ref_code_row.user_id,
                        referred_id=user.id,
                        referral_code=code,
                        status="pending",
                    ))
                    await db.commit()
    else:
        # Update username if changed
        if body.telegram_username and user.telegram_username != body.telegram_username:
            user.telegram_username = body.telegram_username
            await db.commit()

    # Check if profile exists to determine routing
    has_profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == user.id)
    )

    refresh_token = create_refresh_token(user.id)
    user.refresh_token_hash = _hash_refresh_token(refresh_token)
    await db.commit()
    _set_refresh_cookie(response, refresh_token)

    return TelegramTokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        is_new_user=has_profile is None,
    )
