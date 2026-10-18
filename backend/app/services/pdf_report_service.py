"""Premium-only PDF report generated after a simulator session.

Uses the bundled DejaVu Sans (app/assets/fonts, free license in LICENSE there):
fpdf2's core fonts are Latin-1 only and crashed on the Russian feedback text
and on the "—"/non-breaking hyphen the model writes into English answers.
"""

from datetime import datetime
from pathlib import Path
from typing import Any

from fpdf import FPDF
from fpdf.enums import XPos, YPos

_FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"
_VERDICT_LABELS = {"good": "Хорошо", "warning": "Можно лучше", "critical": "Опасно"}
_MODE_LABELS = {"trainer": "Тренер", "consul": "Консул"}


class _Report(FPDF):
    def heading(self, text: str) -> None:
        self.ln(3)
        self.set_font("DejaVu", "B", 13)
        self.line_text(text, 8)
        self.set_font("DejaVu", "", 10)

    def line_text(self, text: str, height: float = 5) -> None:
        # Without new_x=LMARGIN fpdf2 leaves the cursor at the right margin after
        # a multi_cell, and the next one fails with "Not enough horizontal space".
        self.multi_cell(0, height, text, align="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def generate_session_pdf(
    session_mode: str,
    difficulty: str,
    created_at: datetime,
    duration_seconds: int,
    feedback: dict[str, Any],
) -> bytes:
    pdf = _Report(format="A4")
    pdf.add_font("DejaVu", "", str(_FONTS / "DejaVuSans.ttf"))
    pdf.add_font("DejaVu", "B", str(_FONTS / "DejaVuSans-Bold.ttf"))
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("DejaVu", "B", 18)
    pdf.line_text("Vizora AI — отчёт о собеседовании", 10)
    pdf.set_font("DejaVu", "", 10)
    pdf.line_text(
        f"{created_at.strftime('%d.%m.%Y')}  ·  режим: {_MODE_LABELS.get(session_mode, session_mode)}"
        f"  ·  сложность: {difficulty}  ·  {duration_seconds // 60} мин"
    )

    verdict = feedback.get("verdict") or {}
    if verdict.get("label"):
        pdf.heading(f"Итог: {verdict['label']} ({verdict.get('score', '-')}/100)")

    scores = feedback.get("scores", {})
    pdf.heading("Оценки")
    for label, key in (("Уверенность", "confidence"), ("Язык", "language"),
                       ("Содержание", "content"), ("Общая", "overall")):
        pdf.line_text(f"{label}: {scores.get(key, '-')}/10")

    if feedback.get("recommendation"):
        pdf.heading("Рекомендация")
        pdf.line_text(feedback["recommendation"])

    strong = [s for s in feedback.get("strong_points", []) if s]
    if strong:
        pdf.heading("Что получилось")
        for s in strong:
            pdf.line_text(f"• {s}")

    mistakes = feedback.get("key_mistakes", [])
    if mistakes:
        pdf.heading("Главные ошибки")
        for m in mistakes:
            pdf.set_font("DejaVu", "B", 10)
            pdf.line_text(f"• {m.get('mistake', '')}")
            pdf.set_font("DejaVu", "", 10)
            if m.get("explanation"):
                pdf.line_text(f"   Почему важно: {m['explanation']}")
            if m.get("correct_action"):
                pdf.line_text(f"   Как правильно: {m['correct_action']}")

    answers = feedback.get("answer_analysis", [])
    if answers:
        pdf.heading("Разбор ответов")
        for i, item in enumerate(answers, 1):
            pdf.set_font("DejaVu", "B", 10)
            label = _VERDICT_LABELS.get(item.get("verdict", ""), "")
            pdf.line_text(f"{i}. {item.get('question', '')}" + (f"  [{label}]" if label else ""))
            pdf.set_font("DejaVu", "", 10)
            pdf.line_text(f"   Твой ответ: {item.get('student_answer', '')}")
            for title, key in (("Хорошо", "what_was_good"), ("Ошибка", "what_was_wrong"),
                               ("Как услышал консул", "officer_heard"), ("Сильный ответ", "better_answer")):
                if item.get(key):
                    pdf.line_text(f"   {title}: {item[key]}")
            pdf.ln(2)

    phrases = [p for p in feedback.get("phrases_to_memorize", []) if p.get("correct")]
    if phrases:
        pdf.heading("Фразы, которые стоит выучить")
        for p in phrases:
            pdf.line_text(f"• {p['correct']}" + (f"  ({p['situation']})" if p.get("situation") else ""))

    focus = [f for f in feedback.get("next_session_focus", []) if f]
    if focus:
        pdf.heading("На чём сосредоточиться дальше")
        for f in focus:
            pdf.line_text(f"• {f}")

    return bytes(pdf.output())
