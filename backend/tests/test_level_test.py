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
    CRITERIA,
    EXPECTED_QUESTIONS,
    MAX_QUESTIONS,
    assess_answer,
    assess_test,
    clamp_level,
    describe_speech,
    is_finished,
    ladder_next,
    latest_level_results,
    profile_bucket,
    speech_metrics,
    sustained_level,
)
from main import app
from middleware.rate_limit import limiter


def _turn(band: str, shown: str | None, spoken: bool = True) -> dict:
    """An answer to a `band` question that showed level `shown`; None = refusal."""
    return {
        "level": band, "question": f"q {band}", "answer": f"a {shown}", "attempted": shown is not None,
        "overall": shown, "levels": {k: shown for k in CRITERIA} if shown else {},
        "corrections": [], "spoken": spoken,
    }


def _run_path(shown: list[str | None]) -> tuple[list[str], list[dict]]:
    """Drive the ladder the way /level-test/answer does."""
    turns: list[dict] = []
    for level in shown:
        turns.append(_turn(ladder_next(turns), level))
        if is_finished(turns):
            break
    return [t["level"] for t in turns], turns


class LevelRulesTests(unittest.TestCase):
    def test_ladder_goes_easy_to_hard_two_per_band(self):
        path, turns = _run_path(["C1"] * 20)
        self.assertEqual(path, ["A2", "A2", "B1", "B1", "B2", "B2", "C1", "C1"])
        self.assertEqual(len(path), EXPECTED_QUESTIONS)
        self.assertEqual(sustained_level(turns), "C1")

    def test_beginner_stops_after_the_first_band(self):
        path, turns = _run_path(["A1"] * 20)
        self.assertEqual(path, ["A2", "A2"])
        self.assertEqual(sustained_level(turns), "A1")

    def test_stops_after_a_band_where_no_answer_reached_it(self):
        path, turns = _run_path(["A2", "B1", "B1", "B1", "B1", "B1", "C1", "C1"])
        self.assertEqual(path, ["A2", "A2", "B1", "B1", "B2", "B2"])
        self.assertEqual(sustained_level(turns), "B1")

    def test_one_answer_at_the_band_keeps_climbing(self):
        path, _ = _run_path(["A2", "A2", "B1", "A2", "B2", "B1", "B1", "B1"])
        self.assertEqual(path[-2:], ["C1", "C1"])

    def test_easy_opening_answers_dont_drag_a_strong_speaker_down(self):
        # Short answers to "where are you from?" show little; the level comes
        # from what the student sustained once the questions allowed it.
        _, turns = _run_path(["A2", "B1", "B1", "B2", "C1", "C1", "C1", "B2"])
        self.assertEqual(sustained_level(turns), "C1")

    def test_one_lucky_answer_is_not_the_level(self):
        _, turns = _run_path(["A2", "A2", "B1", "C1", "B1", "B1", "A2", "B1"])
        self.assertEqual(sustained_level(turns), "B1")

    def test_refusal_is_replaced_by_another_question_at_the_same_band(self):
        path, turns = _run_path(["C1", "C1", None, "C1", "C1", "C1", "C1", "C1", "C1"])
        self.assertEqual(path[:5], ["A2", "A2", "B1", "B1", "B1"])
        self.assertEqual(sustained_level(turns), "C1")

    def test_never_more_than_max_questions(self):
        path, _ = _run_path([None] * 20)
        self.assertEqual(len(path), MAX_QUESTIONS)

    def test_model_level_is_kept_within_one_step(self):
        self.assertEqual(clamp_level("C2", "B1"), "B2")
        self.assertEqual(clamp_level("A1", "B2"), "B1")
        self.assertEqual(clamp_level("B2", "B1"), "B2")
        self.assertEqual(clamp_level("nonsense", "B1"), "B1")

    def test_profile_bucket(self):
        self.assertEqual(profile_bucket("A2+"), "weak")
        self.assertEqual(profile_bucket("B1"), "medium")
        self.assertEqual(profile_bucket("C2"), "good")


