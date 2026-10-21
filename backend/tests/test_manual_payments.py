import asyncio
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.agency_auth import create_member_token
from app.core.security import create_access_token, hash_password
from app.models.agency import Agency, AgencyMember
from app.models.referral import Referral
from app.models.user import User
from main import app
from middleware.rate_limit import limiter


class ManualPaymentTests(unittest.TestCase):
    """Students leave a Kaspi phone, the owner approves the paid invoice with one click."""

    @classmethod
    def setUpClass(cls):
        cls.original = (settings.JWT_SECRET, settings.PAYMENT_MODE, settings.KASPI_SERVICE_URL)
        settings.JWT_SECRET = "test-manual-payments-secret"
        settings.PAYMENT_MODE = "manual"
        settings.KASPI_SERVICE_URL = ""
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{Path(cls.temp_dir.name) / 'manual-payments.db'}")
        cls.sessionmaker = async_sessionmaker(cls.engine, expire_on_commit=False)

        async def init_db() -> None:
            async with cls.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        asyncio.run(init_db())

        async def override_get_db():
            async with cls.sessionmaker() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app, base_url="http://localhost")
        cls.ids = asyncio.run(cls._seed())

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET, settings.PAYMENT_MODE, settings.KASPI_SERVICE_URL = cls.original
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    @classmethod
    async def _seed(cls) -> dict:
        async with cls.sessionmaker() as s:
            users = {
                name: User(email=f"{name}@x.com", password_hash=hash_password("Password-123"), role=role)
                for name, role in (("student", "student"), ("renewer", "student"), ("canceller", "student"), ("owner", "admin"))
            }
            users["renewer"].subscription_plan = "standard"
            users["renewer"].subscription_period_end = datetime.utcnow() + timedelta(days=10)
            s.add_all(users.values())
            agency = Agency(name="A", email="agency@x.com", password_hash="x", country="KZ")
            s.add(agency)
            await s.flush()
            member = AgencyMember(agency_id=agency.id, role="admin", name="A", email="agency@x.com", status="active")
            s.add(member)
            await s.commit()
            return {**{name: u.id for name, u in users.items()}, "agency": agency.id, "agency_member": member.id}

    def _headers(self, who: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(self.ids[who])}"}

    def _request(self, who: str, **body) -> dict:
        res = self.client.post("/api/payments/manual-requests", headers=self._headers(who),
                               json={"plan": "standard", "billing_period": "monthly", "phone": "+7 701 123-45-67", **body})
        self.assertEqual(res.status_code, 201, res.text)
        return res.json()

    def _me(self, who: str) -> dict:
        return self.client.get("/api/payments/status", headers=self._headers(who)).json()

    def test_plans_tell_the_frontend_to_use_manual_checkout(self):
        self.assertEqual(self.client.get("/api/payments/plans").json()["payment_mode"], "manual")

    def test_automatic_and_mock_checkout_are_closed_in_manual_mode(self):
        create = self.client.post("/api/payments/create-payment", headers=self._headers("student"),
                                  json={"plan": "premium", "billing_period": "monthly"})
        self.assertEqual(create.status_code, 409)
        mock = self.client.post("/api/payments/mock-complete/anything", headers=self._headers("student"))
        self.assertEqual(mock.status_code, 404)

    def test_agency_cannot_pay_itself_in_manual_mode(self):
        headers = {"Authorization": f"Bearer {create_member_token(self.ids['agency'], self.ids['agency_member'], 'admin')}"}
        create = self.client.post("/api/agency/billing/create-payment", headers=headers,
                                  json={"plan": "agency_partner", "billing_period": "monthly"})
        self.assertEqual(create.status_code, 409)
        mock = self.client.post("/api/agency/billing/mock-complete/anything", headers=headers)
        self.assertEqual(mock.status_code, 404)

    def test_unsigned_webhook_is_rejected_without_kaspi_service(self):
        res = self.client.post("/api/payments/webhook", json={"paymentId": "manual:x", "event": "payment.success"})
        self.assertEqual(res.status_code, 401)

    def test_admins_get_one_push_per_new_request(self):
        sent = []

        async def record(title, body, url):
            sent.append((title, body, url))

        with patch("routers.payments.notify_admins", record):
            self._request("canceller")
            self._request("canceller", plan="premium")  # edits the open request
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][2], "/admin/payments")
        self.assertIn("+77011234567", sent[0][1])

    def test_phone_is_normalized_and_validated(self):
        self.assertEqual(self._request("student", phone="8 (777) 000 11 22")["phone"], "77770001122")
        bad = self.client.post("/api/payments/manual-requests", headers=self._headers("student"),
                               json={"plan": "standard", "phone": "12345"})
        self.assertEqual(bad.status_code, 422)

    def test_one_open_request_per_student_and_one_click_approval(self):
        first = self._request("student")
        second = self._request("student", plan="premium", billing_period="yearly")
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(second["amount"], 57_960)
        current = self.client.get("/api/payments/manual-requests/current", headers=self._headers("student")).json()
        self.assertEqual(current["request"]["id"], first["id"])

        # Students can't approve their own request.
        self_approve = self.client.post(f"/api/admin/payment-requests/{first['id']}/approve", headers=self._headers("student"))
        self.assertEqual(self_approve.status_code, 403)

        pending = self.client.get("/api/admin/payment-requests", headers=self._headers("owner")).json()["requests"]
        self.assertIn(first["id"], [r["id"] for r in pending])

        approved = self.client.post(f"/api/admin/payment-requests/{first['id']}/approve", headers=self._headers("owner"))
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(approved.json()["activation"]["status"], "activated")
        me = self._me("student")
        self.assertEqual(me["plan"], "premium")
        self.assertEqual(me["billing_period"], "yearly")

        again = self.client.post(f"/api/admin/payment-requests/{first['id']}/approve", headers=self._headers("owner"))
        self.assertEqual(again.status_code, 409)
        current = self.client.get("/api/payments/manual-requests/current", headers=self._headers("student")).json()
        self.assertIsNone(current["request"])

    def test_renewal_keeps_unused_paid_days(self):
        req = self._request("renewer")
        self.client.post(f"/api/admin/payment-requests/{req['id']}/approve", headers=self._headers("owner"))
        period_end = datetime.fromisoformat(self._me("renewer")["period_end"])
        self.assertGreater(period_end, datetime.utcnow() + timedelta(days=40))

    def test_cancelled_request_gives_no_access(self):
        req = self._request("canceller")
        cancelled = self.client.post(f"/api/admin/payment-requests/{req['id']}/cancel", headers=self._headers("owner"))
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(self._me("canceller")["plan"], "free")
        approve = self.client.post(f"/api/admin/payment-requests/{req['id']}/approve", headers=self._headers("owner"))
        self.assertEqual(approve.status_code, 409)


    def test_referral_counts_when_the_friend_pays_and_the_discount_is_used_once(self):
        async def seed() -> dict:
            async with self.sessionmaker() as s:
                people = {n: User(email=f"{n}@ref.com", password_hash="x") for n in ("inviter", "friend", "f1", "f2")}
                s.add_all(people.values())
                await s.flush()
                # Two friends paid earlier; the third one's payment unlocks the 30% tier.
                for n in ("f1", "f2"):
                    s.add(Referral(referrer_id=people["inviter"].id, referred_id=people[n].id,
                                   referral_code="INV1", status="completed"))
                s.add(Referral(referrer_id=people["inviter"].id, referred_id=people["friend"].id,
                               referral_code="INV1", status="pending"))
                await s.commit()
                return {n: u.id for n, u in people.items()}

        self.ids.update(asyncio.run(seed()))
        self.assertEqual(self._request("inviter")["amount"], 3_900)

        friend_req = self._request("friend")
        self.client.post(f"/api/admin/payment-requests/{friend_req['id']}/approve", headers=self._headers("owner"))

        discounted = self._request("inviter")
        self.assertEqual(discounted["amount"], 2_730)
        self.client.post(f"/api/admin/payment-requests/{discounted['id']}/approve", headers=self._headers("owner"))
        self.assertEqual(self._request("inviter")["amount"], 3_900)

if __name__ == "__main__":
    unittest.main()
