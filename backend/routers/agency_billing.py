"""Kaspi Pay checkout for agency (B2B) plans — reuses the same Kaspi client
and idempotent payment-application logic as the student side (see
routers/payments.py), scoped to Agency instead of User."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.agency_auth import AgencyCtx, require_admin
from app.core.database import get_db
from app.models.subscription_event import SubscriptionEvent
from app.services import kaspi_pay_client
from app.services.subscription_service import AGENCY_PLANS
from routers.payments import PLAN_NAMES_RU, PLAN_PRICES_KZT, _apply_successful_payment

router = APIRouter(prefix="/agency/billing", tags=["agency-billing"])


class CreateAgencyPaymentRequest(BaseModel):
    plan: str
    billing_period: str = "monthly"  # "monthly" | "yearly"


@router.post("/create-payment", status_code=status.HTTP_201_CREATED)
async def create_agency_payment(
    body: CreateAgencyPaymentRequest,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.plan not in AGENCY_PLANS:
        raise HTTPException(status_code=400, detail=f"Unknown agency plan: {body.plan}")
    if body.billing_period not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="billing_period must be 'monthly' or 'yearly'")

    amount = PLAN_PRICES_KZT[body.plan][body.billing_period]

    order_id = str(uuid.uuid4())
    result = await kaspi_pay_client.create_payment(
        order_id=order_id,
        amount_kzt=amount,
        description=f"Vizora AI Agency — {PLAN_NAMES_RU.get(body.plan, body.plan)} ({body.billing_period})",
    )

    db.add(
        SubscriptionEvent(
            agency_id=ctx.agency_id,
            event_type="checkout_created",
            plan=body.plan,
            billing_period=body.billing_period,
            amount=amount,
            currency="kzt",
            kaspi_payment_id=result.payment_id,
        )
    )
    await db.commit()

    return {
        "payment_id": result.payment_id,
        "pay_url": result.pay_url,
        "amount": amount,
        "currency": "kzt",
        "mock_mode": kaspi_pay_client.is_mock_mode(),
    }


@router.post("/mock-complete/{payment_id}")
async def mock_complete_agency_payment(
    payment_id: str,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Dev-only: simulates a successful Kaspi webhook without a real Kaspi
    sandbox. 404s outside mock mode so this can never fire in production."""
    if not kaspi_pay_client.is_mock_mode():
        raise HTTPException(status_code=404, detail="Not found")
    result = await _apply_successful_payment(payment_id, db, expected_agency_id=ctx.agency_id)
    return {"received": True, **result}