def _words(spec: list[tuple[str, float, float]]) -> list[dict]:
    return [{"word": w, "start": a, "end": b} for w, a, b in spec]


class SpeechMetricsTests(unittest.TestCase):
    def test_counts_pauses_and_fillers_and_ignores_the_wait_before_speaking(self):
        metrics = speech_metrics(_words([
            ("I", 3.0, 3.2), ("um,", 3.3, 3.6), ("live", 5.0, 5.3), ("in", 5.4, 5.5),
            ("Almaty.", 5.6, 6.2), ("Uh", 7.8, 8.0), ("yes.", 8.1, 9.0),
        ]))
        self.assertEqual(metrics["words"], 5)  # fillers aren't words
        self.assertEqual(metrics["fillers"], 2)
        self.assertEqual(metrics["speaking_seconds"], 6.0)  # from 3.0, not from 0
        self.assertEqual(metrics["words_per_minute"], 50)
        self.assertEqual(metrics["long_pauses"], 2)  # 3.6→5.0 and 6.2→7.8
        self.assertEqual(metrics["longest_pause"], 1.6)

    def test_too_little_speech_has_no_metrics(self):
        self.assertIsNone(speech_metrics(_words([("Yes.", 0.5, 0.9)])))
        self.assertIsNone(speech_metrics([]))

    def test_typed_answer_tells_the_model_not_to_judge_fluency(self):
        self.assertIn("null for fluency", describe_speech("I live in Almaty", None, spoken=False))
        self.assertIn("words per minute", describe_speech("x", {
            "words": 10, "speaking_seconds": 5.0, "words_per_minute": 120, "long_pauses": 0,
            "longest_pause": 0.3, "fillers": 0,
        }, spoken=True))


class AssessTestTests(unittest.TestCase):
    def _assess(self, turns: list[dict], model_reply: dict | None) -> dict:
        async def fake_completion(prompt, max_tokens):
            return model_reply

        with patch("app.services.level_test_service._json_completion", fake_completion):
            return asyncio.run(assess_test(turns))

    def test_model_decides_within_one_step_of_the_sustained_level(self):
        _, turns = _run_path(["A2", "B1", "B1", "B1", "B1", "B1"])
        reply = {"level": "B2", "fluency": "C2", "accuracy": "B1", "vocabulary": "B2", "grammar": "A1",
                 "summary_ru": "s", "strengths": ["a"], "improve": ["b"], "visa_note_ru": "v"}
        result = self._assess(turns, reply)
        self.assertEqual(result["level"], "B2")
        self.assertEqual(result["level_title"], "Upper-Intermediate")
        self.assertEqual(result["criteria"], {"fluency": "B2", "accuracy": "B1", "vocabulary": "B2", "grammar": "A2"})
        self.assertEqual(result["summary_ru"], "s")

    def test_inflated_model_level_is_capped(self):
        _, turns = _run_path(["A1", "A1"])
        self.assertEqual(self._assess(turns, {"level": "C1"})["level"], "A2")

    def test_failed_model_call_falls_back_to_the_sustained_levels(self):
        _, turns = _run_path(["B2"] * 8)
        result = self._assess(turns, None)
        self.assertEqual(result["level"], "B2")
        self.assertEqual(set(result["criteria"].values()), {"B2"})

    def test_typed_answers_have_no_fluency(self):
        turns = [_turn("A2", "B1", spoken=False), _turn("A2", "B1", spoken=False)]
        self.assertIsNone(self._assess(turns, {"level": "B1", "fluency": "B1"})["criteria"]["fluency"])


