"""Kaspi Pay checkout + webhook. See app/services/kaspi_pay_client.py for what
this actually talks to (kaspi-service, not an official Kaspi API) and the
mock-mode caveat — fully testable end-to-end without real credentials or a
running kaspi-service."""

import json
import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.agency import Agency
from app.models.profile import StudentProfile
from app.models.simulator import SimulatorSession
from app.models.subscription_event import SubscriptionEvent
from app.models.user import User
from app.services import kaspi_pay_client
from app.services.subscription_service import AGENCY_PLANS, PAID_PLANS, PLAN_LIMITS, get_user_access

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])

# Placeholder pricing — a real business decision, not something to take from
# a spec literally. Yearly = 12 months at a 30% discount, rounded to a clean number.
PLAN_PRICES_KZT: dict[str, dict[str, int]] = {
    "free": {"monthly": 0, "yearly": 0},
    "standard": {"monthly": 3_900, "yearly": 32_760},
    "premium": {"monthly": 6_900, "yearly": 57_960},
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
    if body.plan not in ("standard", "premium"):
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")
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
    payment_id: str,
    db: AsyncSession,
    expected_user_id: str | None = None,
    expected_agency_id: str | None = None,
) -> dict:
    """Shared by the real webhook and the mock-mode completion endpoints (both
    the student and the agency one). Idempotent — replaying the same
    payment_id is a no-op on the second call.

    expected_user_id/expected_agency_id are set only by the mock-complete
    endpoints (an authenticated caller simulating their own Kaspi redirect) —
    the real webhook has no caller identity to check, it's authenticated by
    signature. The checkout event's own user_id/agency_id (exactly one is
    ever set) decides which side of the business gets activated.
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

    # A caller asserting a specific identity (either mock-complete endpoint)
    # must match the checkout's actual domain — a student-authenticated
    # caller can never complete an agency checkout and vice versa, regardless
    # of whether the specific id happens to match. The real webhook has no
    # caller identity at all (both stay None), so neither check fires there —
    # it's authenticated by signature instead, per this function's docstring.
    if expected_user_id is not None and checkout_event.agency_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your payment")
    if expected_agency_id is not None and checkout_event.user_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your payment")

    if checkout_event.agency_id is not None:
        return await _apply_successful_agency_payment(checkout_event, payment_id, db, expected_agency_id)

    if expected_user_id is not None and checkout_event.user_id != expected_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your payment")

    user = await db.get(User, checkout_event.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    billing_period = checkout_event.billing_period or "monthly"
    # Preserve remaining paid time only if this user was already on a paid
    # plan — subscription_status alone can't signal that anymore, since FREE
    # users are "active" too (there's no more "trial" status to tell them
    # apart). A past_due paid user renewing still keeps their remaining days;
    # a FREE user's first purchase always starts the clock from now.
    base = user.subscription_period_end if (
        user.subscription_plan in PAID_PLANS
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
    try:
        await db.commit()
    except IntegrityError:
        # Concurrent duplicate delivery of the same "paid" event beat us to
        # the commit — the unique kaspi_payment_id constraint is what
        # actually enforces idempotency; treat the race as a no-op rather
        # than surfacing a raw 500 to the webhook caller.
        await db.rollback()
        return {"status": "already_applied"}
    return {"status": "activated", "plan": user.subscription_plan, "period_end": user.subscription_period_end}


async def _apply_successful_agency_payment(
    checkout_event: SubscriptionEvent,
    payment_id: str,
    db: AsyncSession,
    expected_agency_id: str | None,
) -> dict:
    if expected_agency_id is not None and checkout_event.agency_id != expected_agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your payment")

    agency = await db.get(Agency, checkout_event.agency_id)
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")

    billing_period = checkout_event.billing_period or "monthly"
    base = agency.subscription_period_end if (
        agency.subscription_plan in AGENCY_PLANS
        and agency.subscription_period_end
        and agency.subscription_period_end > datetime.utcnow()
    ) else datetime.utcnow()

    agency.subscription_plan = checkout_event.plan
    agency.subscription_billing_period = billing_period
    agency.subscription_period_end = base + _period_length(billing_period)
    agency.kaspi_last_payment_id = payment_id

    db.add(
        SubscriptionEvent(
            agency_id=agency.id,
            event_type="payment_succeeded",
            plan=checkout_event.plan,
            amount=checkout_event.amount,
            currency="kzt",
            kaspi_payment_id=f"{payment_id}:succeeded",
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return {"status": "already_applied"}
    return {"status": "activated", "plan": agency.subscription_plan, "period_end": agency.subscription_period_end}


#: kaspi-service/src/polling.js's buildPayload — the "event" field is what we
#: actually branch on ("status" is Kaspi's own raw status string, e.g.
#: "Processed", not the paid/failed we care about here).
_WEBHOOK_EVENT_TO_STATUS = {
    "payment.success": "paid",
    "payment.failed": "failed",
    "payment.expired": "failed",
    "payment.lost": "failed",
}


@router.post("/webhook")
async def kaspi_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get("X-Webhook-Signature")
    if not kaspi_pay_client.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # kaspi-service's QrOperationId is a raw Kaspi number, so this arrives as
    # a JSON number (not a string) — coerce it to match kaspi_payment_id's
    # String(64) column, which was populated via str(qr_operation_id) at
    # checkout time. Comparing an int to a varchar silently never matches
    # (or errors) on Postgres, so every real webhook would 404 without this.
    raw_payment_id = payload.get("paymentId")
    payment_id = str(raw_payment_id) if raw_payment_id is not None else None
    event = payload.get("event")
    if not payment_id or not event:
        raise HTTPException(status_code=400, detail="Missing paymentId/event")

    payment_status = _WEBHOOK_EVENT_TO_STATUS.get(event)
    if payment_status is None:
        logger.warning("Unhandled Kaspi webhook event=%s payment_id=%s", event, payment_id)
        return {"received": True, "status": "ignored"}

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
            if checkout_event.agency_id is not None:
                # Agencies have no "past_due" concept — a failed renewal
                # simply leaves subscription_period_end where it was, and
                # get_agency_billing_status() naturally reports it as lapsed
                # once that date passes.
                db.add(
                    SubscriptionEvent(
                        agency_id=checkout_event.agency_id,
                        event_type="payment_failed",
                        plan=checkout_event.plan,
                        amount=checkout_event.amount,
                        currency="kzt",
                        kaspi_payment_id=f"{payment_id}:failed",
                    )
                )
            else:
                user = await db.get(User, checkout_event.user_id)
                # Only demote if they were already a paying subscriber — checking
                # subscription_status alone isn't enough since FREE users are
                # "active" too. A FREE user's first (failed) checkout attempt
                # shouldn't push them into past_due; they just stay on FREE.
                if user and user.subscription_plan in PAID_PLANS:
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
            try:
                await db.commit()
            except IntegrityError:
                # Same race as _apply_successful_payment's "paid" path — a
                # concurrent redelivery of this "failed" event (kaspi-service
                # retries on any non-2xx, see polling.js's sendWebhook) beat
                # us to the commit. The unique kaspi_payment_id constraint is
                # what actually enforces idempotency; treat the race as a
                # no-op instead of surfacing a raw 500 to the webhook caller.
                await db.rollback()
                return {"received": True, "status": "already_applied"}
        return {"received": True, "status": "payment_failed_recorded"}


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


