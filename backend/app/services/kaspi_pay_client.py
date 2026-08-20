"""Kaspi Pay client.

IMPORTANT — read before touching this:

Kaspi Pay has no public, self-serve API/SDK — a signed merchant agreement
with Kaspi Bank would be the officially supported route. Instead, this talks
to `kaspi-service` (../kaspi-service — a clone of the open-source
tapter-dev/kaspi-pos-automation), which automates QR payments through the
merchant's own Kaspi Pay for Business app session (device-fingerprint +
request-signing that mimics the real app). See that service's README for
the one-time SMS login procedure and the ToS/reliability caveats — this is
NOT an officially supported integration and can break on a Kaspi app update.

kaspi-service is stateless after login: it expects the merchant session
(X-Token-SN / X-Vtoken-Secret / X-Profile-Id) as headers on every request,
rather than holding it itself — so *we* are the one holding it, in
settings.KASPI_TOKEN_SN / KASPI_VTOKEN_SECRET / KASPI_PROFILE_ID (populated
once from the login response, then left untouched — see config.py).

Mode is derived solely from whether KASPI_SERVICE_URL is configured — there
is deliberately no separate on/off flag for this (a prior version of this
file had a KASPI_MOCK_MODE setting that could drift from the credentials and
silently disable webhook signature verification; see git history). Mock mode
simulates the flow entirely in-process so the rest of the monetization system
(access control, webhooks, DB updates) can be built and tested end to end
without a running kaspi-service.

payment_id is always Kaspi's own QrOperationId (never something we invent) —
it's what SubscriptionEvent.kaspi_payment_id is keyed on, and it's exactly
the `paymentId` kaspi-service's webhook echoes back (see
kaspi-service/src/polling.js's buildPayload), so the two line up without
this client needing to track a separate id mapping.
"""

import hashlib
import hmac
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
    return not settings.KASPI_SERVICE_URL


def _session_headers() -> dict[str, str]:
    return {
        "X-Token-SN": settings.KASPI_TOKEN_SN,
        "X-Vtoken-Secret": settings.KASPI_VTOKEN_SECRET,
        "X-Profile-Id": settings.KASPI_PROFILE_ID,
        # kaspi-service rejects every route without this — see its
        # src/internalAuth.js and the KASPI_SERVICE_KEY docstring above.
        "X-Internal-Key": settings.KASPI_SERVICE_KEY,
    }


async def create_payment(order_id: str, amount_kzt: int, description: str) -> KaspiPaymentResult:
    """Create a Kaspi Pay QR payment for a one-time charge.

    Kaspi has no subscription object — each billing period is its own
    payment; renewal is emulated by the caller extending subscription_period_end.

    `order_id`/`description` are accepted for interface parity with the
    caller (payments.py generates order_id per checkout) but otherwise
    unused — see module docstring for why payment_id is Kaspi's
    QrOperationId instead, and Kaspi's QR flow has no free-text field for a
    description (unlike its invoice/phone-number flow, which this doesn't
    use). order_id is still logged below (real and mock mode alike) so a
    checkout can be traced from order_id to the QrOperationId that actually
    owns the SubscriptionEvent row.
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

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.KASPI_SERVICE_URL}/api/qr/create",
            headers=_session_headers(),
            json={"amount": amount_kzt},
        )
        resp.raise_for_status()
        data = resp.json().get("Data") or {}
        qr_operation_id = data.get("QrOperationId")
        qr_token = data.get("QrToken")
        if not qr_operation_id or not qr_token:
            raise RuntimeError(f"kaspi-service response missing QrOperationId/QrToken: {resp.text}")
        logger.info(
            "Kaspi payment created order=%s amount=%s KZT qrOperationId=%s",
            order_id, amount_kzt, qr_operation_id,
        )
        return KaspiPaymentResult(payment_id=str(qr_operation_id), pay_url=qr_token)


# Mirrors kaspi-service/src/polling.js's QR_FINAL_STATUSES — any status not
# listed here (QrTokenCreated, Wait, ...) is a genuine in-progress state.
_KASPI_FAILED_STATUSES = {
    "CancelledByUser",
    "NotConfirmedByUser",
    "CancelledByExternalSource",
    "ProcessingFailed",
    "Rejected",
    "InsufficientFunds",
    "InsufficientFundsError",
    "Error",
    "IrisSrcBlockCode1",
    "IrisSrcBlockCode3",
    "IrisSrcBlockCode9",
    "IrisDestBlockCode3",
    "IrisDestBlockCode5",
    "IrisDestBlockCode7",
    "IrisDestBlockCode10",
    "QrTokenDiscarded",
    "Expired",
}


async def get_payment_status(payment_id: str) -> str:
    """Returns 'pending' | 'paid' | 'failed'. Only meaningful in real mode —
    mock payments are marked paid synchronously by /payments/mock-complete.
    Not on the hot path: kaspi-service pushes the outcome via webhook as soon
    as it knows it, so callers rarely need to ask."""
    if is_mock_mode():
        return "pending"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{settings.KASPI_SERVICE_URL}/api/qr/status",
            params={"qrOperationId": payment_id},
            headers=_session_headers(),
        )
        resp.raise_for_status()
        kaspi_status = (resp.json().get("Data") or {}).get("Status")
        if kaspi_status == "Processed":
            return "paid"
        if kaspi_status in _KASPI_FAILED_STATUSES:
            return "failed"
        return "pending"


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    """Verifies the webhook kaspi-service sends (kaspi-service/src/polling.js
    sendWebhook — HMAC-SHA256 over the raw body, header `sha256=<hex>`,
    secret from a webhooks.json entry that must equal KASPI_WEBHOOK_SECRET).
    Mock mode always accepts."""
    if is_mock_mode():
        return True
    if not settings.KASPI_WEBHOOK_SECRET or not signature:
        return False
    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(settings.KASPI_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.removeprefix("sha256="))
