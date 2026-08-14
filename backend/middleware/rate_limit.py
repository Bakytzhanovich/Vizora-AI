"""Shared rate limiter — imported by main.py and every router that applies
per-endpoint limits. A single shared instance (not one per module) so all
limits are tracked against the same in-memory counters and the same
default_limits fallback applies everywhere.
"""

import asyncio
import logging
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.services.security_logger import log_suspicious_activity

logger = logging.getLogger(__name__)

# In-memory storage (slowapi's default) — fine for a single-process deploy
# like Render's free tier. If the backend ever scales to multiple instances,
# this needs a shared backend (e.g. Redis) or each instance enforces its own
# independent quota, effectively multiplying the limit by instance count.
#
# headers_enabled is deliberately left at its default (False). Turning it on
# makes slowapi's own decorator try to inject X-RateLimit-*/Retry-After
# headers into every SUCCESSFUL response too — via `kwargs.get("response")`
# for any endpoint whose signature doesn't happen to declare its own
# `response: Response` parameter, that's `None`, and slowapi raises instead
# of no-op'ing, turning a 200 into a 500 (found live: crashed /agency/login,
# and would've hit /chat/message, /simulator/*, /agency/team/invite too).
# Retry-After for the 429 case is computed manually below instead, without
# going through that code path at all.
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


def _retry_after_seconds(request: Request) -> int:
    """Real seconds-until-reset for the specific limit that was hit, computed
    the same way slowapi's own (headers_enabled-gated) _inject_headers does
    internally — reimplemented here since that path can't be used without
    hitting the crash described above."""
    current_limit = getattr(request.state, "view_rate_limit", None)
    if not current_limit:
        return 60
    try:
        item, identifiers = current_limit
        reset_at = 1 + limiter.limiter.get_window_stats(item, *identifiers)[0]
        return max(1, int(reset_at - time.time()))
    except (TypeError, ValueError, AttributeError, IndexError):
        # Reaches into slowapi's private storage internals (limiter.limiter,
        # get_window_stats) — narrowed to the specific ways that shape can
        # legitimately fail, with a log line, so a future slowapi upgrade
        # that changes it degrades LOUDLY (visible in logs) instead of
        # silently reporting a plausible-but-wrong 60s forever.
        logger.warning("Failed to compute Retry-After from slowapi internals", exc_info=True)
        return 60


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Russian-language 429 body, with Retry-After computed from the actual
    limit window that was hit rather than a hardcoded guess."""
    retry_after = _retry_after_seconds(request)

    # Fire-and-forget — logging must never add latency to the 429 the client
    # is waiting on, especially since this is the exact response path a
    # burst of traffic (the scenario the debounce/logging exists to survive)
    # hits hardest.
    asyncio.create_task(log_suspicious_activity(
        event_type="rate_limit_exceeded",
        ip=get_remote_address(request),
        details={"path": request.url.path, "method": request.method},
    ))

    return JSONResponse(
        status_code=429,
        content={
            "error": "Слишком много запросов",
            "message": "Подожди немного и попробуй снова",
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )
