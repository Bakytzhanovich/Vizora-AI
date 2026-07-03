from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./vizora.db"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "https://vizora.ai"]

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

    FRONTEND_URL: str = "http://localhost:3000"  # Set to the real domain in production .env

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
