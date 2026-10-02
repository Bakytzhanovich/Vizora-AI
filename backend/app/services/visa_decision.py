"""The consul's decision at the end of a J-1 Work and Travel interview.

A real officer decides under INA section 214(b): every applicant is presumed
to intend to immigrate until they show otherwise — that they're a genuine
full-time student who will go back to their studies, that the trip is a
cultural exchange rather than a job, and that they can manage in English.
Doubts about the job offer or documents lead to 221(g) administrative
processing instead.

In the simulator the officer always approves — hearing "your visa is approved"
is what keeps students practising. The real decision is still made here and
shown in the feedback, so a student who would have been refused at a real
window learns that, and why, instead of walking in falsely confident.

The model only fills in the checklist below, quoting what the student
actually said. The decision itself is the plain function `decide`, so the same
answers always give the same decision, the reasons can be shown to the student,
and the rules are testable without a network call.
"""

import json
import logging
from typing import Any

import openai

from app.services.ai_service import get_ai_client, get_chat_model, reasoning_kwargs

logger = logging.getLogger(__name__)

# What the officer says at the end of every simulated interview. Fixed text,
# not model output, so it's never paraphrased into something the frontend
# doesn't recognise.
CLOSING_LINE = (
    "Congratulations! Your visa is approved. You'll get your passport back with the visa in a few days. "
    "Enjoy your summer in the United States!"
)
CLOSING_KEY_PHRASES: dict[str, str] = {"approved": "your visa is approved"}

# Requirements the student has to show. "weak" means it came up and the answer
# didn't convince; "not_discussed" means the interview never got there, which
# isn't held against the student — a real officer has the DS-160 for that.
REQUIREMENTS: dict[str, str] = {
    "student_ties": "is a current full-time student who will continue studying at home (university, year, when classes resume)",
    "return_plan": "has a clear plan to return home when the program ends",
    "purpose": "the main purpose is cultural exchange, travel, practising English — not earning money",
    "program_knowledge": "knows their own program: sponsor, employer, job, city, dates",
    "finances": "can say who pays for the program and the plan is plausible",
    "communication": "understood the questions and answered in English well enough to work in the US",
}
RED_FLAGS: dict[str, str] = {
    "immigrant_intent": "wants to stay in the US, keep working there after the program, change status or marry there",
    "money_focus": "the main goal is to earn money — to pay debts, support family, save for something",
    "us_relatives": "plans to live with relatives or friends in the US, or relatives there overstayed a visa",
    "contradiction": "an answer contradicts an earlier answer or the student's own profile",
}
STATUSES = ("yes", "weak", "no", "not_discussed")

# Grounds that sink the application under 214(b) when they aren't shown.
_TIES = ("student_ties", "return_plan", "purpose", "communication")
# Grounds the officer can check by asking for documents instead (221(g)).
_DOCUMENTS = ("program_knowledge", "finances")

FALLBACK_DECISION = "processing"

_LABELS_RU: dict[str, str] = {
    "student_ties": "Учёба дома",
    "return_plan": "План возвращения",
    "purpose": "Цель поездки",
    "program_knowledge": "Знание своей программы",
    "finances": "Финансы",
    "communication": "Английский",
    "immigrant_intent": "Намерение остаться в США",
    "money_focus": "Цель — заработок",
    "us_relatives": "Родственники в США",
    "contradiction": "Противоречие в ответах",
}


