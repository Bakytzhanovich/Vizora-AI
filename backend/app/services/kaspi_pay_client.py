"""Kaspi Pay client.

IMPORTANT — read before wiring this to production:

Unlike Stripe, Kaspi Pay has no public, self-serve API/SDK. Integration
requires a signed merchant agreement with Kaspi Bank, who then provide
merchant-specific credentials and endpoint documentation. The exact request/
response shape below (`_create_payment_request`, `_parse_payment_response`,
webhook signature scheme) is a best-effort placeholder matching the general
shape of Kaspi Pay for Business integrations (create a payment → get back a
pay/QR link → merchant is notified on completion) — it is NOT verified
against Kaspi's real API and WILL need adjusting once you have the actual
docs from your Kaspi merchant onboarding.

Until then, mock mode (active whenever KASPI_API_KEY is unset) simulates the
flow entirely in-process so the rest of the monetization system (trial,
access control, webhooks, DB updates) can be built and tested end to end
without real credentials.

Mode is derived solely from whether KASPI_API_KEY is configured — there is
deliberately no separate on/off flag for this. A previous version had a
KASPI_MOCK_MODE setting that defaulted to true and was OR'd with the missing-
key check, so setting a real API key in production without also remembering
to flip that flag left webhook signature verification silently disabled
(verify_webhook_signature() short-circuits to True in mock mode) — any
logged-in user could create a payment for themselves and then hit the
unauthenticated webhook directly to mark it paid for free. Deriving mode from
the API key alone removes that misconfiguration entirely: real credentials
always mean real (signature-verified) mode, with no second switch to forget.
"""

import logging
import uuid

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class KaspiPaymentResult:
    def __init__(self, payment_id: str, pay_url: str):
        self.payment_id = payment_id
        self.pay_url = pay_url


def is_mock_mode() -> bool:
    return not settings.KASPI_API_KEY


async def create_payment(order_id: str, amount_kzt: int, description: str) -> KaspiPaymentResult:
    """Create a Kaspi Pay payment (QR / pay-by-link) for a one-time charge.

    Kaspi has no subscription object — each billing period is its own
    payment; renewal is emulated by the caller extending subscription_period_end.
    """
    if is_mock_mode():
        payment_id = f"mock_{uuid.uuid4().hex[:16]}"
        logger.info(
            "Kaspi mock mode: simulated payment created order=%s amount=%s KZT id=%s",
            order_id, amount_kzt, payment_id,
        )
        # In mock mode there's no real Kaspi app to redirect to — the frontend's
        # dev-only "mock-complete" button hits POST /payments/mock-complete instead.
        return KaspiPaymentResult(payment_id=payment_id, pay_url=f"/payments/mock-complete/{payment_id}")

    # --- Real Kaspi Pay call (placeholder shape, see module docstring) ---
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.KASPI_API_BASE_URL}/payments",
            headers={"Authorization": f"Bearer {settings.KASPI_API_KEY}"},
            json={
                "merchantId": settings.KASPI_MERCHANT_ID,
                "orderId": order_id,
                "amount": amount_kzt,
                "currency": "KZT",
                "description": description,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return KaspiPaymentResult(payment_id=data["paymentId"], pay_url=data["payUrl"])


async def get_payment_status(payment_id: str) -> str:
    """Returns 'pending' | 'paid' | 'failed'. Only meaningful in real mode —
    mock payments are marked paid synchronously by /payments/mock-complete."""
    if is_mock_mode():
        return "pending"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{settings.KASPI_API_BASE_URL}/payments/{payment_id}",
            headers={"Authorization": f"Bearer {settings.KASPI_API_KEY}"},
        )
        resp.raise_for_status()
        return resp.json()["status"]


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    """Placeholder — real signature scheme (HMAC header name, digest algo)
    comes from Kaspi's merchant docs. Mock mode always accepts."""
    if is_mock_mode():
        return True
    if not settings.KASPI_WEBHOOK_SECRET or not signature:
        return False
    import hashlib
    import hmac

    expected = hmac.new(settings.KASPI_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
