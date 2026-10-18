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
from app.models.user import User
from main import app
from middleware.rate_limit import limiter

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
FORM = {
    "employer": "Ocean Resort", "position": "Housekeeper", "state": "NJ", "city": "Wildwood",
    "start_date": "2027-06-01", "end_date": "2027-09-15", "hourly_wage": "15.5", "hours_per_week": "40",
    "sponsor": "CIEE", "price_kzt": "250000", "contact": "@seller_kz", "phone": "8 701 123 45 67",
}


class JobOfferBoardTests(unittest.TestCase):
    """Sellers list offers, the owner publishes paid ones, reports hide fakes."""

    @classmethod
    def setUpClass(cls):
        cls.original_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-job-offers-secret"
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.engine = create_async_engine(f"sqlite+aiosqlite:///{Path(cls.temp_dir.name) / 'offers.db'}")
        cls.sessionmaker = async_sessionmaker(cls.engine, expire_on_commit=False)

        async def init_db() -> dict:
            async with cls.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            async with cls.sessionmaker() as s:
                users = {n: User(email=f"{n}@x.com", role="admin" if n == "owner" else "student")
                         for n in ("seller", "b1", "b2", "b3", "owner")}
                s.add_all(users.values())
                await s.commit()
                return {n: u.id for n, u in users.items()}

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

    def _create(self, proof: bytes = PNG):
        with patch("routers.offers.notify_admins", new=AsyncMock()) as notify:
            res = self.client.post("/api/offers", data=FORM, files={"proof": ("offer.png", proof)}, headers=self._h("seller"))
        return res, notify

    def _public_ids(self) -> list[str]:
        return [o["id"] for o in self.client.get("/api/offers", headers=self._h("b1")).json()["offers"]]

    def test_proof_must_be_a_real_document(self):
        res, _ = self._create(b"<html><script>alert(1)</script>")
        self.assertEqual(res.status_code, 415)

    def test_lifecycle_publish_then_hidden_by_reports(self):
        res, notify = self._create()
        self.assertEqual(res.status_code, 201, res.text)
        self.assertEqual(res.json()["phone"], "77011234567")
        notify.assert_awaited_once()
        offer_id = res.json()["id"]

        self.assertNotIn(offer_id, self._public_ids())  # unpaid listings stay private

        proof = self.client.get(f"/api/admin/offers/{offer_id}/proof", headers=self._h("owner"))
        self.assertEqual((proof.status_code, proof.headers["content-type"]), (200, "image/png"))
        self.assertEqual(self.client.get(f"/api/admin/offers/{offer_id}/proof", headers=self._h("b1")).status_code, 403)

        self.assertEqual(self.client.post(f"/api/admin/offers/{offer_id}/publish", headers=self._h("owner")).status_code, 200)
        listed = self.client.get("/api/offers", headers=self._h("b1")).json()["offers"]
        self.assertEqual([o["contact"] for o in listed if o["id"] == offer_id], ["@seller_kz"])

        self.assertEqual(self.client.post(f"/api/offers/{offer_id}/report", headers=self._h("seller")).status_code, 400)
        with patch("routers.offers.notify_admins", new=AsyncMock()):
            for who in ("b1", "b1", "b2", "b3"):  # a repeat report from b1 must not count twice
                self.assertEqual(self.client.post(f"/api/offers/{offer_id}/report", headers=self._h(who)).status_code, 200)
                if who == "b2":
                    self.assertIn(offer_id, self._public_ids())
        self.assertNotIn(offer_id, self._public_ids())

        mine = self.client.get("/api/offers/mine", headers=self._h("seller")).json()["offers"]
        self.assertEqual([o["status"] for o in mine if o["id"] == offer_id], ["hidden"])
        self.assertEqual(self.client.post(f"/api/offers/{offer_id}/sold", headers=self._h("seller")).status_code, 200)


if __name__ == "__main__":
    unittest.main()
