"""Best-effort logging of security-relevant events (failed logins, rate-limit
hits, invalid tokens) for later review. Never raises — a logging failure must
never break the request that triggered it."""

import json
import logging
import time
import uuid
from collections import OrderedDict
from datetime import datetime
from typing import Any

from app.core.database import AsyncSessionLocal
from app.models.security_log import SecurityLog

logger = logging.getLogger(__name__)

# Per-(ip, event_type) debounce: many of these call sites fire on every
# single rejected request (e.g. a bad Bearer token on ANY authenticated GET
# endpoint), most of which have no @limiter.limit of their own. Without this,
# the logging feature itself becomes a DB-write DoS vector — an attacker
# hammering an undecorated endpoint with a garbage token would otherwise
# generate one INSERT+COMMIT per request with zero throttling. Caps writes to
# at most one per window per (ip, event_type), independent of request volume.
_DEBOUNCE_SECONDS = 5.0
_last_logged: OrderedDict[tuple[str, str], float] = OrderedDict()
_MAX_TRACKED_KEYS = 10_000  # bound memory if hit from many distinct IPs


def _should_log(ip: str | None, event_type: str) -> bool:
    key = (ip or "unknown", event_type)
    now = time.monotonic()
    last = _last_logged.get(key)
    if last is not None and now - last < _DEBOUNCE_SECONDS:
        return False
    if len(_last_logged) >= _MAX_TRACKED_KEYS:
        # Evict only the single oldest entry, not everything — a full clear()
        # would reset debounce state for every currently-tracked IP at once,
        # causing a burst of renewed DB writes right when the map is full
        # (i.e. likely already under the heaviest traffic).
        _last_logged.popitem(last=False)
    _last_logged[key] = now
    return True


async def log_suspicious_activity(
    event_type: str,
    ip: str | None,
    user_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    if not _should_log(ip, event_type):
        return

    # Uses its own short-lived session rather than accepting one from the
    # caller — this is called from error/exception paths (failed logins,
    # invalid tokens, rate-limit handlers) where the caller's own db session
    # may already be in a bad or about-to-roll-back state.
    try:
        async with AsyncSessionLocal() as db:
            db.add(
                SecurityLog(
                    id=str(uuid.uuid4()),
                    event_type=event_type,
                    ip_address=ip,
                    user_id=user_id,
                    details=json.dumps(details, ensure_ascii=False) if details else None,
                    created_at=datetime.utcnow(),
                )
            )
            await db.commit()
    except Exception:
        logger.exception("Failed to write security log (event_type=%s)", event_type)