class AssessAnswerRulesTests(unittest.TestCase):
    def _assess(self, reply: dict) -> dict | None:
        async def fake_completion(prompt, max_tokens):
            return {"answer_type": "answer", "structures": [], "errors": [], "reaction": "ok",
                    "next_question": "next?", **reply}

        with patch("app.services.level_test_service._json_completion", fake_completion):
            return asyncio.run(assess_answer("q", "A2", "a", "spoken"))

    def test_smooth_delivery_doesnt_lift_the_level_above_what_was_said(self):
        result = self._assess({"full_sentences": 4, "fluency": "B2", "accuracy": "B1", "vocabulary": "A2",
                               "grammar": "A2", "overall": "B1"})
        self.assertEqual(result["overall"], "A2")

    def test_no_sentence_at_all_is_a1(self):
        result = self._assess({"full_sentences": 0, "fluency": "A2", "accuracy": "A2", "vocabulary": "A2",
                               "grammar": "A2", "overall": "A2"})
        self.assertEqual(result["overall"], "A1")
        self.assertEqual(result["levels"]["grammar"], "A1")

    def test_no_level_means_the_answer_isnt_recorded(self):
        self.assertIsNone(self._assess({"overall": "fluent"}))


async def _fake_assess(question, level, answer, speech, previous_questions=None, next_question_level=None,
                       next_about_usa=False):
    # Answer text encodes the level shown, e.g. "level B2"; "refuse" is a refusal.
    if answer == "refuse":
        return {"attempted": False, "answer_type": "refused", "overall": None, "levels": {},
                "structures": [], "error_count": 0, "reaction": "Fair enough!", "corrections": [],
                "next_question": None}
    shown = answer.split()[-1]
    return {"attempted": True, "answer_type": "answer", "overall": shown, "levels": {k: shown for k in CRITERIA},
            "structures": [], "error_count": 0, "reaction": "Nice!", "corrections": [],
            "next_question": f"follow-up {next_question_level}{' USA' if next_about_usa else ''} after {answer}"}


async def _no_model(prompt, max_tokens):
    return None


