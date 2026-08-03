"""Premium-only PDF report generated after a simulator session.

English-only by design: fpdf2's built-in core fonts (Helvetica etc.) are
Latin-1 and cannot render Cyrillic, and there's no freely-redistributable
Cyrillic TTF bundled in this repo to add as a custom font (the only
Cyrillic-capable font available on this dev machine is Apple's Arial
Unicode, which can't legally be redistributed as a project asset). The
feedback's questions/answers/phrases are already in English (that's the
whole point of interview practice), so the report sticks to those fields
and skips the Russian-language explanation text rather than crash on
unsupported characters or ship mojibake.
"""

from datetime import datetime
from typing import Any

from fpdf import FPDF

_VERDICT_LABELS = {"good": "GOOD", "warning": "NEEDS WORK", "critical": "CRITICAL"}


def generate_session_pdf(
    session_mode: str,
    difficulty: str,
    created_at: datetime,
    duration_seconds: int,
    feedback: dict[str, Any],
) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "Vizora AI - Interview Simulator Report", ln=True)

    pdf.set_font("Helvetica", "", 10)
    minutes = duration_seconds // 60
    pdf.cell(0, 6, f"Date: {created_at.strftime('%Y-%m-%d')}  |  Mode: {session_mode}  |  "
                   f"Difficulty: {difficulty}  |  Duration: {minutes} min", ln=True)
    pdf.ln(4)

    scores = feedback.get("scores", {})
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Scores", ln=True)
    pdf.set_font("Helvetica", "", 11)
    for label, key in (("Confidence", "confidence"), ("Language", "language"),
                        ("Content", "content"), ("Overall", "overall")):
        pdf.cell(0, 6, f"{label}: {scores.get(key, '-')}/10", ln=True)
    pdf.ln(4)

    answer_analysis = feedback.get("answer_analysis", [])
    if answer_analysis:
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "Q&A Transcript", ln=True)
        pdf.set_font("Helvetica", "", 10)
        for i, item in enumerate(answer_analysis, 1):
            verdict = _VERDICT_LABELS.get(item.get("verdict", ""), "")
            pdf.set_font("Helvetica", "B", 10)
            pdf.multi_cell(0, 5, f"{i}. [{verdict}] {item.get('question', '')}")
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 5, f"   Answer: {item.get('student_answer', '')}")
            better = item.get("better_answer")
            if better:
                pdf.multi_cell(0, 5, f"   Suggested: {better}")
            pdf.ln(2)
        pdf.ln(2)

    phrases = feedback.get("phrases_to_memorize", [])
    if phrases:
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "Phrases to Remember", ln=True)
        pdf.set_font("Helvetica", "", 10)
        for p in phrases:
            correct = p.get("correct")
            if correct:
                pdf.multi_cell(0, 5, f"- {correct}")
        pdf.ln(2)

    pdf.set_font("Helvetica", "I", 9)
    pdf.multi_cell(
        0, 5,
        "Full detailed feedback (in Russian) is available in your Vizora AI dashboard."
    )

    return bytes(pdf.output())
