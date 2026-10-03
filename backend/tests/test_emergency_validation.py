import asyncio
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.emergency import EmergencySession
from app.models.user import User
from main import app
from middleware.rate_limit import limiter


class EmergencyValidationTests(unittest.TestCase):
    """/emergency/respond pads the answers list up to step_index — it must
    never accept an index past the scenario's own steps."""

    @classmethod
    def setUpClass(cls):
        cls.original_jwt_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-emergency-validation-secret"
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{Path(cls.temp_dir.name) / 'test.db'}")
        cls.sessionmaker = async_sessionmaker(cls.engine, expire_on_commit=False)

        async def init_db() -> tuple[str, str]:
            async with cls.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            async with cls.sessionmaker() as s:
                user = User(email="em@x.com", password_hash=hash_password("Password-1"))
                s.add(user)
                await s.flush()
                session = EmergencySession(user_id=user.id, scenario_id="fired", answers="[]", status="active")
                s.add(session)
                await s.commit()
                return user.id, session.id

        user_id, cls.session_id = asyncio.run(init_db())

        async def override_get_db():
            async with cls.sessionmaker() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app, base_url="http://localhost")
        cls.headers = {"Authorization": f"Bearer {create_access_token(user_id)}"}

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_jwt_secret
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    def _respond(self, step_index: int):
        return self.client.post("/api/emergency/respond", headers=self.headers, json={
            "session_id": self.session_id, "answer": "x", "step_index": step_index,
        })

    def test_huge_step_index_is_rejected(self):
        self.assertEqual(self._respond(1_000_000_000).status_code, 422)

    def test_negative_step_index_is_rejected(self):
        self.assertEqual(self._respond(-1).status_code, 422)

    def test_index_past_the_scenario_is_rejected(self):
        self.assertEqual(self._respond(50).status_code, 400)


if __name__ == "__main__":
    unittest.main()
