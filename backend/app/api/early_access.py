from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.early_access import EarlyAccessEmail
from middleware.rate_limit import limiter

router = APIRouter()


class EarlyAccessRequest(BaseModel):
    email: EmailStr
    type: str = "student"

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("student", "agency"):
            raise ValueError("type must be 'student' or 'agency'")
        return v


class EarlyAccessResponse(BaseModel):
    success: bool
    count: int


@router.post("/early-access", response_model=EarlyAccessResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register_early_access(
    request: Request,
    body: EarlyAccessRequest,
    db: AsyncSession = Depends(get_db),
):
    new_entry = EarlyAccessEmail(email=body.email.lower(), type=body.type)
    db.add(new_entry)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    count_result = await db.execute(select(func.count()).select_from(EarlyAccessEmail))
    total = count_result.scalar_one()

    return EarlyAccessResponse(success=True, count=total)
