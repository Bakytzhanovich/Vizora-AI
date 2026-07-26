import logging
import os
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# No handler is configured anywhere else, so without this every logger.info() in
# the app (bootstrap admin, migrations, ...) is silently dropped by the default
# root level (WARNING).
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from app.api.early_access import router as early_access_router
from app.core.config import settings, BACKEND_DIR
from app.core.database import AsyncSessionLocal, create_tables
from app.core.security import hash_password
# Import models so SQLAlchemy registers them before create_all
import app.models.user  # noqa: F401
import app.models.profile  # noqa: F401
import app.models.early_access  # noqa: F401
import app.models.chat  # noqa: F401
import app.models.simulator  # noqa: F401
import app.models.documents  # noqa: F401
import app.models.roadmap  # noqa: F401
import app.models.agency  # noqa: F401
import app.models.emergency  # noqa: F401
import app.models.after_visa  # noqa: F401
import app.models.referral  # noqa: F401
import app.models.analytics  # noqa: F401
import app.models.knowledge_base  # noqa: F401
from app.models.user import User
from routers.auth import router as auth_router
from routers.profile import router as profile_router
from routers.chat import router as chat_router
from routers.simulator import router as simulator_router
from routers.documents import router as documents_router
from routers.roadmap import router as roadmap_router
from routers.agency import router as agency_router
from routers.agency_team import router as agency_team_router
from routers.emergency import router as emergency_router
from routers.after_visa import router as after_visa_router
from routers.referral import router as referral_router
from routers.analytics import router as analytics_router
from routers.internal import router as internal_router
from routers.admin import router as admin_router

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


def run_migrations() -> None:
    """Apply pending Alembic migrations. Runs on every startup so platforms
    without shell/job access (e.g. Render free tier) still get schema changes.
    """
    if not settings.RUN_MIGRATIONS_ON_STARTUP:
        return

    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error("Alembic migration failed:\n%s", result.stdout + result.stderr)
        raise RuntimeError("Database migration failed")
    logger.info("Alembic migrations applied (or already up to date)")


async def bootstrap_admin_user() -> None:
    email = settings.BOOTSTRAP_ADMIN_EMAIL.strip().lower()
    if not email:
        return

    password = settings.BOOTSTRAP_ADMIN_PASSWORD
    async with AsyncSessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))

        if user:
            changed = False
            if user.role != "admin":
                user.role = "admin"
                changed = True
            if settings.BOOTSTRAP_ADMIN_RESET_PASSWORD:
                if not password:
                    raise RuntimeError("BOOTSTRAP_ADMIN_RESET_PASSWORD requires BOOTSTRAP_ADMIN_PASSWORD")
                if len(password) < 8:
                    raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must contain at least 8 characters")
                user.password_hash = hash_password(password)
                changed = True
            if changed:
                await db.commit()
                logger.info("Bootstrap admin updated: %s", email)
            return

        if not password:
            raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD is required to create bootstrap admin")
        if len(password) < 8:
            raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must contain at least 8 characters")

        db.add(User(email=email, password_hash=hash_password(password), role="admin"))
        await db.commit()
        logger.info("Bootstrap admin created: %s", email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    if settings.AUTO_CREATE_TABLES:
        await create_tables()
    await bootstrap_admin_user()
    # Seed the knowledge base with 20 hand-verified entries if empty
    from app.services.rag_service import seed_knowledge_base
    await seed_knowledge_base()
    # Start monthly KB scraping scheduler
    from scraper.scheduler import start_kb_scheduler, stop_kb_scheduler
    start_kb_scheduler()
    yield
    stop_kb_scheduler()


app = FastAPI(
    title="Vizora AI API",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class CatchAllExceptionMiddleware:
    """Raw ASGI middleware that catches unhandled exceptions inside CORSMiddleware
    and returns a JSON 500 with proper CORS headers.

    BaseHTTPMiddleware was deliberately avoided: its call_next() buffers the
    entire response body before forwarding, which breaks StreamingResponse
    endpoints such as /api/chat/message.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        try:
            await self.app(scope, receive, send)
        except Exception:
            logger.exception("Unhandled exception on %s %s", scope["method"], scope["path"])
            response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
            await response(scope, receive, send)


# Order matters: add_middleware prepends, so CORSMiddleware (added second)
# ends up wrapping CatchAllExceptionMiddleware (added first).
app.add_middleware(CatchAllExceptionMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(early_access_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(simulator_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(roadmap_router, prefix="/api")
app.include_router(agency_router, prefix="/api")
app.include_router(agency_team_router, prefix="/api")
app.include_router(emergency_router, prefix="/api")
app.include_router(after_visa_router, prefix="/api")
app.include_router(referral_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(internal_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(_static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Vizora AI API"}
