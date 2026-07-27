"""Trial + subscription access control.

Kaspi Pay has no native recurring-subscription object (unlike Stripe), so a
"subscription" here is just: user.subscription_status == "active" and
user.subscription_period_end in the future. Renewal is emulated — each
successful Kaspi payment pushes subscription_period_end forward (see
routers/payments.py) rather than a webhook renewing it automatically.
"""

from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

TRIAL_DAYS = 7

PLAN_LIMITS: dict[str, dict] = {
    "basic": {
        "simulator_sessions_per_month": 2,
        "faq_per_day": None,  # unlimited
        "consul_mode": False,
        "risk_analysis": False,
        "after_visa": False,
        "emergency": False,
    },
    "standard": {
        "simulator_sessions_per_month": 5,
        "faq_per_day": None,
        "consul_mode": True,
        "risk_analysis": True,
        "after_visa": True,
        "emergency": True,
    },
    "premium": {
        "simulator_sessions_per_month": None,  # unlimited
        "faq_per_day": None,
        "consul_mode": True,
        "risk_analysis": True,
        "after_visa": True,
        "emergency": True,
    },
}

# Agency plans gate on team-level features elsewhere (routers/agency*.py) —
# they always get the full feature set here, matching "premium" behavior for
# an individual agency-owner account.
for _agency_plan in ("agency_starter", "agency_business", "agency_partner"):
    PLAN_LIMITS[_agency_plan] = dict(PLAN_LIMITS["premium"])

EXPIRED_LIMITS: dict = {
    "faq_per_day": 3,
    "simulator_sessions_per_month": 0,
    "consul_mode": False,
    "risk_analysis": False,
    "after_visa": False,
    "emergency": False,
}

FEATURE_KEYS = {"simulator", "consul_mode", "faq", "after_visa", "emergency", "risk_analysis"}


def start_trial(user: User) -> None:
    """Set trial_started_at/trial_ends_at/subscription_status on a freshly
    created user. Called from every registration path (register, Google,
    Telegram) so nobody skips the trial clock."""
    now = datetime.utcnow()
    user.trial_started_at = now
    user.trial_ends_at = now + timedelta(days=TRIAL_DAYS)
    user.subscription_status = "trial"


async def get_user_access(user: User, db: AsyncSession) -> dict:
    # Admin/agency-staff accounts (e.g. the env-var bootstrap admin, which is
    # created without ever going through start_trial) are never paywalled.
    if user.role == "admin":
        return {"status": "active", "full_access": True, "limits": PLAN_LIMITS["premium"]}

    now = datetime.utcnow()

    if user.subscription_status == "trial":
        if user.trial_ends_at and user.trial_ends_at > now:
            days_remaining = max(0, (user.trial_ends_at - now).days)
            return {
                "status": "trial",
                "full_access": True,
                "days_remaining": days_remaining,
                "trial_ends_at": user.trial_ends_at,
                "limits": PLAN_LIMITS["premium"],
            }

        # Trial just expired — flip status so subsequent requests short-circuit
        # on the cheap "expired" branch below instead of re-checking the date.
        user.subscription_status = "expired"
        await db.commit()
        return {"status": "expired", "full_access": False, "limits": EXPIRED_LIMITS}

    if user.subscription_status == "active":
        # A paid period that has silently lapsed (e.g. Kaspi renewal payment
        # never landed) should behave like "expired", not keep full access.
        if user.subscription_period_end and user.subscription_period_end <= now:
            user.subscription_status = "expired"
            await db.commit()
            return {"status": "expired", "full_access": False, "limits": EXPIRED_LIMITS}

        plan = user.subscription_plan
        limits = PLAN_LIMITS.get(plan, EXPIRED_LIMITS)

        sessions_ok = True
        if limits["simulator_sessions_per_month"] is not None:
            sessions_ok = user.sessions_used_this_month < limits["simulator_sessions_per_month"]

        return {
            "status": "active",
            "plan": plan,
            "full_access": True,
            "limits": limits,
            "sessions_used": user.sessions_used_this_month,
            "sessions_limit": limits["simulator_sessions_per_month"],
            "sessions_ok": sessions_ok,
            "period_end": user.subscription_period_end,
        }

    # expired, canceled, past_due
    return {"status": user.subscription_status, "full_access": False, "limits": EXPIRED_LIMITS}


async def _reset_faq_count(user: User, today: date, db: AsyncSession) -> None:
    user.faq_used_today = 0
    user.faq_reset_date = today
    await db.commit()


async def check_feature_access(user_id: str, feature: str, db: AsyncSession) -> tuple[bool, str]:
    """Returns (has_access, reason).

    feature options: simulator, consul_mode, faq, after_visa, emergency, risk_analysis
    """
    if feature not in FEATURE_KEYS:
        raise ValueError(f"Unknown feature: {feature}")

    user = await db.get(User, user_id)
    if not user:
        return False, "not_found"

    access = await get_user_access(user, db)
    limits = access["limits"]

    if access["full_access"]:
        if feature == "simulator":
            if not access.get("sessions_ok", True):
                return False, "sessions_limit"
            return True, "ok"
        if feature == "faq":
            return True, "ok"
        # NOTE: the original spec returned True unconditionally here for any
        # full_access user, which let a "basic" subscriber (full_access=True,
        # but PLAN_LIMITS["basic"]["consul_mode"] etc. are all False) through
        # to features their plan doesn't include. Boolean features must still
        # respect the plan's own limits — only a trial user's limits dict is
        # always all-True (PLAN_LIMITS["premium"]).
        if limits.get(feature, False):
            return True, "ok"
        return False, "subscription_required"

    # No full access (expired / canceled / past_due)
    if feature == "simulator":
        return False, "subscription_required"

    if feature == "faq":
        today = date.today()
        if user.faq_reset_date != today:
            await _reset_faq_count(user, today, db)
            return True, "ok"
        if user.faq_used_today < limits["faq_per_day"]:
            return True, "ok"
        return False, "faq_limit"

    return False, "subscription_required"


async def increment_simulator_usage(user_id: str, db: AsyncSession) -> None:
    user = await db.get(User, user_id)
    if user:
        user.sessions_used_this_month += 1
        await db.commit()


async def increment_faq_usage(user_id: str, db: AsyncSession) -> None:
    user = await db.get(User, user_id)
    if not user:
        return
    today = date.today()
    if user.faq_reset_date != today:
        user.faq_used_today = 0
        user.faq_reset_date = today
    user.faq_used_today += 1
    await db.commit()
