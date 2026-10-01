import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.profile import StudentProfile
from app.models.user import User
from app.services.level_test_service import (
    EXPECTED_QUESTIONS,
    MAX_QUESTIONS,
    RUBRIC_KEYS,
    compute_final_level,
    is_finished,
    ladder_next,
    profile_bucket,
)
from main import app
from middleware.rate_limit import limiter


def _turn(level: str, score: float, attempted: bool = True) -> dict:
    return {"level": level, "scores": {k: score for k in RUBRIC_KEYS}, "attempted": attempted}


def _run_path(scores: list[float | None]) -> tuple[list[str], str]:
    """Drive the ladder the way /level-test/answer does; None = refusal."""
    turns: list[dict] = []
    for score in scores:
        level = ladder_next(turns)
        turns.append(_turn(level, score or 0, attempted=score is not None))
        if is_finished(turns):
            break
    return [t["level"] for t in turns], compute_final_level(turns)


class LevelRulesTests(unittest.TestCase):
    def test_ladder_goes_easy_to_hard_two_per_band(self):
        path, level = _run_path([9] * 20)
        self.assertEqual(path, ["A2", "A2", "B1", "B1", "B2", "B2", "C1", "C1"])
        self.assertEqual(len(path), EXPECTED_QUESTIONS)
        self.assertEqual(level, "C1")

    def test_beginner_stops_after_the_first_band(self):
        path, level = _run_path([3] * 20)
        self.assertEqual(path, ["A2", "A2"])
        self.assertEqual(level, "A1")

    def test_stops_after_the_band_that_goes_badly(self):
        path, level = _run_path([8, 8, 8, 7, 4, 3, 9, 9])
        self.assertEqual(path, ["A2", "A2", "B1", "B1", "B2", "B2"])
        self.assertEqual(level, "B1")

    def test_middling_band_keeps_climbing(self):
        # B2 average 6 isn't a clear failure — C1 still gets a chance.
        path, level = _run_path([8, 8, 8, 8, 7, 5, 4, 3])
        self.assertEqual(path[-2:], ["C1", "C1"])
        self.assertEqual(level, "B1+")

    def test_refusal_is_replaced_by_another_question_at_the_same_band(self):
        path, level = _run_path([9, 9, None, 9, 9, 9, 9, 9, 9])
        self.assertEqual(path[:5], ["A2", "A2", "B1", "B1", "B1"])
        self.assertEqual(level, "C1")

    def test_the_reported_c1_session(self):
        # A C1 speaker whose first answer lost a Kazakh word to the recogniser
        # and who refused one question — previously ended at 4 questions as A2.
        _, level = _run_path([6, 9, 9, None, 9, 9, 9, 9, 9])
        self.assertEqual(level, "C1")

    def test_never_more_than_max_questions(self):
        path, _ = _run_path([None] * 20)
        self.assertEqual(len(path), MAX_QUESTIONS)

    def test_profile_bucket(self):
        self.assertEqual(profile_bucket("A2+"), "weak")
        self.assertEqual(profile_bucket("B1"), "medium")
        self.assertEqual(profile_bucket("C1"), "good")


async def _fake_assess(question, level, answer, previous_questions=None, next_question_level=None,
                       next_about_usa=False):
    # Answer text encodes the score, e.g. "score 9"; "refuse" is a refusal.
    if answer == "refuse":
        return {"attempted": False, "answer_type": "refused", "scores": {k: 0 for k in RUBRIC_KEYS},
                "reaction": "Fair enough!", "corrections": [], "next_question": None}
    score = float(answer.split()[-1])
    return {"attempted": True, "answer_type": "answer", "scores": {k: score for k in RUBRIC_KEYS},
            "reaction": "Nice!", "corrections": [],
            "next_question": f"follow-up {next_question_level}{' USA' if next_about_usa else ''} after {answer}"}


async def _fake_summarize(turns, final_level):
    return {"summary_ru": "ok", "strengths": [], "improve": [], "visa_note_ru": "ok"}


