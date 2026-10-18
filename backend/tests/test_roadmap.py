import asyncio
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models.roadmap import RoadmapProgress
from app.models.user import User
from app.services.roadmap_service import ROADMAP_STEPS, VISA_STEP_IDS, journey_progress, readiness_many
from main import app
from middleware.rate_limit import limiter

# Order of the category headings on /roadmap (frontend/app/(shell)/roadmap/page.tsx).
PAGE_CATEGORY_ORDER = ["preparation", "visa", "interview", "travel", "usa", "return"]


class RoadmapOrderTests(unittest.TestCase):
    def test_grouping_by_category_keeps_step_order(self):
        rendered = [s["number"] for c in PAGE_CATEGORY_ORDER for s in ROADMAP_STEPS if s["category"] == c]
        self.assertEqual(rendered, list(range(1, len(ROADMAP_STEPS) + 1)))

    def test_every_step_moves_progress(self):
        done: set[str] = set()
        last = 0
        for step in ROADMAP_STEPS:
            done.add(step["id"])
            now = journey_progress(done)
            self.assertGreater(now, last, step["id"])
            last = now
        self.assertEqual(last, 100)
        self.assertEqual(journey_progress(set(VISA_STEP_IDS), VISA_STEP_IDS), 100)


class RoadmapApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-roadmap-secret"
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{Path(cls.temp_dir.name) / 'roadmap.db'}")
        cls.sessionmaker = async_sessionmaker(cls.engine, expire_on_commit=False)

        async def init_db() -> str:
            async with cls.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            async with cls.sessionmaker() as s:
                user = User(email="road@x.com", role="student")
                s.add(user)
                await s.commit()
                return user.id

        cls.user_id = asyncio.run(init_db())

        async def override_get_db():
            async with cls.sessionmaker() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app, base_url="http://localhost")
        cls.headers = {"Authorization": f"Bearer {create_access_token(cls.user_id)}"}

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_secret
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    def _count_rows(self) -> int:
        async def q():
            async with self.sessionmaker() as s:
                return await s.scalar(select(func.count()).select_from(RoadmapProgress).where(RoadmapProgress.step_id == "documents"))
        return asyncio.run(q())

    def test_marking_steps_moves_progress_and_never_duplicates(self):
        before = self.client.get("/api/roadmap/roadmap", headers=self.headers).json()
        self.assertEqual((before["current_step"], before["progress"]), ("documents", journey_progress({"profile"})))

        for _ in range(2):
            res = self.client.post("/api/roadmap/roadmap/update", json={"step_id": "documents", "status": "completed"}, headers=self.headers)
            self.assertEqual(res.json()["next_step"], "ds160")
        self.assertEqual(self._count_rows(), 1)

        after = self.client.get("/api/roadmap/roadmap", headers=self.headers).json()
        docs = next(s for s in after["steps"] if s["id"] == "documents")
        self.assertTrue(docs["completed_at"].endswith("Z"))
        self.assertGreater(after["progress"], before["progress"])

        async def readiness():
            async with self.sessionmaker() as s:
                return (await readiness_many(s, [self.user_id]))[self.user_id]
        self.assertEqual(asyncio.run(readiness()), journey_progress({"profile", "documents"}, VISA_STEP_IDS))

    def test_database_rejects_a_second_row_for_the_same_step(self):
        async def insert_twice():
            async with self.sessionmaker() as s:
                s.add_all([RoadmapProgress(user_id=self.user_id, step_id="sevis", status="completed") for _ in range(2)])
                await s.commit()
        with self.assertRaises(IntegrityError):
            asyncio.run(insert_twice())


if __name__ == "__main__":
    unittest.main()
