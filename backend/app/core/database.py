from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url_async, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


LEGACY_COLUMNS = {
    "simulator_sessions": {
        "question_count": "INTEGER DEFAULT 0",
    },
    "agencies": {
        "white_label_logo_url": "TEXT",
        "white_label_primary_color": "VARCHAR(20)",
        "white_label_enabled": "BOOLEAN DEFAULT false",
    },
    "users": {
        "telegram_id": "VARCHAR(20)",
        "telegram_username": "VARCHAR(255)",
        "refresh_token_hash": "VARCHAR(255)",
    },
    "agency_students": {
        "assigned_manager_id": "VARCHAR(36)",
    },
    "agency_members": {
        "last_login": "TIMESTAMP",
    },
}


async def _has_column(conn, table_name: str, column_name: str) -> bool:
    def check(sync_conn):
        return any(
            column["name"] == column_name
            for column in inspect(sync_conn).get_columns(table_name)
        )

    return await conn.run_sync(check)


async def _has_table(conn, table_name: str) -> bool:
    def check(sync_conn):
        return table_name in inspect(sync_conn).get_table_names()

    return await conn.run_sync(check)


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    for table_name, columns in LEGACY_COLUMNS.items():
        for column_name, column_sql in columns.items():
            async with engine.begin() as conn:
                if not await _has_table(conn, table_name):
                    continue
                if not await _has_column(conn, table_name, column_name):
                    await conn.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}")
                    )

    async with engine.begin() as conn:
        if await _has_table(conn, "users"):
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_telegram_id "
                "ON users (telegram_id) WHERE telegram_id IS NOT NULL"
            ))
