import asyncio
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from main import app
from middleware.rate_limit import limiter

ONBOARDING = {
    "name": "Тест", "university": "KBTU", "course_year": 3, "profession": "IT",
    "interview_date": "2026-12-15", "english_level": "medium", "travel_history": False,
    "financial_source": "parents", "job_offer": "yes", "country": "KZ", "via_agency": False,
}


class StudentOnboardingDocumentsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_jwt_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-student-docs-secret"
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{Path(cls.temp_dir.name) / 'db.sqlite'}")
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
        cls.n = 0

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_jwt_secret
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    def _student(self) -> tuple[str, dict]:
        type(self).n += 1
        email = f"student{self.n}@example.com"
        res = self.client.post("/api/auth/register", json={"email": email, "password": "Passw0rd!s"})
        return email, {"Authorization": f"Bearer {res.json()['access_token']}"}

    def test_onboarding_rejects_values_outside_the_options(self):
        for field, value in [
            ("english_level", "xyz"), ("financial_source", "bank"), ("job_offer", "maybe"),
            ("country", "US"), ("course_year", 0), ("course_year", 99), ("name", "   "), ("name", "x" * 101),
        ]:
            with self.subTest(field=field, value=value):
                _, headers = self._student()
                res = self.client.post("/api/profile/onboarding", headers=headers, json={**ONBOARDING, field: value})
                self.assertEqual(res.status_code, 422)

    def test_onboarding_accepts_every_option_the_ui_offers(self):
        _, headers = self._student()
        res = self.client.post("/api/profile/onboarding", headers=headers, json={
            **ONBOARDING, "english_level": "weak", "financial_source": "scholarship",
            "job_offer": "in_progress", "country": "other", "course_year": 6,
        })
        self.assertEqual(res.status_code, 201)

    def test_unknown_document_id_is_rejected(self):
        _, headers = self._student()
        self.client.post("/api/profile/onboarding", headers=headers, json=ONBOARDING)
        res = self.client.post("/api/documents/checklist/update", headers=headers,
                               json={"document_id": "nope", "completed": True})
        self.assertEqual(res.status_code, 400)

    def test_referral_link_uses_frontend_url(self):
        # The link came from a non-existent "APP_URL" setting and was always localhost.
        _, headers = self._student()
        self.client.post("/api/profile/onboarding", headers=headers, json=ONBOARDING)
        body = self.client.get("/api/referral/my-code", headers=headers).json()
        link = next(v for v in body.values() if isinstance(v, str) and "register?ref=" in v)
        self.assertTrue(link.startswith(f"{settings.FRONTEND_URL}/register?ref="))

    def test_agency_sees_the_same_document_progress_as_the_student(self):
        email, headers = self._student()
        self.client.post("/api/profile/onboarding", headers=headers, json=ONBOARDING)
        checklist = self.client.get("/api/documents/checklist", headers=headers).json()["checklist"]
        required = [d["id"] for d in checklist if d["required"]]
        self.assertGreater(len(required), 9)  # the old "/ 9" formula showed 100% too early
        for doc_id in required[:9]:
            self.client.post("/api/documents/checklist/update", headers=headers,
                             json={"document_id": doc_id, "completed": True})
        student_pct = self.client.get("/api/documents/checklist", headers=headers).json()["progress"]
        self.assertLess(student_pct, 100)

        agency = self.client.post("/api/agency/register", json={
            "name": "Docs Agency", "email": f"agency-{email}", "password": "Passw0rd!x", "country": "KZ",
        }).json()
        agency_headers = {"Authorization": f"Bearer {agency['agency_token']}"}
        self.client.post("/api/agency/students/add", headers=agency_headers, json={"email": email, "name": "Тест"})
        listed = self.client.get("/api/agency/students", headers=agency_headers).json()["students"][0]
        detail = self.client.get(f"/api/agency/students/{listed['id']}", headers=agency_headers).json()
        self.assertEqual(listed["documents_pct"], student_pct)
        self.assertEqual(detail["documents_pct"], student_pct)
        self.assertNotIn("documents", detail["roadmap_completed"])


if __name__ == "__main__":
    unittest.main()
