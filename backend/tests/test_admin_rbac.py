import asyncio
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User
from main import app


class AdminRbacTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_jwt_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-admin-rbac-secret"

        cls.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(cls.temp_dir.name) / "test-admin-rbac.db"
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
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_jwt_secret
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    async def _create_user(self, email: str, role: str) -> User:
        async with self.sessionmaker() as session:
            user = User(email=email, password_hash=hash_password("Password123!"), role=role)
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user

    async def _insert_user(self, email: str, role: str) -> User:
        return await self._create_user(email, role)

    def test_admin_system_requires_jwt(self):
        response = self.client.get("/api/admin/system")
        self.assertEqual(response.status_code, 401)

    def test_admin_system_rejects_regular_user(self):
        user = asyncio.run(self._insert_user("student@example.com", "student"))
        token = create_access_token(user.id)

        response = self.client.get(
            "/api/admin/system",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Admin access required")

    def test_admin_system_allows_admin_user(self):
        admin = asyncio.run(self._insert_user("admin@example.com", "admin"))
        token = create_access_token(admin.id)

        response = self.client.get(
            "/api/admin/system",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("server_time", response.json())

    def test_forged_body_role_is_ignored(self):
        user = asyncio.run(self._insert_user("forged@example.com", "student"))
        token = create_access_token(user.id)

        response = self.client.post(
            "/api/admin/scraper/run-now",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "admin"},
        )
        self.assertEqual(response.status_code, 403)

    def test_x_admin_secret_does_not_authorize(self):
        response = self.client.get(
            "/api/admin/system",
            headers={"X-Admin-Secret": "legacy-secret"},
        )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
