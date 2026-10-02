import asyncio
import unittest
from unittest.mock import patch

from app.services.simulator_service import (
    CONSUL_CLOSE_SECONDS,
    CONSUL_MAX_ANSWERS,
    compute_verdict,
    consul_must_decide,
    wants_to_decide,
)
from app.services.visa_decision import CLOSING_KEY_PHRASES, CLOSING_LINE, REQUIREMENTS, decide, make_decision


def _checklist(flags: dict | None = None, **statuses: str) -> dict:
    requirements = {k: {"status": "yes", "quote": f"q {k}", "note_ru": f"n {k}"} for k in REQUIREMENTS}
    for key, status in statuses.items():
        requirements[key]["status"] = status
    red_flags = {k: {"present": True, "quote": "I want to stay", "note_ru": "n"} for k in (flags or {})}
    return {"requirements": requirements, "red_flags": red_flags}


class DecideTests(unittest.TestCase):
    def test_everything_shown_is_approved(self):
        result = decide(_checklist())
        self.assertEqual(result["decision"], "approved")
        self.assertEqual(len(result["reasons"]), len(REQUIREMENTS))

    def test_a_red_flag_is_a_refusal_even_with_good_answers(self):
        result = decide(_checklist(flags={"immigrant_intent": True}))
        self.assertEqual(result["decision"], "refused")
        self.assertEqual([r["key"] for r in result["reasons"]], ["immigrant_intent"])
        self.assertEqual(result["reasons"][0]["quote"], "I want to stay")

    def test_unconvincing_ties_are_a_214b_refusal(self):
        for key in ("student_ties", "return_plan", "purpose", "communication"):
            with self.subTest(key=key):
                result = decide(_checklist(**{key: "weak"}))
                self.assertEqual(result["decision"], "refused")
                self.assertEqual(result["reasons"][0]["key"], key)

    def test_doubts_documents_can_settle_go_to_221g(self):
        result = decide(_checklist(program_knowledge="weak", finances="no"))
        self.assertEqual(result["decision"], "processing")
        self.assertEqual({r["key"] for r in result["reasons"]}, {"program_knowledge", "finances"})

    def test_ties_outrank_document_doubts(self):
        self.assertEqual(decide(_checklist(return_plan="no", finances="no"))["decision"], "refused")

    def test_topics_that_never_came_up_dont_count_against_the_student(self):
        result = decide(_checklist(finances="not_discussed", return_plan="not_discussed"))
        self.assertEqual(result["decision"], "approved")

    def test_unknown_status_counts_as_not_discussed(self):
        self.assertEqual(decide(_checklist(purpose="maybe"))["decision"], "approved")

    def test_failed_model_call_goes_to_administrative_processing(self):
        async def failing(*args, **kwargs):
            return None

        with patch("app.services.visa_decision.assess_interview", failing):
            result = asyncio.run(make_decision([], "profile"))
        self.assertEqual(result, {"decision": "processing", "reasons": []})


class ConsulFlowTests(unittest.TestCase):
    def test_closing_line_contains_its_key_phrase(self):
        # The frontend recognises the end of the interview by this phrase.
        self.assertIn(CLOSING_KEY_PHRASES["approved"], CLOSING_LINE.lower())

    def test_decision_is_forced_by_time_or_length(self):
        self.assertFalse(consul_must_decide(60, 3))
        self.assertTrue(consul_must_decide(CONSUL_CLOSE_SECONDS, 3))
        self.assertTrue(consul_must_decide(60, CONSUL_MAX_ANSWERS))

    def test_decide_marker_is_recognised_loosely(self):
        self.assertTrue(wants_to_decide("[DECIDE]"))
        self.assertTrue(wants_to_decide("I see. [ decide ]"))
        self.assertFalse(wants_to_decide("Why did you decide to apply?"))

    def test_verdict_never_contradicts_the_decision(self):
        self.assertEqual(compute_verdict(9.5, "refused")["label"], "Почти готов")
        self.assertEqual(compute_verdict(2.0, "approved")["label"], "Почти готов")
        self.assertEqual(compute_verdict(9.5)["label"], "Готов")


if __name__ == "__main__":
    unittest.main()
