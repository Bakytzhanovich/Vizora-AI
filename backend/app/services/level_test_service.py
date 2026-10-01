"""Spoken English placement test.

The student just talks: a friendly interlocutor climbs a ladder — two easy
questions (A1-A2), then two at B1, B2 and C1 — and the level is named only at
the end. The climb stops early once a band clearly goes badly, so a beginner
isn't put through C1 questions. The model is used for what it's good at —
judging a single answer against a rubric and writing a natural next question —
while the ladder and the final level are plain functions below
(ladder_next / is_finished / compute_final_level), so the same answers always
give the same level and the rules are testable without a network call.

Honest limit: answers arrive as Whisper text, so pronunciation isn't assessed
and Whisper smooths out some hesitations. Fluency is approximated from speaking
rate and shown separately; it doesn't move the level. The result is an
approximate CEFR level, never presented as an official certificate.
"""

import json
import logging
import random
from typing import Any

import openai

from app.services.ai_service import get_ai_client, get_chat_model, reasoning_kwargs

logger = logging.getLogger(__name__)

LEVELS: list[str] = ["A2", "B1", "B2", "C1"]  # question bands; A2 band also covers A1
START_LEVEL = "A2"

QUESTIONS_PER_LEVEL = 2
EXPECTED_QUESTIONS = QUESTIONS_PER_LEVEL * len(LEVELS)  # shown as the progress total
MAX_QUESTIONS = EXPECTED_QUESTIONS + 2  # room for a couple of refusals
STRONG_SCORE = 7.0  # answer clearly works at the question's level
WEAK_SCORE = 5.0    # answer clearly doesn't

# Fallbacks and topic examples — normally the next question is written by the
# model as a follow-up to what the student just said (see assess_answer).
QUESTION_BANK: dict[str, list[str]] = {
    "A2": [
        "Tell me a little about yourself — where are you from, and what do you do?",
        "What does a typical weekday look like for you?",
        "What's your favourite place in your city, and what do you do there?",
        "What do you like doing with your friends in your free time?",
        "What do you study, and do you like it?",
        "What kind of food does your family usually cook at home?",
    ],
    "B1": [
        "Tell me about the best trip you've ever taken.",
        "What are you planning to do this summer?",
        "Tell me about a time when something didn't go as planned. What happened?",
        "What job do you see yourself doing in five years, and why?",
        "Tell me about someone who has had a big influence on you.",
    ],
    "B2": [
        "Do you think young people should work while they study? Why or why not?",
        "Compare life in a big city and in a small town. Which do you prefer?",
        "How has social media changed the way people your age communicate?",
        "How do you think living abroad changes a person?",
        "Is it better to work in a team or alone? Give examples.",
    ],
    "C1": [
        "If you could change one decision you made in the past, what would it be and how would your life be different?",
        "Some people say that cultural exchange programs mainly benefit employers, not students. To what extent do you agree?",
        "How might artificial intelligence change the jobs available to your generation?",
        "What does \"success\" mean to you, and has your understanding of it changed over time?",
        "Imagine you're advising a friend who is afraid to go abroad alone. What would you say to convince them?",
    ],
}

# The student is preparing for a US summer, so a couple of questions are about
# the USA — but only a couple: the test is about their English, and everyday
# topics are what every level can talk about. Slots are fixed here (1-based
# number among scored answers) rather than left to the model, which otherwise
# drifted into asking about the USA at every band.
USA_QUESTION_NUMBERS = {4, 6}  # second B1 question, second B2 question
USA_QUESTIONS: dict[str, str] = {
    "A2": "Which city in the USA would you most like to visit?",
    "B1": "What do you expect your summer in the USA to be like?",
    "B2": "What differences do you expect between everyday life in the USA and in Kazakhstan?",
    "C1": "How might a summer of working in the USA change the way you see your own country?",
}

FIRST_QUESTION = QUESTION_BANK["A2"][0]

INTRO = (
    "Hi! Let's have a short chat so I can see your English level. "
    "Just answer naturally — there are no wrong answers. "
)
OUTRO = "Thank you, that was a great conversation! Let's see your results."

LEVEL_TITLES: dict[str, str] = {
    "A1": "Beginner",
    "A2": "Elementary",
    "B1": "Intermediate",
    "B2": "Upper-Intermediate",
    "C1": "Advanced",
}

# Profile.english_level uses three buckets (onboarding, risk_service).
_PROFILE_BUCKET: dict[str, str] = {"A1": "weak", "A2": "weak", "B1": "medium", "B2": "good", "C1": "good"}

RUBRIC_KEYS = ("grammar", "vocabulary", "coherence", "development")


