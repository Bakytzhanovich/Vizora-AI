import unittest
from datetime import datetime

from app.services.pdf_report_service import generate_session_pdf

_TEXT = "Ответ слишком общий — консул не услышал связи с Казахстаном. J‑1 “Work & Travel”. " * 5


class PdfReportTests(unittest.TestCase):
    def test_real_feedback_renders(self):
        # Both failures seen on fpdf2's core font: Cyrillic/"—" crashed it, and a
        # second multi_cell in a row ran out of horizontal space.
        feedback = {
            "verdict": {"score": 72, "label": "Почти готов", "color": "yellow"},
            "scores": {"confidence": 7, "language": 6.5, "content": 8, "overall": 7.2},
            "answer_analysis": [{
                "question": "Why do you want to go?", "student_answer": _TEXT, "verdict": "warning",
                "what_was_wrong": _TEXT, "officer_heard": _TEXT, "better_answer": "I study at [university].",
            }] * 6,
            "key_mistakes": [{"mistake": "Длинно", "severity": "warning", "explanation": _TEXT, "correct_action": "Короче"}],
            "strong_points": ["Уверенно"],
            "phrases_to_memorize": [{"situation": "о возврате", "correct": "I will come back."}],
            "next_session_focus": ["Связи с домом"],
            "recommendation": _TEXT,
        }
        pdf = generate_session_pdf("consul", "hard", datetime(2026, 10, 18), 540, feedback)
        self.assertTrue(pdf.startswith(b"%PDF"))

    def test_empty_feedback_renders(self):
        self.assertTrue(generate_session_pdf("trainer", "easy", datetime(2026, 10, 18), 0, {}).startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
