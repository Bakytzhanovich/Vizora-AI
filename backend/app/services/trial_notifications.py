"""Banner shown across authenticated pages nudging past_due users to fix
payment. Pure function over the user's subscription_status.

FREE is a permanent plan now (no trial/expiry), so there's nothing to warn a
free-plan user about here — the always-visible upgrade banner on the
dashboard covers that case instead. The only reachable transition left is a
failed Kaspi renewal charge on an already-active paid plan (see
routers/payments.py's webhook handler), which sets subscription_status to
"past_due" without touching subscription_plan/period_end.
"""


def get_subscription_banner(subscription_status: str) -> dict | None:
    if subscription_status == "past_due":
        return {
            "type": "danger",
            "color": "red",
            "message": "Проблема с оплатой — обнови способ оплаты",
            "cta": "Обновить оплату",
            "cta_url": "/pricing?renew=1",
        }
    return None