# ─── Adaptive path (pure) ─────────────────────────────────────────────────────

def scored(turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turns that count toward the level. A refusal or a comment about the
    question ("that's not a good question") says nothing about the student's
    English, so it must not drag the level down or end the test."""
    return [t for t in turns if t.get("attempted", True)]


def answer_score(turn: dict[str, Any]) -> float:
    scores = turn.get("scores") or {}
    return sum(float(scores.get(k, 0)) for k in RUBRIC_KEYS) / len(RUBRIC_KEYS)


def band_scores(turns: list[dict[str, Any]], level: str) -> list[float]:
    return [answer_score(t) for t in scored(turns) if t["level"] == level]


def ladder_next(turns: list[dict[str, Any]]) -> str | None:
    """Band of the next question, or None when the test is over.

    Two scored answers per band, then one band up. The climb stops after a band
    whose answers clearly didn't work (average below WEAK_SCORE): asking a
    beginner C1 questions only discourages them and adds no information.
    """
    counted = scored(turns)
    if not counted:
        return START_LEVEL
    level = counted[-1]["level"]
    band = band_scores(turns, level)
    if len(band) < QUESTIONS_PER_LEVEL:
        return level
    if sum(band) / len(band) < WEAK_SCORE or level == LEVELS[-1]:
        return None
    return LEVELS[LEVELS.index(level) + 1]


def _by_level(turns: list[dict[str, Any]]) -> dict[str, list[float]]:
    out: dict[str, list[float]] = {lvl: [] for lvl in LEVELS}
    for t in scored(turns):
        out[t["level"]].append(answer_score(t))
    return out


def is_finished(turns: list[dict[str, Any]]) -> bool:
    return len(turns) >= MAX_QUESTIONS or ladder_next(turns) is None


def compute_final_level(turns: list[dict[str, Any]]) -> str:
    """Highest band the student handled (a strong answer and a solid average),
    plus "+" if they also landed a strong answer one band higher."""
    scores = _by_level(turns)

    def handled(lvl: str, min_strong: int) -> bool:
        s = scores[lvl]
        strong = sum(x >= STRONG_SCORE for x in s)
        # Mostly strong, not a single lucky answer among weaker ones.
        return bool(s) and strong >= min_strong and strong >= len(s) - strong and sum(s) / len(s) >= 6.5

    # Two strong answers at a band is the bar; a single one only counts when
    # no band has two (e.g. a very short test after several refusals).
    base: str | None = None
    for min_strong in (2, 1):
        for lvl in LEVELS:
            if handled(lvl, min_strong):
                base = lvl
        if base:
            break
    if base is None:
        a2 = scores["A2"]
        return "A2" if a2 and sum(a2) / len(a2) >= WEAK_SCORE else "A1"
    i = LEVELS.index(base)
    if i + 1 < len(LEVELS) and any(x >= STRONG_SCORE for x in scores[LEVELS[i + 1]]):
        return base + "+"
    return base


def profile_bucket(final_level: str) -> str:
    return _PROFILE_BUCKET[final_level.rstrip("+")]


def is_usa_slot(question_number: int) -> bool:
    return question_number in USA_QUESTION_NUMBERS


def pick_question(level: str, asked: set[str], test_id: str, about_usa: bool = False) -> str:
    if about_usa and USA_QUESTIONS[level] not in asked:
        return USA_QUESTIONS[level]
    rng = random.Random(f"{test_id}:{level}:{len(asked)}")
    pool = [q for q in QUESTION_BANK[level] if q not in asked] or QUESTION_BANK[level]
    return rng.choice(pool)


def fluency_score(words_per_minute: float | None) -> float | None:
    """Rough speaking-rate band. Recording time includes thinking pauses, so
    this reads low for everyone — it's a hint, not part of the level."""
    if words_per_minute is None:
        return None
    if words_per_minute >= 120:
        return 9.0
    if words_per_minute >= 90:
        return 7.0
    if words_per_minute >= 60:
        return 5.0
    if words_per_minute >= 35:
        return 3.0
    return 1.0


# ─── Model calls ──────────────────────────────────────────────────────────────

_LEVEL_DESCRIPTORS = """CEFR reference for the question bands:
- A2: simple sentences about self, family, routine; basic present tense; short but understandable.
- B1: connected narrative about experiences and plans; past and future tenses; gives simple reasons.
- B2: clear opinion with supporting arguments, comparisons, linking words (however, on the other hand); a range of vocabulary.
- C1: nuanced, well-structured argument; conditionals and complex sentences; precise, idiomatic vocabulary."""


async def _json_completion(prompt: str, max_tokens: int) -> dict[str, Any] | None:
    try:
        response = await get_ai_client().chat.completions.create(
            model=get_chat_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
            **reasoning_kwargs(),
        )
        return json.loads(response.choices[0].message.content or "{}")
    except (openai.APIError, json.JSONDecodeError, IndexError, TypeError) as e:
        logger.warning("level test model call failed: %s", e)
        return None


def _clamp(value: Any) -> float:
    try:
        return max(0.0, min(10.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


_QUESTION_STYLE = """What a question at each band must demand (so the answer can show that level):
- A2: concrete everyday facts — routine, places, people, food, free time. Present tense.
- B1: a story or plans — a specific past experience, a recent event, future plans, with reasons.
- B2: an opinion with reasons, a comparison, pros and cons of an everyday-life topic.
- C1: a hypothetical ("if you could…"), weighing a nuanced claim, defending a position on an abstract issue."""


_USA_INSTRUCTION = """TOPIC FOR THIS QUESTION: the USA. The student is preparing for a summer in the USA
(Work and Travel) — ask about places they want to see, what they expect, American culture or working
there, pitched at the band above."""
_EVERYDAY_INSTRUCTION = """TOPIC FOR THIS QUESTION: an everyday or general topic — NOT the USA, travel abroad or Work and
Travel. This is a general English level test; most questions are about the student's own life,
opinions and the world around them."""


async def assess_answer(
    question: str,
    level: str,
    answer: str,
    previous_questions: list[str] | None = None,
    next_question_level: str | None = None,
    next_about_usa: bool = False,
) -> dict[str, Any] | None:
    """Score one answer, react to it, and draft the next question at
    `next_question_level` — one call, so the conversation stays quick.

    Returns None when the model call fails. There's deliberately no neutral
    fallback score: a made-up score is indistinguishable from a real one and
    silently skews the level (seen when Groq's rate limit ran out mid-test).
    """
    next_band = next_question_level or level
    asked = "\n".join(f"- {q}" for q in (previous_questions or [])) or "- (none)"
    prompt = f"""You are a friendly English speaking examiner having a natural conversation with a
student from Kazakhstan to find their CEFR level. The answer below is a speech-to-text transcript.

{_LEVEL_DESCRIPTORS}

QUESTION ({level}): "{question}"
ANSWER: "{answer}"

STEP 1 — "answer_type":
- "refused": the student did not try to answer — commented on the question itself ("that's a strange
  question"), refused, or talked about something unrelated. Says nothing about their English.
- "not_understood": the student said they don't understand or clearly couldn't answer in English.
- "answer": anything else, including short, broken or weak attempts.

STEP 2 — scores (only matter for "answer"; give 0-2 for "not_understood"; anything for "refused").
Score how well the answer demonstrates ability AT THE {level} LEVEL, each 0-10:
- grammar: accuracy and range of structures expected at {level}
- vocabulary: range and precision expected at {level}
- coherence: logical, connected, organised answer
- development: answers the question with enough detail
The question is: does this answer show the student CAN operate at {level}?
- 7-8: meets {level} — errors typical of {level} are expected and do not lower the score as long
  as the meaning is clear (an A2 speaker saying "I go to park with my friend" meets A2).
- 9-10: clearly ABOVE {level}. A longer, richer or more complex answer than the question needs is
  a sign of a higher level — never penalise it.
- 5-6: partly meets {level}; below 5: clearly below {level}.
It is a speech transcript: ignore punctuation, spelling, hyphens and capitalisation. The speech
recogniser is set to English and silently DROPS non-English words — Kazakh or Russian names of
dishes, places and people — so a sentence with a gap where such a word belongs ("My favorite food
is because it's our national food") is a transcription artefact, not a grammar mistake: judge the
rest of the sentence and never penalise or correct the gap.

STEP 3 — "reaction": a short natural spoken reaction in English (3-10 words), like a friendly
conversation partner reacting to what they actually said. If "refused", acknowledge it lightly
and move on ("Fair enough — let's try something different."). If "not_understood", reassure
("No problem, let's try an easier one."). Never comment on their English, never say "correct".

STEP 4 — "corrections": up to 2 clear grammar or word-choice mistakes a teacher would correct in
SPEECH, most important first, as {{"wrong": "<exact words>", "correct": "<corrected>",
"explanation_ru": "<коротко по-русски, почему>"}}. Only for "answer". Never spelling, punctuation,
hyphens or dropped-word gaps; never suggest a "better" word for correct English. Empty list if none.

STEP 5 — "next_question": the next question, at the {next_band} band.
{_QUESTION_STYLE}
{_USA_INSTRUCTION if next_about_usa else _EVERYDAY_INSTRUCTION}
Make it a real conversation: you may build on one specific detail the student just said (a place,
a person, a plan they mentioned) — but never on the same detail twice in a row. Otherwise switch to
a NEW topic not covered yet, e.g.: studies, hometown, travel, friends, sport, music or films,
technology, work, holidays and traditions, nature, future plans, food.
Questions already asked (a paraphrase of one of these counts as a repeat — "What do you do after
school?" and "What do you do in your free time after school?" are the SAME question):
{asked}
One question each, at most 25 words, sounding like a curious person, not a textbook. Avoid
religion, politics, health and family money.

Return ONLY JSON:
{{"answer_type": "...", "grammar": n, "vocabulary": n, "coherence": n, "development": n,
"reaction": "...", "corrections": [...], "next_question": "..."}}"""
    data = await _json_completion(prompt, max_tokens=2000)
    if not data or not all(k in data for k in RUBRIC_KEYS):
        return None
    corrections = data.get("corrections") if isinstance(data.get("corrections"), list) else []
    answer_type = data.get("answer_type") if data.get("answer_type") in ("answer", "refused", "not_understood") else "answer"
    next_question = data.get("next_question")
    return {
        "attempted": answer_type != "refused",
        "answer_type": answer_type,
        "scores": {k: _clamp(data[k]) for k in RUBRIC_KEYS},
        "reaction": str(data.get("reaction") or "I see.").strip(),
        "corrections": [
            c for c in corrections[:2]
            if answer_type == "answer" and isinstance(c, dict) and c.get("wrong") and c.get("correct")
        ],
        "next_question": next_question.strip() if isinstance(next_question, str) and next_question.strip() else None,
    }


_FALLBACK_SUMMARY = {
    "summary_ru": "Мы определили твой примерный уровень по ответам в разговоре.",
    "strengths": [],
    "improve": [],
    "visa_note_ru": "Для визового интервью обычно достаточно уровня B1: важно понимать вопросы и отвечать уверенно.",
}


async def summarize(turns: list[dict[str, Any]], final_level: str) -> dict[str, Any]:
    lines = []
    for i, t in enumerate(scored(turns), 1):
        sc = ", ".join(f"{k} {t['scores'][k]:.0f}" for k in RUBRIC_KEYS)
        lines.append(f'[{i}] ({t["level"]}) Q: "{t["question"]}"\n    A: "{t["answer"]}"\n    scores: {sc}')
    prompt = f"""Ты преподаватель английского. Студент из Казахстана прошёл устный тест уровня;
по его ответам определён примерный уровень {final_level} ({LEVEL_TITLES[final_level.rstrip('+')]}).
Уровень уже посчитан — не меняй и не оспаривай его.

ОТВЕТЫ (транскрипт речи):
{chr(10).join(lines)}

Верни ТОЛЬКО JSON:
{{
  "summary_ru": "<2 предложения простыми словами: что студент уже умеет и чего пока не хватает до следующего уровня>",
  "strengths": ["<конкретная сильная сторона со ссылкой на его ответ>", "..."],
  "improve": ["<конкретно что подтянуть и как тренировать>", "..."],
  "visa_note_ru": "<1-2 предложения: хватит ли этого уровня для визового интервью Work and Travel (обычно нужен B1) и что делать дальше>"
}}
По 2-3 пункта в strengths и improve. Без общих советов — только по его ответам."""
    data = await _json_completion(prompt, max_tokens=2000)
    if not data:
        return dict(_FALLBACK_SUMMARY)
    return {
        "summary_ru": str(data.get("summary_ru") or _FALLBACK_SUMMARY["summary_ru"]),
        "strengths": [str(s) for s in data.get("strengths") or []][:3],
        "improve": [str(s) for s in data.get("improve") or []][:3],
        "visa_note_ru": str(data.get("visa_note_ru") or _FALLBACK_SUMMARY["visa_note_ru"]),
    }


def build_result(turns: list[dict[str, Any]], final_level: str, summary: dict[str, Any]) -> dict[str, Any]:
    counted = scored(turns)

    def avg(key: str) -> float:
        return round(sum(t["scores"][key] for t in counted) / len(counted), 1) if counted else 0.0

    fluencies = [f for t in counted if (f := fluency_score(t.get("words_per_minute"))) is not None]
    return {
        "level": final_level,
        "level_title": LEVEL_TITLES[final_level.rstrip("+")],
        "criteria": {
            **{k: avg(k) for k in RUBRIC_KEYS},
            "fluency": round(sum(fluencies) / len(fluencies), 1) if fluencies else None,
        },
        "corrections": [c for t in turns for c in t.get("corrections", [])][:5],
        **summary,
        "question_count": len(counted),
    }