@patch("routers.level_test.assess_answer", _fake_assess)
@patch("routers.level_test.summarize", _fake_summarize)
class LevelTestApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_jwt_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "test-level-test-secret"
        # /start allows 5/minute — more tests than that start a level test here.
        cls.original_limiter_enabled = limiter.enabled
        limiter.enabled = False
        cls.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(cls.temp_dir.name) / "test-level-test.db"
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

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        settings.JWT_SECRET = cls.original_jwt_secret
        limiter.enabled = cls.original_limiter_enabled
        cls.client.close()
        asyncio.run(cls.engine.dispose())
        cls.temp_dir.cleanup()

    async def _create_user(self, email: str, with_profile: bool) -> str:
        async with self.sessionmaker() as session:
            user = User(email=email, password_hash=hash_password("Password123!"), role="student")
            session.add(user)
            await session.flush()
            if with_profile:
                session.add(StudentProfile(
                    user_id=user.id, name="Test", university="KBTU", course_year=3, profession="IT",
                    english_level="weak", travel_history=True, financial_source="parents",
                    job_offer="yes", country="KZ", via_agency=False,
                    risk_profile=json.dumps({"risks": [{"type": "weak_english"}]}),
                ))
            await session.commit()
            return user.id

    def _headers(self, user_id: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(user_id)}"}

    def _take_test(self, user_id: str, scores: list) -> dict:
        start = self.client.post("/api/level-test/start", headers=self._headers(user_id))
        self.assertEqual(start.status_code, 201)
        test_id = start.json()["test_id"]
        for score in scores:
            res = self.client.post(
                "/api/level-test/answer",
                headers=self._headers(user_id),
                json={"test_id": test_id, "answer": "refuse" if score is None else f"score {score}",
                      "duration_seconds": 10},
            )
            self.assertEqual(res.status_code, 200)
            if res.json()["done"]:
                return {"test_id": test_id, **res.json()}
        self.fail("test never finished")

    def test_full_test_updates_profile_and_risks(self):
        user_id = asyncio.run(self._create_user("lt-full@example.com", with_profile=True))
        body = self._take_test(user_id, [9] * 10)

        self.assertEqual(body["result"]["level"], "C1")
        self.assertTrue(body["result"]["profile_updated"])

        async def load_profile():
            async with self.sessionmaker() as session:
                return await session.scalar(select(StudentProfile).where(StudentProfile.user_id == user_id))

        profile = asyncio.run(load_profile())
        self.assertEqual(profile.english_level, "good")
        risk_types = {r["type"] for r in json.loads(profile.risk_profile)["risks"]}
        self.assertNotIn("weak_english", risk_types)

    def test_refusal_is_not_scored_and_follow_up_is_used(self):
        user_id = asyncio.run(self._create_user("lt-refuse@example.com", with_profile=False))
        start = self.client.post("/api/level-test/start", headers=self._headers(user_id)).json()
        answer = lambda text: self.client.post(  # noqa: E731
            "/api/level-test/answer", headers=self._headers(user_id),
            json={"test_id": start["test_id"], "answer": text},
        ).json()
        first = answer("score 9")
        self.assertIn("follow-up A2", first["message"])
        second = answer("score 9")
        self.assertIn("follow-up B1", second["message"])
        refused = answer("refuse")
        self.assertFalse(refused["done"])
        self.assertTrue(refused["message"].startswith("Fair enough!"))
        body = None
        for _ in range(10):
            body = answer("score 9")
            if body["done"]:
                break
        self.assertEqual(body["result"]["level"], "C1")
        self.assertEqual(body["result"]["question_count"], 8)  # the refusal isn't counted

    def test_failed_assessment_records_nothing(self):
        user_id = asyncio.run(self._create_user("lt-fail@example.com", with_profile=False))
        start = self.client.post("/api/level-test/start", headers=self._headers(user_id)).json()

        async def failing_assess(*args, **kwargs):
            return None

        with patch("routers.level_test.assess_answer", failing_assess):
            res = self.client.post(
                "/api/level-test/answer", headers=self._headers(user_id),
                json={"test_id": start["test_id"], "answer": "score 9"},
            )
        self.assertEqual(res.status_code, 503)
        # The same question is still pending and the next answer counts as the first.
        res = self.client.post(
            "/api/level-test/answer", headers=self._headers(user_id),
            json={"test_id": start["test_id"], "answer": "score 9"},
        )
        self.assertEqual(res.json()["question_number"], 2)

    def test_only_questions_4_and_6_are_about_the_usa(self):
        user_id = asyncio.run(self._create_user("lt-usa@example.com", with_profile=False))
        start = self.client.post("/api/level-test/start", headers=self._headers(user_id)).json()
        usa_numbers = []
        for _ in range(10):
            body = self.client.post(
                "/api/level-test/answer", headers=self._headers(user_id),
                json={"test_id": start["test_id"], "answer": "score 9"},
            ).json()
            if body["done"]:
                break
            if " USA " in body["message"]:
                usa_numbers.append(body["question_number"])
        self.assertEqual(usa_numbers, [4, 6])

    def test_works_without_profile(self):
        user_id = asyncio.run(self._create_user("lt-noprofile@example.com", with_profile=False))
        body = self._take_test(user_id, [3] * 8)
        self.assertEqual(body["result"]["level"], "A1")
        self.assertFalse(body["result"]["profile_updated"])

    def test_completed_test_rejects_more_answers(self):
        user_id = asyncio.run(self._create_user("lt-done@example.com", with_profile=False))
        body = self._take_test(user_id, [3] * 8)
        res = self.client.post(
            "/api/level-test/answer",
            headers=self._headers(user_id),
            json={"test_id": body["test_id"], "answer": "score 9"},
        )
        self.assertEqual(res.status_code, 409)

    def test_cannot_answer_someone_elses_test(self):
        owner = asyncio.run(self._create_user("lt-owner@example.com", with_profile=False))
        other = asyncio.run(self._create_user("lt-other@example.com", with_profile=False))
        test_id = self.client.post("/api/level-test/start", headers=self._headers(owner)).json()["test_id"]
        res = self.client.post(
            "/api/level-test/answer",
            headers=self._headers(other),
            json={"test_id": test_id, "answer": "score 9"},
        )
        self.assertEqual(res.status_code, 404)

    def test_latest_returns_last_result(self):
        user_id = asyncio.run(self._create_user("lt-latest@example.com", with_profile=False))
        self._take_test(user_id, [9] * 10)
        res = self.client.get("/api/level-test/latest", headers=self._headers(user_id))
        self.assertEqual(res.json()["result"]["level"], "C1")


if __name__ == "__main__":
    unittest.main()
