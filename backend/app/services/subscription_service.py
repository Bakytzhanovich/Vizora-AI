"""Free / Standard / Premium plan access control.

FREE is a permanent plan, not a trial — anyone who hasn't subscribed stays on
FREE forever (no expiry, no countdown). Kaspi Pay has no native recurring-
subscription object, so "subscription" here is just: user.subscription_plan
is a paid tier and user.subscription_period_end is in the future. A lapsed
paid period falls back to FREE rather than a hard "expired" wall — renewal
is emulated by each successful Kaspi payment pushing subscription_period_end
forward (see routers/payments.py).
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.models.simulator import SimulatorSession
from app.models.user import User

PAID_PLANS = ("standard", "premium", "agency_starter", "agency_business", "agency_partner")
AGENCY_PLANS = ("agency_starter", "agency_business", "agency_partner")
AGENCY_FREE_PERIOD_DAYS = 30

PLAN_LIMITS: dict[str, dict] = {
    "free": {
        "faq_per_day": 5,
        "simulator_sessions_total": 1,
        "simulator_sessions_per_month": None,
        "simulator_session_max_minutes": 5,
        "consul_mode": False,
        "detailed_feedback": False,
        "risk_solutions": False,
        "after_visa": False,
        "emergency": False,
        "ds160_guide": False,
        "pdf_report": False,
        "priority_support": False,
    },
    "standard": {
        "faq_per_day": None,
        "simulator_sessions_total": None,
        "simulator_sessions_per_month": 5,
        "simulator_session_max_minutes": None,
        "consul_mode": True,
        "detailed_feedback": True,
        "risk_solutions": True,
        "after_visa": True,
        "emergency": True,
        "ds160_guide": True,
        "pdf_report": False,
        "priority_support": False,
    },
    "premium": {
        "faq_per_day": None,
        "simulator_sessions_total": None,
        "simulator_sessions_per_month": None,
        "simulator_session_max_minutes": None,
        "consul_mode": True,
        "detailed_feedback": True,
        "risk_solutions": True,
        "after_visa": True,
        "emergency": True,
        "ds160_guide": True,
        "pdf_report": True,
        "priority_support": True,
    },
}

# Agency plans gate on team-level features elsewhere (routers/agency*.py) —
# they always get the full feature set here, matching "premium" behavior for
# an individual agency-owner account.
for _agency_plan in ("agency_starter", "agency_business", "agency_partner"):
    PLAN_LIMITS[_agency_plan] = dict(PLAN_LIMITS["premium"])

FEATURE_KEYS = {
    "simulator", "consul_mode", "faq", "after_visa", "emergency",
    "risk_solutions", "ds160_guide", "detailed_feedback", "pdf_report", "priority_support",
}


def set_free_plan(user: User) -> None:
    """Every new account starts here — permanently, unless they subscribe.
    Called from every registration path (register, Google, Telegram)."""
    user.subscription_plan = "free"
    user.subscription_status = "active"


async def get_user_access(user: User, db: AsyncSession) -> dict:
    # Admin/agency-staff accounts (e.g. the env-var bootstrap admin) are never paywalled.
    if user.role == "admin":
        return {"plan": "premium", "limits": PLAN_LIMITS["premium"], "period_end": None, "sessions_ok": True}

    now = datetime.utcnow()
    plan = user.subscription_plan or "free"

    if plan in PAID_PLANS and user.subscription_period_end and user.subscription_period_end <= now:
        # Paid period lapsed (e.g. Kaspi renewal never landed) — fall back to
        # the permanent free plan, not a hard "expired" wall.
        user.subscription_plan = "free"
        user.subscription_status = "active"
        await db.commit()
        plan = "free"

    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    result: dict = {"plan": plan, "limits": limits, "period_end": user.subscription_period_end}

    if limits.get("simulator_sessions_per_month") is not None:
        result["sessions_used"] = user.sessions_used_this_month
        result["sessions_limit"] = limits["simulator_sessions_per_month"]
        result["sessions_ok"] = user.sessions_used_this_month < limits["simulator_sessions_per_month"]
    elif limits.get("simulator_sessions_total") is not None:
        total_used = await db.scalar(
            select(func.count()).select_from(SimulatorSession).where(SimulatorSession.user_id == user.id)
        )
        limit = limits["simulator_sessions_total"]
        # Cap the displayed count at the limit — a user who downgrades back to
        # FREE after racking up many sessions on a paid plan would otherwise
        # show a nonsensical "23/1 used" instead of a sane "1/1".
        result["sessions_used"] = min(total_used or 0, limit)
        result["sessions_limit"] = limit
        result["sessions_ok"] = (total_used or 0) < limit
    else:
        result["sessions_ok"] = True  # unlimited

    return result


async def check_feature_access(user_id: str, feature: str, db: AsyncSession) -> tuple[bool, str]:
    """Returns (has_access, reason).

    feature options: simulator, consul_mode, faq, after_visa, emergency,
    risk_solutions, ds160_guide, detailed_feedback, pdf_report, priority_support
    """
    if feature not in FEATURE_KEYS:
        raise ValueError(f"Unknown feature: {feature}")

    user = await db.get(User, user_id)
    if not user:
        return False, "not_found"

    access = await get_user_access(user, db)
    limits = access["limits"]

    if feature == "simulator":
        if not access.get("sessions_ok", True):
            return False, "sessions_limit"
        return True, "ok"

    if feature == "faq":
        if limits["faq_per_day"] is None:
            return True, "ok"
        today = date.today()
        if user.faq_reset_date != today:
            user.faq_used_today = 0
            user.faq_reset_date = today
        if user.faq_used_today < limits["faq_per_day"]:
            # Increment right here, atomically with the check that grants
            # access — this counter only exists to cap free-plan users, so it
            # must never move for standard/premium users (faq_per_day: None
            # short-circuits above before this runs).
            user.faq_used_today += 1
            await db.commit()
            return True, "ok"
        await db.commit()
        return False, "faq_limit"

    if limits.get(feature, False):
        return True, "ok"
    return False, "subscription_required"


async def increment_simulator_usage(user_id: str, db: AsyncSession) -> None:
    user = await db.get(User, user_id)
    if user:
        user.sessions_used_this_month += 1
        await db.commit()


def get_agency_billing_status(agency: Agency) -> dict:
    """Powers the agency dashboard/settings billing badge.

    An agency has no trial concept anymore — it's either on a paid plan
    (subscription_period_end in the future) or coasting on a 30-day free
    period counted from signup. Both can lapse, which is surfaced as a
    distinct status so the frontend can show the right CTA.
    """
    now = datetime.utcnow()
    if agency.subscription_plan in AGENCY_PLANS:
        period_end = agency.subscription_period_end
        if period_end and period_end > now:
            return {"status": "paid", "plan": agency.subscription_plan, "period_end": period_end}
        return {"status": "expired_paid", "plan": agency.subscription_plan, "period_end": period_end}

    free_until = agency.created_at + timedelta(days=AGENCY_FREE_PERIOD_DAYS)
    if now < free_until:
        return {"status": "free", "free_until": free_until}
    return {"status": "expired_free", "free_until": free_until}
