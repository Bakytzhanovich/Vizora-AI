import asyncio
import hashlib
import hmac
import json
import tempfile
import time
import unittest
import urllib.parse
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User
from main import app
from middleware.rate_limit import limiter

BOT_TOKEN = "123:test-bot-token"


def telegram_init_data(tg_id: int, auth_date: int) -> str:
    params = {"auth_date": str(auth_date), "user": json.dumps({"id": tg_id, "first_name": "A"})}
    check = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret = hmac.new(BOT_TOKEN.encode(), b"WebAppData", hashlib.sha256).digest()
    params["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(params)


class AuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = (settings.JWT_SECRET, settings.FRONTEND_URL, settings.GOOGLE_CLIENT_ID, settings.TELEGRAM_BOT_TOKEN)
        settings.JWT_SECRET = "test-auth-secret"
        settings.FRONTEND_URL = "http://localhost:3000"  # refresh cookie without Secure, so TestClient sends it
        settings.GOOGLE_CLIENT_ID = "google-client"
        settings.TELEGRAM_BOT_TOKEN = BOT_TOKEN
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{Path(cls.temp_dir.name) / 'auth.db'}")
        cls.sessionmaker = async_sessionmaker(cls.engine, expire_on_commit=False)

        async def init_db() -> None:
            async with cls.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        asyncio.run(init_db())

        async def override_get_db():
            async with cls.sessionmaker() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET, settings.FRONTEND_URL, settings.GOOGLE_CLIENT_ID, settings.TELEGRAM_BOT_TOKEN = cls.original
        limiter.enabled = cls.original_limiter_enabled
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    def _client(self) -> TestClient:
        client = TestClient(app, base_url="http://localhost")
        self.addCleanup(client.close)
        return client

    def _add_user(self, email: str, **fields) -> str:
        async def add() -> str:
            async with self.sessionmaker() as s:
                user = User(email=email, password_hash=hash_password("Password-123"), **fields)
                s.add(user)
                await s.commit()
                return user.id

        return asyncio.run(add())

    def _get_user(self, user_id: str) -> User:
        async def get() -> User:
            async with self.sessionmaker() as s:
                return await s.get(User, user_id)

        return asyncio.run(get())

    def _login(self, client: TestClient, email: str, password: str) -> int:
        return client.post("/api/auth/login", json={"email": email, "password": password}).status_code

    def test_google_sign_in_takes_the_account_from_whoever_set_its_password(self):
        # Someone registered the victim's address first (emails aren't verified).
        self._add_user("victim@x.com", password_set_by_agency="agency-1")
        client = self._client()
        google = {"email": "victim@x.com", "email_verified": True, "sub": "google-1"}
        with patch("routers.auth.google_id_token.verify_oauth2_token", return_value=google):
            res = client.post("/api/auth/google", json={"id_token": "token"})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(self._login(client, "victim@x.com", "Password-123"), 401)
        self.assertIsNone(self._get_user(res.json()["user_id"]).password_set_by_agency)

    def test_signing_in_on_a_second_device_keeps_the_first_signed_in(self):
        self._add_user("two-devices@x.com")
        laptop, phone = self._client(), self._client()
        self.assertEqual(self._login(laptop, "two-devices@x.com", "Password-123"), 200)
        self.assertEqual(self._login(phone, "two-devices@x.com", "Password-123"), 200)
        self.assertEqual(laptop.post("/api/auth/refresh").status_code, 200)
        self.assertEqual(phone.post("/api/auth/refresh").status_code, 200)
        # A rotated-out token stops working.
        stale = laptop.cookies.get("refresh_token")
        self.assertEqual(laptop.post("/api/auth/refresh").status_code, 200)
        old = self._client()
        old.cookies.set("refresh_token", stale, path="/api/auth")
        self.assertEqual(old.post("/api/auth/refresh").status_code, 401)

    def test_own_password_ends_the_agency_hold_on_the_account(self):
        user_id = self._add_user("agency-made@x.com", password_set_by_agency="agency-1")
        client = self._client()
        headers = {"Authorization": f"Bearer {create_access_token(user_id)}"}
        wrong = client.post("/api/auth/change-password", headers=headers,
                            json={"current_password": "nope-nope", "new_password": "Mine-12345"})
        self.assertEqual(wrong.status_code, 400)
        ok = client.post("/api/auth/change-password", headers=headers,
                         json={"current_password": "Password-123", "new_password": "Mine-12345"})
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertIsNone(self._get_user(user_id).password_set_by_agency)
        self.assertEqual(self._login(client, "agency-made@x.com", "Password-123"), 401)
        self.assertEqual(self._login(client, "agency-made@x.com", "Mine-12345"), 200)

    def test_old_telegram_sign_in_data_is_refused(self):
        client = self._client()
        old = telegram_init_data(555, int(time.time()) - 2 * 24 * 60 * 60)
        self.assertEqual(client.post("/api/auth/telegram", json={"init_data": old, "telegram_id": 555}).status_code, 401)
        fresh = telegram_init_data(555, int(time.time()))
        res = client.post("/api/auth/telegram", json={"init_data": fresh, "telegram_id": 555})
        self.assertEqual(res.status_code, 200, res.text)
        # Its random password is unknown to the student: setting one needs no current password.
        headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
        set_pw = client.post("/api/auth/change-password", headers=headers, json={"new_password": "Mine-12345"})
        self.assertEqual(set_pw.status_code, 200, set_pw.text)


if __name__ == "__main__":
    unittest.main()
