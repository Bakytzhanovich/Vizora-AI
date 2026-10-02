import asyncio
import json
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.agency_auth import create_member_token
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.agency import Agency, AgencyMember, AgencyStudent
from app.models.level_test import LevelTest
from app.models.user import User
from main import app


class LevelReportingTests(unittest.TestCase):
    """Admin and agency views of students' English level test results."""

    @classmethod
    def setUpClass(cls):
        cls.original_jwt_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-level-reporting-secret"
        cls.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(cls.temp_dir.name) / "test-level-reporting.db"
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
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    @classmethod
    async def _seed(cls) -> dict:
        """Agency A: student "tested" (A2 then a newer B2+), student "untested".
        Agency B: student "other" (C1) — must never show up for agency A."""
        now = datetime.utcnow()
        async with cls.sessionmaker() as s:
            def user(email: str, role: str = "student") -> User:
                u = User(email=email, password_hash=hash_password("Password123!"), role=role)
                s.add(u)
                return u

            tested, untested, other = user("tested@x.com"), user("untested@x.com"), user("other@x.com")
            admin = user("owner@x.com", role="admin")
            agency_a = Agency(name="A", email="a@x.com", password_hash="x", country="KZ")
            agency_b = Agency(name="B", email="b@x.com", password_hash="x", country="KZ")
            s.add_all([agency_a, agency_b])
            await s.flush()

            owner = AgencyMember(agency_id=agency_a.id, role="admin", name="Owner", email="a@x.com", status="active")
            manager = AgencyMember(agency_id=agency_a.id, role="manager", name="Mgr", email="m@x.com", status="active")
            s.add_all([owner, manager])
            await s.flush()

            s.add_all([
                AgencyStudent(agency_id=agency_a.id, user_id=tested.id, assigned_manager_id=manager.id),
                AgencyStudent(agency_id=agency_a.id, user_id=untested.id),
                AgencyStudent(agency_id=agency_b.id, user_id=other.id),
            ])

            def test(user_id: str, level: str, days_ago: int) -> LevelTest:
                return LevelTest(
                    user_id=user_id, transcript="[]", current_question="", current_level="A2",
                    completed=True, final_level=level, completed_at=now - timedelta(days=days_ago),
                    result=json.dumps({"criteria": {"grammar": 8}, "summary_ru": f"итог {level}"}),
                )

            s.add_all([
                test(tested.id, "A2", days_ago=10),
                test(tested.id, "B2+", days_ago=1),
                test(other.id, "C1", days_ago=2),
                # An abandoned test never counts.
                LevelTest(user_id=untested.id, transcript="[]", current_question="", current_level="B1"),
            ])
            await s.commit()
            return {
                "tested": tested.id, "untested": untested.id, "other": other.id, "admin": admin.id,
                "agency_a": agency_a.id, "owner": owner.id, "manager": manager.id,
            }

    def _agency_headers(self, member: str, role: str) -> dict:
        token = create_member_token(self.ids["agency_a"], self.ids[member], role)
        return {"Authorization": f"Bearer {token}"}

    def test_agency_student_list_shows_latest_level(self):
        res = self.client.get("/api/agency/students", headers=self._agency_headers("owner", "admin"))
        self.assertEqual(res.status_code, 200)
        by_id = {s["id"]: s for s in res.json()["students"]}
        self.assertEqual(set(by_id), {self.ids["tested"], self.ids["untested"]})  # not agency B's student
        self.assertEqual(by_id[self.ids["tested"]]["english_test"]["level"], "B2+")
        self.assertIsNone(by_id[self.ids["untested"]]["english_test"])

    def test_agency_student_detail_includes_test(self):
        res = self.client.get(
            f"/api/agency/students/{self.ids['tested']}", headers=self._agency_headers("owner", "admin")
        )
        test = res.json()["english_test"]
        self.assertEqual(test["level"], "B2+")
        self.assertEqual(test["level_title"], "Upper-Intermediate")
        self.assertEqual(test["tests_taken"], 2)
        self.assertEqual(test["summary_ru"], "итог B2+")

    def test_agency_analytics_counts_only_own_students(self):
        res = self.client.get("/api/agency/analytics", headers=self._agency_headers("owner", "admin"))
        levels = res.json()["english_levels"]
        self.assertEqual(levels["tested"], 1)
        self.assertEqual(levels["distribution"], {"A1": 0, "A2": 0, "B1": 0, "B2": 1, "C1": 0, "C2": 0})

    def test_level_test_counts_as_activity(self):
        # A student whose only activity is a level test was flagged
        # "never logged in" and missing from the weekly activity chart.
        alerts = self.client.get("/api/agency/alerts", headers=self._agency_headers("owner", "admin")).json()
        tested_alerts = [a["message"] for a in alerts["alerts"] if a["student_id"] == self.ids["tested"]]
        self.assertNotIn("Ни разу не заходил в систему", tested_alerts)
        weekly = self.client.get("/api/agency/analytics", headers=self._agency_headers("owner", "admin")).json()
        # "tested" (yesterday's test) and "untested", who started a test today
        # and abandoned it — opening the test is activity too.
        self.assertEqual(sum(d["active_users"] for d in weekly["weekly_activity"]), 2)

    def test_manager_sees_only_assigned_students(self):
        res = self.client.get("/api/agency/analytics", headers=self._agency_headers("manager", "manager"))
        self.assertEqual(res.json()["english_levels"]["tested"], 1)
        res = self.client.get("/api/agency/students", headers=self._agency_headers("manager", "manager"))
        self.assertEqual([s["id"] for s in res.json()["students"]], [self.ids["tested"]])

    def test_admin_overview_counts_everyone(self):
        token = create_access_token(self.ids["admin"])
        res = self.client.get("/api/admin/overview", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["metrics"]["level_test_users"], 2)
        self.assertEqual(body["metrics"]["level_tests_completed"], 3)
        self.assertEqual(body["english_levels"], {"A1": 0, "A2": 0, "B1": 0, "B2": 1, "C1": 1, "C2": 0})


if __name__ == "__main__":
    unittest.main()
