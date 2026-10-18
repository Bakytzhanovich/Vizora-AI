import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models.simulator import SimulatorSession
from app.models.user import User
from main import app
from middleware.rate_limit import limiter


class FeedbackTests(unittest.TestCase):
    """Students send messages and rate sessions; only the owner reads them."""

    @classmethod
    def setUpClass(cls):
        cls.original_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-feedback-secret"
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{Path(cls.temp_dir.name) / 'feedback.db'}")
        cls.sessionmaker = async_sessionmaker(cls.engine, expire_on_commit=False)

        async def init_db() -> dict:
            async with cls.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            async with cls.sessionmaker() as s:
                users = {n: User(email=f"{n}@x.com", role="admin" if n == "owner" else "student") for n in ("student", "other", "owner")}
                s.add_all(users.values())
                await s.flush()
                sim = SimulatorSession(user_id=users["student"].id, mode="trainer", completed=True)
                s.add(sim)
                await s.commit()
                return {**{n: u.id for n, u in users.items()}, "sim": sim.id}

        cls.ids = asyncio.run(init_db())

        async def override_get_db():
            async with cls.sessionmaker() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app, base_url="http://localhost")

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_secret
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    def _h(self, who: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(self.ids[who])}"}

    def test_messages_and_ratings_reach_the_owner(self):
        with patch("routers.feedback.notify_admins", new=AsyncMock()) as notify:
            res = self.client.post("/api/feedback", json={"kind": "bug", "message": "Микрофон не работает", "page": "/simulator"}, headers=self._h("student"))
            self.assertEqual(res.status_code, 201, res.text)
            self.assertEqual(notify.await_count, 1)

            url = f"/api/feedback/session/{self.ids['sim']}"
            self.assertEqual(self.client.put(url, json={"rating": 5}, headers=self._h("student")).status_code, 200)
            self.assertEqual(notify.await_count, 1)  # a plain 5 doesn't ping the owner
            self.assertEqual(self.client.put(url, json={"rating": 2, "message": "Слишком быстро"}, headers=self._h("student")).status_code, 200)
            self.assertEqual(notify.await_count, 2)
            self.assertEqual(self.client.put(url, json={"rating": 4}, headers=self._h("other")).status_code, 404)
            self.assertEqual(self.client.put(url, json={"rating": 6}, headers=self._h("student")).status_code, 422)

        self.assertEqual(self.client.get("/api/admin/feedback", headers=self._h("student")).status_code, 403)
        data = self.client.get("/api/admin/feedback", headers=self._h("owner")).json()
        self.assertEqual(data["stats"]["by_kind"], {"idea": 0, "bug": 1, "question": 0, "session": 1})
        self.assertEqual(data["stats"]["avg_rating"], 2)  # re-rating replaced the 5
        sessions = self.client.get("/api/admin/feedback?kind=session", headers=self._h("owner")).json()["items"]
        self.assertEqual([(i["rating"], i["message"], i["email"]) for i in sessions], [(2, "Слишком быстро", "student@x.com")])


if __name__ == "__main__":
    unittest.main()
