"""Create or update a Vizora user in the configured database.

Examples:
    python scripts/upsert_user.py --email nurs@gmail.com --role admin
    ADMIN_PASSWORD='...' python scripts/upsert_user.py --email nurs@gmail.com --role admin
"""

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.profile import StudentProfile  # noqa: F401, E402
from app.models.user import User  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update a user.")
    parser.add_argument("--email", required=True, help="User email")
    parser.add_argument(
        "--role",
        default="student",
        choices=("student", "admin"),
        help="User role in the main users table",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="Password for a new user or password reset for an existing user",
    )
    return parser.parse_args()


async def upsert_user(email: str, role: str, password: str | None) -> None:
    normalized_email = email.strip().lower()

    async with AsyncSessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == normalized_email))

        if user:
            user.role = role
            if password:
                user.password_hash = hash_password(password)
            await db.commit()
            print(f"Updated user {normalized_email}: role={role}")
            return

        if not password:
            password = getpass.getpass(f"Password for new user {normalized_email}: ")
        if len(password) < 8:
            raise SystemExit("Password must contain at least 8 characters.")

        user = User(
            email=normalized_email,
            password_hash=hash_password(password),
            role=role,
        )
        db.add(user)
        await db.commit()
        print(f"Created user {normalized_email}: role={role}")


def main() -> None:
    args = parse_args()
    asyncio.run(upsert_user(args.email, args.role, args.password))


if __name__ == "__main__":
    main()