@patch("routers.level_test.assess_answer", _fake_assess)
@patch("app.services.level_test_service._json_completion", _no_model)
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
                json={"test_id": test_id, "answer": "refuse" if score is None else f"level {score}",
                      "duration_seconds": 10},
            )
            self.assertEqual(res.status_code, 200)
            if res.json()["done"]:
                return {"test_id": test_id, **res.json()}
        self.fail("test never finished")

    def test_full_test_updates_profile_and_risks(self):
        user_id = asyncio.run(self._create_user("lt-full@example.com", with_profile=True))
        body = self._take_test(user_id, ["C1"] * 10)

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
        first = answer("level C1")
        self.assertIn("follow-up A2", first["message"])
        second = answer("level C1")
        self.assertIn("follow-up B1", second["message"])
        refused = answer("refuse")
        self.assertFalse(refused["done"])
        self.assertTrue(refused["message"].startswith("Fair enough!"))
        body = None
        for _ in range(10):
            body = answer("level C1")
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
                json={"test_id": start["test_id"], "answer": "level C1"},
            )
        self.assertEqual(res.status_code, 503)
        # The same question is still pending and the next answer counts as the first.
        res = self.client.post(
            "/api/level-test/answer", headers=self._headers(user_id),
            json={"test_id": start["test_id"], "answer": "level C1"},
        )
        self.assertEqual(res.json()["question_number"], 2)

    def test_only_questions_4_and_6_are_about_the_usa(self):
        user_id = asyncio.run(self._create_user("lt-usa@example.com", with_profile=False))
        start = self.client.post("/api/level-test/start", headers=self._headers(user_id)).json()
        usa_numbers = []
        for _ in range(10):
            body = self.client.post(
                "/api/level-test/answer", headers=self._headers(user_id),
                json={"test_id": start["test_id"], "answer": "level C1"},
            ).json()
            if body["done"]:
                break
            if " USA " in body["message"]:
                usa_numbers.append(body["question_number"])
        self.assertEqual(usa_numbers, [4, 6])

    def test_works_without_profile(self):
        user_id = asyncio.run(self._create_user("lt-noprofile@example.com", with_profile=False))
        body = self._take_test(user_id, ["A1"] * 8)
        self.assertEqual(body["result"]["level"], "A1")
        self.assertFalse(body["result"]["profile_updated"])

    def test_completed_test_rejects_more_answers(self):
        user_id = asyncio.run(self._create_user("lt-done@example.com", with_profile=False))
        body = self._take_test(user_id, ["A1"] * 8)
        res = self.client.post(
            "/api/level-test/answer",
            headers=self._headers(user_id),
            json={"test_id": body["test_id"], "answer": "level C1"},
        )
        self.assertEqual(res.status_code, 409)

    def test_cannot_answer_someone_elses_test(self):
        owner = asyncio.run(self._create_user("lt-owner@example.com", with_profile=False))
        other = asyncio.run(self._create_user("lt-other@example.com", with_profile=False))
        test_id = self.client.post("/api/level-test/start", headers=self._headers(owner)).json()["test_id"]
        res = self.client.post(
            "/api/level-test/answer",
            headers=self._headers(other),
            json={"test_id": test_id, "answer": "level C1"},
        )
        self.assertEqual(res.status_code, 404)

    def test_latest_returns_last_result(self):
        user_id = asyncio.run(self._create_user("lt-latest@example.com", with_profile=False))
        self._take_test(user_id, ["C1"] * 10)
        res = self.client.get("/api/level-test/latest", headers=self._headers(user_id))
        self.assertEqual(res.json()["result"]["level"], "C1")

    def _finish(self, user_id: str, test_id: str):
        return self.client.post(
            "/api/level-test/finish", headers=self._headers(user_id), json={"test_id": test_id},
        )

    def test_finish_early_shows_level_but_leaves_profile_and_reports_alone(self):
        user_id = asyncio.run(self._create_user("lt-early@example.com", with_profile=True))
        full = self._take_test(user_id, ["C1"] * 10)
        test_id = self.client.post("/api/level-test/start", headers=self._headers(user_id)).json()["test_id"]
        for _ in range(2):
            self.client.post(
                "/api/level-test/answer", headers=self._headers(user_id),
                json={"test_id": test_id, "answer": "level C1"},
            )

        res = self._finish(user_id, test_id)
        self.assertEqual(res.status_code, 200)
        result = res.json()["result"]
        self.assertEqual(result["level"], "C1")  # judged from the speech, not from how far the ladder got
        self.assertTrue(result["finished_early"])
        self.assertFalse(result["profile_updated"])
        self.assertEqual(result["question_count"], 2)

        async def load():
            async with self.sessionmaker() as session:
                profile = await session.scalar(select(StudentProfile).where(StudentProfile.user_id == user_id))
                return profile, await latest_level_results(session, [user_id])

        profile, reported = asyncio.run(load())
        self.assertEqual(profile.english_level, "good")  # still from the full C1 test
        self.assertEqual(reported[user_id]["level"], "C1")
        latest = self.client.get("/api/level-test/latest", headers=self._headers(user_id)).json()
        self.assertEqual(latest["result"]["level"], full["result"]["level"])

        self.assertEqual(self._finish(user_id, test_id).status_code, 409)
        answer = self.client.post(
            "/api/level-test/answer", headers=self._headers(user_id),
            json={"test_id": test_id, "answer": "level C1"},
        )
        self.assertEqual(answer.status_code, 409)

    def test_finish_without_answers_is_rejected(self):
        user_id = asyncio.run(self._create_user("lt-early-empty@example.com", with_profile=False))
        test_id = self.client.post("/api/level-test/start", headers=self._headers(user_id)).json()["test_id"]
        self.assertEqual(self._finish(user_id, test_id).status_code, 400)
        # Still open — the student can carry on.
        res = self.client.post(
            "/api/level-test/answer", headers=self._headers(user_id),
            json={"test_id": test_id, "answer": "level C1"},
        )
        self.assertEqual(res.status_code, 200)

    def test_cannot_finish_someone_elses_test(self):
        owner = asyncio.run(self._create_user("lt-early-owner@example.com", with_profile=False))
        other = asyncio.run(self._create_user("lt-early-other@example.com", with_profile=False))
        test_id = self.client.post("/api/level-test/start", headers=self._headers(owner)).json()["test_id"]
        self.assertEqual(self._finish(other, test_id).status_code, 404)


if __name__ == "__main__":
    unittest.main()