def decide(checklist: dict[str, Any]) -> dict[str, Any]:
    """Decision and the reasons behind it, from a checklist shaped like
    {"requirements": {key: {"status", "quote", "note_ru"}}, "red_flags": {key: {"present", "quote", "note_ru"}}}.

    Red flags and unconvincing ties are a 214(b) refusal, as at a real window;
    doubts that documents could settle are 221(g); everything shown — approval.
    """
    reqs = checklist.get("requirements") or {}
    flags = checklist.get("red_flags") or {}

    def reason(key: str, item: dict[str, Any]) -> dict[str, str]:
        return {
            "key": key,
            "label_ru": _LABELS_RU[key],
            "quote": str(item.get("quote") or ""),
            "note_ru": str(item.get("note_ru") or ""),
        }

    raised = [reason(k, flags[k]) for k in RED_FLAGS if (flags.get(k) or {}).get("present") is True]
    if raised:
        return {"decision": "refused", "reasons": raised}

    def status(key: str) -> str:
        value = (reqs.get(key) or {}).get("status")
        return value if value in STATUSES else "not_discussed"

    not_shown = [reason(k, reqs[k]) for k in _TIES if status(k) in ("no", "weak")]
    if not_shown:
        return {"decision": "refused", "reasons": not_shown}

    to_verify = [reason(k, reqs[k]) for k in _DOCUMENTS if status(k) in ("no", "weak")]
    if to_verify:
        return {"decision": "processing", "reasons": to_verify}

    shown = [reason(k, reqs[k]) for k in REQUIREMENTS if status(k) == "yes"]
    return {"decision": "approved", "reasons": shown}


def _transcript_text(transcript: list[dict[str, Any]]) -> str:
    lines = []
    for entry in transcript:
        who = "OFFICER" if entry.get("role") == "officer" else "STUDENT"
        lines.append(f"{who}: {entry.get('content', '')}")
    return "\n".join(lines)


async def assess_interview(
    transcript: list[dict[str, Any]], profile_text: str, english_level: str | None = None,
) -> dict[str, Any] | None:
    """The 214(b) checklist for this interview, or None if the model call failed."""
    req_lines = "\n".join(f'  "{k}": {v}' for k, v in REQUIREMENTS.items())
    flag_lines = "\n".join(f'  "{k}": {v}' for k, v in RED_FLAGS.items())
    level_note = (
        f"\nThe student's measured spoken English level (Vizora level test): {english_level}."
        if english_level else ""
    )
    prompt = f"""You are reviewing a J-1 Work and Travel visa interview at a US consulate, the way the
consular officer does before deciding under INA section 214(b). Fill in the checklist ONLY from
what the student actually said in this interview. The answers are a speech-to-text transcript:
ignore punctuation and small slips, and remember non-English names (cities, universities) may be
missing from the text.

STUDENT'S APPLICATION (DS-160 / profile):
{profile_text}{level_note}

INTERVIEW:
{_transcript_text(transcript)}

REQUIREMENTS — for each, "status" is one of:
  "yes" — clearly shown; "weak" — it came up and the answer was vague, hesitant or unconvincing;
  "no" — the answer showed the opposite or the student couldn't answer; "not_discussed" — never came up.
{req_lines}

RED FLAGS — for each, "present" is true only if the student actually said something that shows it:
{flag_lines}

For every item give "quote": the student's exact words it rests on ("" if none) and "note_ru":
one short sentence in Russian addressed to the student ("ты"), explaining the judgement.

Return ONLY JSON:
{{"requirements": {{"student_ties": {{"status": "...", "quote": "...", "note_ru": "..."}}, ...}},
"red_flags": {{"immigrant_intent": {{"present": false, "quote": "", "note_ru": "..."}}, ...}}}}"""
    try:
        response = await get_ai_client().chat.completions.create(
            model=get_chat_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=3000,
            response_format={"type": "json_object"},
            **reasoning_kwargs(),
        )
        data = json.loads(response.choices[0].message.content or "{}")
    except (openai.APIError, json.JSONDecodeError, IndexError, TypeError) as e:
        logger.warning("visa decision model call failed: %s", e)
        return None
    if not isinstance(data.get("requirements"), dict) or not isinstance(data.get("red_flags"), dict):
        return None
    return data


async def make_decision(
    transcript: list[dict[str, Any]], profile_text: str, english_level: str | None = None,
) -> dict[str, Any]:
    """{"decision", "reasons"}. If the checklist can't be produced the case goes
    to administrative processing — the one outcome that claims nothing about the
    student, rather than a made-up approval or refusal."""
    checklist = await assess_interview(transcript, profile_text, english_level)
    if checklist is None:
        return {"decision": FALLBACK_DECISION, "reasons": []}
    return decide(checklist)
