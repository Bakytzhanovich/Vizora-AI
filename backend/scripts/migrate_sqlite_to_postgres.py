from __future__ import annotations

import argparse
import asyncio
import os
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, insert, text
from sqlalchemy.ext.asyncio import create_async_engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402

# Import models so Base.metadata contains every table.
import app.models.after_visa  # noqa: E402,F401
import app.models.agency  # noqa: E402,F401
import app.models.analytics  # noqa: E402,F401
import app.models.chat  # noqa: E402,F401
import app.models.documents  # noqa: E402,F401
import app.models.early_access  # noqa: E402,F401
import app.models.emergency  # noqa: E402,F401
import app.models.knowledge_base  # noqa: E402,F401
import app.models.profile  # noqa: E402,F401
import app.models.referral  # noqa: E402,F401
import app.models.roadmap  # noqa: E402,F401
import app.models.simulator  # noqa: E402,F401
import app.models.user  # noqa: E402,F401


def normalize_postgres_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def parse_datetime(value: Any) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
    raise ValueError(f"Cannot parse datetime value: {value!r}")


def parse_date(value: Any) -> date | None:
    if value is None or isinstance(value, date):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    return date.fromisoformat(raw)


def parse_bool(value: Any) -> bool | None:
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, int):
        return bool(value)
    raw = str(value).strip().lower()
    if raw in {"1", "true", "t", "yes", "y"}:
        return True
    if raw in {"0", "false", "f", "no", "n"}:
        return False
    return bool(value)


def convert_value(column, value: Any) -> Any:
    if isinstance(column.type, DateTime):
        return parse_datetime(value)
    if isinstance(column.type, Date):
        return parse_date(value)
    if isinstance(column.type, Boolean):
        return parse_bool(value)
    return value


def sqlite_table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    return {row["name"] for row in rows}


def sqlite_table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None


def load_rows(conn: sqlite3.Connection, table) -> list[dict[str, Any]]:
    if not sqlite_table_exists(conn, table.name):
        print(f"skip {table.name}: table not found in SQLite")
        return []

    sqlite_columns = sqlite_table_columns(conn, table.name)
    columns = [column for column in table.columns if column.name in sqlite_columns]
    if not columns:
        print(f"skip {table.name}: no matching columns")
        return []

    column_sql = ", ".join(f'"{column.name}"' for column in columns)
    rows = conn.execute(f'SELECT {column_sql} FROM "{table.name}"').fetchall()

    converted: list[dict[str, Any]] = []
    for row in rows:
        converted.append(
            {
                column.name: convert_value(column, row[column.name])
                for column in columns
            }
        )
    return converted


async def truncate_postgres(engine) -> None:
    table_names = [table.name for table in Base.metadata.sorted_tables]
    if not table_names:
        return
    quoted = ", ".join(f'"{table_name}"' for table_name in table_names)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))


async def copy_to_postgres(sqlite_path: Path, postgres_url: str, truncate: bool) -> None:
    if not sqlite_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {sqlite_path}")

    engine = create_async_engine(normalize_postgres_url(postgres_url), pool_pre_ping=True)

    try:
        if truncate:
            await truncate_postgres(engine)

        sqlite_conn = sqlite3.connect(sqlite_path)
        sqlite_conn.row_factory = sqlite3.Row

        try:
            async with engine.begin() as pg_conn:
                for table in Base.metadata.sorted_tables:
                    rows = load_rows(sqlite_conn, table)
                    if not rows:
                        print(f"{table.name}: 0 rows")
                        continue
                    await pg_conn.execute(insert(table), rows)
                    print(f"{table.name}: copied {len(rows)} rows")
        finally:
            sqlite_conn.close()
    finally:
        await engine.dispose()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy existing Vizora SQLite data into PostgreSQL."
    )
    parser.add_argument(
        "--sqlite-path",
        type=Path,
        default=BACKEND_DIR / "vizora.db",
        help="Path to the existing SQLite database.",
    )
    parser.add_argument(
        "--postgres-url",
        default=os.getenv("DATABASE_URL") or settings.DATABASE_URL,
        help="PostgreSQL SQLAlchemy URL. Defaults to DATABASE_URL.",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete existing PostgreSQL rows before copying.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    postgres_url = normalize_postgres_url(args.postgres_url)
    if not postgres_url.startswith("postgresql+asyncpg://"):
        raise SystemExit("Target URL must be PostgreSQL, e.g. postgresql+asyncpg://...")

    asyncio.run(copy_to_postgres(args.sqlite_path, postgres_url, args.truncate))


if __name__ == "__main__":
    main()
