import asyncio
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.agency_auth import create_member_token
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.agency import Agency, AgencyMember
from app.models.user import User
from main import app
from middleware.rate_limit import limiter


class AgencyStudentPasswordTests(unittest.TestCase):
    """Agencies get a password for accounts they create, and only for those."""

    @classmethod
    def setUpClass(cls):
        cls.original_jwt_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-agency-student-password-secret"
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(cls.temp_dir.name) / "test-agency-student-password.db"
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
        cls.ids = asyncio.run(cls._seed())

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_jwt_secret
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    @classmethod
    async def _seed(cls) -> dict:
        async with cls.sessionmaker() as s:
            existing = User(email="own@x.com", password_hash=hash_password("Students-own-1"))
            s.add(existing)
            agency_a = Agency(name="A", email="a@x.com", password_hash="x", country="KZ")
            agency_b = Agency(name="B", email="b@x.com", password_hash="x", country="KZ")
            s.add_all([agency_a, agency_b])
            await s.flush()
            owner_a = AgencyMember(agency_id=agency_a.id, role="admin", name="A", email="a@x.com", status="active")
            owner_b = AgencyMember(agency_id=agency_b.id, role="admin", name="B", email="b@x.com", status="active")
            s.add_all([owner_a, owner_b])
            await s.commit()
            return {"agency_a": agency_a.id, "agency_b": agency_b.id, "owner_a": owner_a.id, "owner_b": owner_b.id}

    def _headers(self, agency: str) -> dict:
        token = create_member_token(self.ids[f"agency_{agency}"], self.ids[f"owner_{agency}"], "admin")
        return {"Authorization": f"Bearer {token}"}

    def _login(self, email: str, password: str) -> int:
        return self.client.post("/api/auth/login", json={"email": email, "password": password}).status_code

    def test_new_student_gets_a_password_that_works(self):
        res = self.client.post("/api/agency/students/add", headers=self._headers("a"),
                               json={"email": "new@x.com", "name": "New"})
        self.assertEqual(res.status_code, 201)
        password = res.json()["password"]
        self.assertEqual(len(password), 10)
        self.assertEqual(self._login("new@x.com", password), 200)

    def test_existing_account_gets_no_password_and_cant_be_reset(self):
        res = self.client.post("/api/agency/students/add", headers=self._headers("a"),
                               json={"email": "own@x.com", "name": "Own"})
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.json()["password"])
        student_id = res.json()["student_id"]

        detail = self.client.get(f"/api/agency/students/{student_id}", headers=self._headers("a")).json()
        self.assertFalse(detail["can_issue_password"])
        reset = self.client.post(f"/api/agency/students/{student_id}/password", headers=self._headers("a"))
        self.assertEqual(reset.status_code, 403)
        self.assertEqual(self._login("own@x.com", "Students-own-1"), 200)

    def test_new_password_replaces_the_old_one(self):
        res = self.client.post("/api/agency/students/add", headers=self._headers("a"),
                               json={"email": "lost@x.com", "name": "Lost"}).json()
        detail = self.client.get(f"/api/agency/students/{res['student_id']}", headers=self._headers("a")).json()
        self.assertTrue(detail["can_issue_password"])

        new = self.client.post(f"/api/agency/students/{res['student_id']}/password", headers=self._headers("a"))
        self.assertEqual(new.status_code, 200)
        self.assertEqual(self._login("lost@x.com", new.json()["password"]), 200)
        self.assertEqual(self._login("lost@x.com", res["password"]), 401)

    def test_another_agency_cant_reset_a_student_it_later_linked(self):
        created = self.client.post("/api/agency/students/add", headers=self._headers("a"),
                                   json={"email": "shared@x.com", "name": "Shared"}).json()
        linked = self.client.post("/api/agency/students/add", headers=self._headers("b"),
                                  json={"email": "shared@x.com", "name": "Shared"})
        self.assertIsNone(linked.json()["password"])
        reset = self.client.post(f"/api/agency/students/{created['student_id']}/password", headers=self._headers("b"))
        self.assertEqual(reset.status_code, 403)
        self.assertEqual(self._login("shared@x.com", created["password"]), 200)

    def test_unlinked_student_is_not_found(self):
        created = self.client.post("/api/agency/students/add", headers=self._headers("a"),
                                   json={"email": "mine@x.com", "name": "Mine"}).json()
        reset = self.client.post(f"/api/agency/students/{created['student_id']}/password", headers=self._headers("b"))
        self.assertEqual(reset.status_code, 404)

    def test_bulk_add_returns_passwords_for_new_accounts(self):
        # Agency B: agency A links own@x.com in another test.
        res = self.client.post("/api/agency/students/bulk-add", headers=self._headers("b"), json={"students": [
            {"email": "bulk1@x.com", "name": "B1"}, {"email": "own@x.com", "name": "Own"},
        ]}).json()
        by_email = {r["email"]: r for r in res["results"]}
        self.assertEqual(self._login("bulk1@x.com", by_email["bulk1@x.com"]["password"]), 200)
        self.assertIsNone(by_email["own@x.com"]["password"])


if __name__ == "__main__":
    unittest.main()
