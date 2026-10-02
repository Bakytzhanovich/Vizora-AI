import asyncio
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.user import User
from main import app
from middleware.rate_limit import limiter


class AgencyInputValidationTests(unittest.TestCase):
    """Agency signup and student-adding input rules."""

    @classmethod
    def setUpClass(cls):
        cls.original_jwt_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-agency-validation-secret"
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(cls.temp_dir.name) / "test-agency-validation.db"
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
        cls.sessionmaker = async_sessionmaker(cls.engine, expire_on_commit=False)

        async def init_db() -> None:
            async with cls.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        asyncio.run(init_db())

        async def override_get_db():
            async with cls.sessionmaker() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        # main.py only accepts known hosts; TestClient's default "testserver" is rejected.
        cls.client = TestClient(app, base_url="http://localhost")
        res = cls.client.post("/api/agency/register", json={
            "name": "Validation Agency", "email": "owner@agency.kz", "password": "Passw0rd!x", "country": "KZ",
        })
        cls.headers = {"Authorization": f"Bearer {res.json()['agency_token']}"}

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_jwt_secret
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    def _count_users(self, email_lower: str) -> int:
        async def count():
            async with self.sessionmaker() as s:
                return await s.scalar(select(func.count()).select_from(User).where(func.lower(User.email) == email_lower))
        return asyncio.run(count())

    def test_register_rejects_short_password(self):
        res = self.client.post("/api/agency/register", json={
            "name": "Weak", "email": "weak@agency.kz", "password": "1", "country": "KZ",
        })
        self.assertEqual(res.status_code, 422)

    def test_add_student_rejects_invalid_email(self):
        res = self.client.post("/api/agency/students/add", headers=self.headers,
                               json={"email": "not-an-email", "name": "X"})
        self.assertEqual(res.status_code, 422)

    def test_email_case_does_not_create_a_second_account(self):
        async def create_student():
            async with self.sessionmaker() as s:
                s.add(User(email="aibek@gmail.com", password_hash=hash_password("Password123!")))
                await s.commit()
        asyncio.run(create_student())

        res = self.client.post("/api/agency/students/add", headers=self.headers,
                               json={"email": "  Aibek@Gmail.com ", "name": "Aibek"})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self._count_users("aibek@gmail.com"), 1)
        # Same person again, different case — already linked.
        res = self.client.post("/api/agency/students/add", headers=self.headers,
                               json={"email": "AIBEK@gmail.com", "name": "Aibek"})
        self.assertEqual(res.status_code, 409)

    def test_bulk_add_normalizes_email(self):
        res = self.client.post("/api/agency/students/bulk-add", headers=self.headers, json={"students": [
            {"email": "Bulk.One@Example.com", "name": "One"},
            {"email": "bulk.one@example.com", "name": "One again"},
        ]})
        statuses = [r["status"] for r in res.json()["results"]]
        self.assertEqual(statuses, ["added", "already_linked"])
        self.assertEqual(self._count_users("bulk.one@example.com"), 1)

    def test_invite_link_uses_frontend_url(self):
        res = self.client.post("/api/agency/students/add", headers=self.headers,
                               json={"email": "new.student@example.com", "name": "New"})
        self.assertEqual(
            res.json()["invite_link"],
            f"{settings.FRONTEND_URL}/login?email=new.student%40example.com",
        )

    def test_manager_join_rejects_short_password(self):
        invite = self.client.post("/api/agency/team/invite", headers=self.headers,
                                  json={"email": "mgr@agency.kz", "name": "Mgr"}).json()
        token = invite["invite_link"].split("token=")[-1]
        res = self.client.post("/api/agency/team/join", json={"token": token, "password": "123", "name": "Mgr"})
        self.assertEqual(res.status_code, 422)


if __name__ == "__main__":
    unittest.main()
