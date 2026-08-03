"""Kaspi Pay checkout + webhook. See app/services/kaspi_pay_client.py for the
mock-mode caveat — this is fully testable end-to-end without real credentials,
but the actual HTTP calls to Kaspi are placeholders pending merchant docs."""

import json
import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.profile import StudentProfile
from app.models.simulator import SimulatorSession
from app.models.subscription_event import SubscriptionEvent
from app.models.user import User
from app.services import kaspi_pay_client
from app.services.subscription_service import PLAN_LIMITS, get_user_access

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])

# Placeholder pricing — a real business decision, not something to take from
# a spec literally. Yearly = 12 months at a 30% discount, rounded to a clean number.
PLAN_PRICES_KZT: dict[str, dict[str, int]] = {
    "free": {"monthly": 0, "yearly": 0},
    "standard": {"monthly": 4_900, "yearly": 41_200},
    "premium": {"monthly": 7_900, "yearly": 66_400},
    "agency_starter": {"monthly": 149_000, "yearly": 1_251_600},
    "agency_business": {"monthly": 299_000, "yearly": 2_511_600},
    "agency_partner": {"monthly": 499_000, "yearly": 4_191_600},
}

PLAN_NAMES_RU = {
    "free": "Бесплатный",
    "standard": "Стандарт",
    "premium": "Премиум",
    "agency_starter": "Agency Starter",
    "agency_business": "Agency Business",
    "agency_partner": "Agency Partner",
}

# Promo discount for FREE-plan users upgrading — separate from any trial
# concept (there is no trial anymore, FREE is permanent).
UPGRADE_DISCOUNT_CODE = "trial30"
UPGRADE_DISCOUNT_RATE = 0.3


@router.get("/plans")
async def list_plans():
    """Public — powers the /pricing page. Single source of truth for
    price + feature limits so the frontend never hardcodes a duplicate copy."""
    return {
        "plans": [
            {
                "id": plan_id,
                "name": PLAN_NAMES_RU.get(plan_id, plan_id),
                "prices_kzt": prices,
                "limits": PLAN_LIMITS.get(plan_id, {}),
            }
            for plan_id, prices in PLAN_PRICES_KZT.items()
        ],
        "upgrade_discount_code": UPGRADE_DISCOUNT_CODE,
        "upgrade_discount_rate": UPGRADE_DISCOUNT_RATE,
    }


@router.get("/social-proof")
async def social_proof(db: AsyncSession = Depends(get_db)):
    """Public — powers the trust row under /pricing plans. Computed from real
    data (not hardcoded) so it never drifts out of sync with actual usage.

    Scores are stored as a JSON blob per session (see SimulatorSession.scores),
    so averaging happens in Python rather than a dialect-specific JSON query —
    this app runs on both SQLite (local dev) and Postgres (prod), and this
    mirrors the same pattern already used in /trial-summary above.
    """
    student_count = await db.scalar(select(func.count(StudentProfile.id)))

    sessions = list(
        (
            await db.execute(
                select(SimulatorSession.scores).where(SimulatorSession.completed.is_(True))
            )
        )
        .scalars()
        .all()
    )
    scores: list[float] = []
    for raw in sessions:
        if not raw:
            continue
        try:
            overall = json.loads(raw).get("overall")
        except (json.JSONDecodeError, AttributeError):
            continue
        if isinstance(overall, (int, float)):
            scores.append(float(overall))

    return {
        "student_count": student_count or 0,
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
    }


class CreatePaymentRequest(BaseModel):
    plan: str
    billing_period: str = "monthly"  # "monthly" | "yearly"
    discount_code: str | None = None


