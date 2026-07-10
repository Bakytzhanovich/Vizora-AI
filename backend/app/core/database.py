from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for col_sql in [
            "ALTER TABLE simulator_sessions ADD COLUMN question_count INTEGER DEFAULT 0",
            "ALTER TABLE agencies ADD COLUMN white_label_logo_url TEXT",
            "ALTER TABLE agencies ADD COLUMN white_label_primary_color VARCHAR(20)",
            "ALTER TABLE agencies ADD COLUMN white_label_enabled BOOLEAN DEFAULT 0",
            "ALTER TABLE users ADD COLUMN telegram_id VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN telegram_username VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN refresh_token_hash VARCHAR(255)",
        ]:
            try:
                await conn.execute(text(col_sql))
            except Exception:
                pass  # Column already exists
        try:
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_telegram_id "
                "ON users (telegram_id) WHERE telegram_id IS NOT NULL"
            ))
        except Exception:
            pass
