from pathlib import Path

from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./vizora.db"
    AUTO_CREATE_TABLES: bool = True
    # Runs `alembic upgrade head` on every startup — needed on platforms without
    # shell/job access (e.g. Render free tier) where migrations can't be run manually.
    RUN_MIGRATIONS_ON_STARTUP: bool = True
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://vizora.ai",
        "https://vizora-ai-theta.vercel.app",
    ]

    JWT_SECRET: str  # Required — set via .env (no default so startup fails if missing)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour; refresh flow handles longer sessions
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    OPENAI_API_KEY: str = ""

    # Multi-provider AI support.
    # Set AI_PROVIDER to "openai", "gemini", or "groq".
    # Groq and Gemini use the OpenAI SDK protocol — no extra packages required.
    AI_PROVIDER: str = "openai"
    AI_MODEL: str = ""        # Override the default model for the chosen provider (optional)
    GEMINI_API_KEY: str = ""  # Required when AI_PROVIDER=gemini
    GROQ_API_KEY: str = ""    # Required when AI_PROVIDER=groq

    TELEGRAM_BOT_TOKEN: str = ""
    NOTIFICATION_SECRET: str = ""  # Shared secret for internal notification endpoint
    ADMIN_SECRET: str = ""         # Secret for /admin/* endpoints (set before deploying)

    GOOGLE_CLIENT_ID: str = ""  # OAuth client ID used to verify Google id_tokens

    # Web Push (browser notifications for users without a Telegram account).
    # Public key is also exposed to the frontend as NEXT_PUBLIC_VAPID_PUBLIC_KEY — same value.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIM_EMAIL: str = "admin@vizora.ai"

    # Optional production bootstrap for platforms without a shell.
    # If BOOTSTRAP_ADMIN_EMAIL is set, startup promotes that user to users.role=admin.
    # If the user does not exist, BOOTSTRAP_ADMIN_PASSWORD is required to create it.
    BOOTSTRAP_ADMIN_EMAIL: str = ""
    BOOTSTRAP_ADMIN_PASSWORD: str = ""
    BOOTSTRAP_ADMIN_RESET_PASSWORD: bool = False

    FRONTEND_URL: str = "http://localhost:3000"  # Set to the real domain in production .env

    # Kaspi Pay (subscriptions), via kaspi-service (../kaspi-service — a clone
    # of tapter-dev/kaspi-pos-automation) — automates the merchant's own
    # Kaspi Pay for Business app session; no official Kaspi API exists. Mode
    # is derived solely from whether KASPI_SERVICE_URL is set (no separate
    # on/off flag) so the flow is testable without a running kaspi-service.
    #
    # kaspi-service is stateless after login — the caller (us) must hold the
    # session and send it as headers on every request. KASPI_TOKEN_SN/
    # KASPI_VTOKEN_SECRET/KASPI_PROFILE_ID come from the one-time SMS login
    # (see kaspi-service/README.md's "Быстрый старт" + docs/API.md) — paste
    # the /api/auth/verify-otp response's tokenSN/vtokenSecret/profileId here
    # verbatim. KASPI_VTOKEN_SECRET stays AES-256-GCM-encrypted (by
    # kaspi-service's own TOKEN_SECRET_KEY) — we never decrypt it ourselves,
    # just pass it through.
    KASPI_SERVICE_URL: str = ""
    KASPI_TOKEN_SN: str = ""
    KASPI_VTOKEN_SECRET: str = ""
    KASPI_PROFILE_ID: str = ""
    # Sent as X-Internal-Key on every kaspi-service call — must match its own
    # KASPI_SERVICE_KEY. kaspi-service ships with no auth of its own (see
    # kaspi-service/src/internalAuth.js), so this is the only thing stopping
    # it from being an anonymous open proxy for Kaspi's signing protocol
    # once deployed on a public URL.
    KASPI_SERVICE_KEY: str = ""
    # Must match a webhooks.json entry's "secret" in kaspi-service — verifies
    # the payment.success/failed/expired/lost POSTs it sends back here.
    KASPI_WEBHOOK_SECRET: str = ""

    @property
    def database_url_async(self) -> str:
        """Return a SQLAlchemy async URL, including Railway-style Postgres URLs."""
        if self.DATABASE_URL.startswith("postgres://"):
            return self.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
        if self.DATABASE_URL.startswith("postgresql://"):
            return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.DATABASE_URL

    class Config:
        env_file = BACKEND_DIR / ".env"
        extra = "ignore"


settings = Settings()