@router.post("/create-payment", status_code=status.HTTP_201_CREATED)
async def create_payment(
    body: CreatePaymentRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if body.plan not in PLAN_PRICES_KZT:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")
    if body.plan == "free":
        raise HTTPException(status_code=400, detail="Free plan doesn't require payment")
    if body.billing_period not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="billing_period must be 'monthly' or 'yearly'")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access = await get_user_access(user, db)

    amount = PLAN_PRICES_KZT[body.plan][body.billing_period]
    discount_applied = False
    if body.discount_code == UPGRADE_DISCOUNT_CODE and access["plan"] == "free":
        amount = round(amount * (1 - UPGRADE_DISCOUNT_RATE))
        discount_applied = True

    order_id = str(uuid.uuid4())
    result = await kaspi_pay_client.create_payment(
        order_id=order_id,
        amount_kzt=amount,
        description=f"Vizora AI — {PLAN_NAMES_RU.get(body.plan, body.plan)} ({body.billing_period})",
    )

    db.add(
        SubscriptionEvent(
            user_id=user_id,
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
        "discount_applied": discount_applied,
        "mock_mode": kaspi_pay_client.is_mock_mode(),
    }


def _period_length(billing_period: str) -> timedelta:
    return timedelta(days=365) if billing_period == "yearly" else timedelta(days=31)


async def _apply_successful_payment(
    payment_id: str, db: AsyncSession, expected_user_id: str | None = None
) -> dict:
    """Shared by the real webhook and the mock-mode completion endpoint.
    Idempotent — replaying the same payment_id is a no-op on the second call.

    expected_user_id is set only by the mock-complete endpoint (an
    authenticated caller simulating their own Kaspi redirect) — the real
    webhook has no caller identity to check, it's authenticated by signature.
    """
    # Succeeded/failed events are stored under a suffixed id (see below) since
    # kaspi_payment_id is unique and the same payment_id already owns the
    # "checkout_created" row.
    already_applied = await db.scalar(
        select(SubscriptionEvent).where(
            SubscriptionEvent.kaspi_payment_id == f"{payment_id}:succeeded",
            SubscriptionEvent.event_type == "payment_succeeded",
        )
    )
    if already_applied:
        return {"status": "already_applied"}

    checkout_event = await db.scalar(
        select(SubscriptionEvent).where(
            SubscriptionEvent.kaspi_payment_id == payment_id,
            SubscriptionEvent.event_type == "checkout_created",
        )
    )
    if not checkout_event:
        raise HTTPException(status_code=404, detail="Unknown payment_id")

    if expected_user_id is not None and checkout_event.user_id != expected_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your payment")

    user = await db.get(User, checkout_event.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    billing_period = checkout_event.billing_period or "monthly"
    base = user.subscription_period_end if (
        user.subscription_status == "active"
        and user.subscription_period_end
        and user.subscription_period_end > datetime.utcnow()
    ) else datetime.utcnow()

    user.subscription_status = "active"
    user.subscription_plan = checkout_event.plan
    user.subscription_billing_period = billing_period
    user.subscription_period_end = base + _period_length(billing_period)
    user.kaspi_last_payment_id = payment_id
    user.sessions_used_this_month = 0

    db.add(
        SubscriptionEvent(
            user_id=user.id,
            event_type="payment_succeeded",
            plan=checkout_event.plan,
            amount=checkout_event.amount,
            currency="kzt",
            kaspi_payment_id=f"{payment_id}:succeeded",
        )
    )
    await db.commit()
    return {"status": "activated", "plan": user.subscription_plan, "period_end": user.subscription_period_end}


@router.post("/webhook")
async def kaspi_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get("X-Kaspi-Signature")
    if not kaspi_pay_client.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    payment_id = payload.get("paymentId")
    payment_status = payload.get("status")
    if not payment_id or not payment_status:
        raise HTTPException(status_code=400, detail="Missing paymentId/status")

    if payment_status == "paid":
        result = await _apply_successful_payment(payment_id, db)
        return {"received": True, **result}

    if payment_status == "failed":
        already_recorded = await db.scalar(
            select(SubscriptionEvent).where(
                SubscriptionEvent.kaspi_payment_id == f"{payment_id}:failed",
                SubscriptionEvent.event_type == "payment_failed",
            )
        )
        if already_recorded:
            return {"received": True, "status": "already_applied"}

        checkout_event = await db.scalar(
            select(SubscriptionEvent).where(
                SubscriptionEvent.kaspi_payment_id == payment_id,
                SubscriptionEvent.event_type == "checkout_created",
            )
        )
        if checkout_event:
            user = await db.get(User, checkout_event.user_id)
            # Only demote if this was a renewal for an already-active plan —
            # a failed first-time checkout shouldn't push a trial user to past_due.
            if user and user.subscription_status == "active":
                user.subscription_status = "past_due"
            db.add(
                SubscriptionEvent(
                    user_id=checkout_event.user_id,
                    event_type="payment_failed",
                    plan=checkout_event.plan,
                    amount=checkout_event.amount,
                    currency="kzt",
                    kaspi_payment_id=f"{payment_id}:failed",
                )
            )
            await db.commit()
        return {"received": True, "status": "payment_failed_recorded"}

    logger.warning("Unhandled Kaspi webhook status=%s payment_id=%s", payment_status, payment_id)
    return {"received": True, "status": "ignored"}


@router.post("/mock-complete/{payment_id}")
async def mock_complete_payment(
    payment_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Dev-only: simulates a successful Kaspi webhook without a real Kaspi
    sandbox. 404s outside mock mode so this can never fire in production.

    Requires auth and checks the caller owns the checkout — mock mode is the
    default until real Kaspi credentials exist, so without this any client
    that learned a payment_id (e.g. from watching network traffic) could
    activate someone else's pending checkout for free.
    """
    if not kaspi_pay_client.is_mock_mode():
        raise HTTPException(status_code=404, detail="Not found")
    result = await _apply_successful_payment(payment_id, db, expected_user_id=user_id)
    return {"received": True, **result}


@router.get("/status")
async def payment_status(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    access = await get_user_access(user, db)
    return {
        **access,
        "billing_period": user.subscription_billing_period,
    }


