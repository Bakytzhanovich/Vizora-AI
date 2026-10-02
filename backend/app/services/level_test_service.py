"""Spoken English placement test.

The student just talks: a friendly interlocutor climbs a ladder — two easy
questions (A1-A2), then two at B1, B2 and C1 — and the climb stops early once a
band clearly goes badly, so a beginner isn't put through C1 questions.

The level is judged by the model from the student's own speech, on four
criteria — fluency, accuracy, vocabulary, grammar — against CEFR descriptors
(LEVEL_GUIDE). Before naming a level the model has to list what it heard: the
tenses and structures used and every error, so the level rests on evidence
rather than an impression. Fluency comes from the audio itself — Whisper's
word timings give speaking rate, pauses and fillers (speech_metrics) — because
a transcript reads fluent even when the student paused for five seconds.

The final level is the model's judgement of the whole conversation, kept
within one level of the student's sustained level (their second-best answer,
see sustained_level): one brilliant or one failed answer can't swing it.

Honest limit: pronunciation isn't assessed. The result is an approximate CEFR
level, never presented as an official certificate.
"""

import json
import logging
import random
from typing import Any

import openai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.level_test import LevelTest
from app.services.ai_service import get_ai_client, get_chat_model, reasoning_kwargs

logger = logging.getLogger(__name__)

CEFR: list[str] = ["A1", "A2", "B1", "B2", "C1", "C2"]
LEVELS: list[str] = ["A2", "B1", "B2", "C1"]  # question bands; A2 band also covers A1
START_LEVEL = "A2"

QUESTIONS_PER_LEVEL = 2
EXPECTED_QUESTIONS = QUESTIONS_PER_LEVEL * len(LEVELS)  # shown as the progress total
MAX_QUESTIONS = EXPECTED_QUESTIONS + 2  # room for a couple of refusals

CRITERIA = ("fluency", "accuracy", "vocabulary", "grammar")

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
    "C2": "Proficiency",
}

# Profile.english_level uses three buckets (onboarding, risk_service).
_PROFILE_BUCKET: dict[str, str] = {
    "A1": "weak", "A2": "weak", "B1": "medium", "B2": "good", "C1": "good", "C2": "good",
}


# ─── Adaptive path and final level (pure) ─────────────────────────────────────

def cefr_index(level: Any) -> int | None:
    base = str(level or "").rstrip("+")
    return CEFR.index(base) if base in CEFR else None


def scored(turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turns that count toward the level. A refusal or a comment about the
    question ("that's not a good question") says nothing about the student's
    English, so it must not drag the level down or end the test."""
    return [t for t in turns if t.get("attempted", True)]


def answer_level(turn: dict[str, Any]) -> int:
    """CEFR index the answer showed."""
    idx = cefr_index(turn.get("overall"))
    if idx is not None:
        return idx
    # Answers recorded before the CEFR rubric (a test in progress during the
    # deploy) carry 0-10 scores for how well they met the question's band.
    scores = turn.get("scores") or {}
    avg = sum(float(v) for v in scores.values()) / len(scores) if scores else 0.0
    band = CEFR.index(turn["level"])
    return band if avg >= 7 else max(0, band - 1)


def band_levels(turns: list[dict[str, Any]], level: str) -> list[int]:
    return [answer_level(t) for t in scored(turns) if t["level"] == level]


def ladder_next(turns: list[dict[str, Any]]) -> str | None:
    """Band of the next question, or None when the test is over.

    Two scored answers per band, then one band up. The climb stops after a band
    where neither answer reached the band's level: asking a beginner C1
    questions only discourages them and adds no information.
    """
    counted = scored(turns)
    if not counted:
        return START_LEVEL
    level = counted[-1]["level"]
    shown = band_levels(turns, level)
    if len(shown) < QUESTIONS_PER_LEVEL:
        return level
    if max(shown) < CEFR.index(level) or level == LEVELS[-1]:
        return None
    return LEVELS[LEVELS.index(level) + 1]


def is_finished(turns: list[dict[str, Any]]) -> bool:
    return len(turns) >= MAX_QUESTIONS or ladder_next(turns) is None


def _second_best(levels: list[int]) -> int | None:
    """The level the student reached at least twice. Not the average: easy
    opening questions can't show a high level and would drag a strong speaker
    down. Not the best: one lucky answer isn't the student's level."""
    if not levels:
        return None
    ranked = sorted(levels, reverse=True)
    return ranked[1] if len(ranked) > 1 else ranked[0]


def sustained_level(turns: list[dict[str, Any]]) -> str:
    idx = _second_best([answer_level(t) for t in scored(turns)])
    return CEFR[idx if idx is not None else 0]


def sustained_criterion(turns: list[dict[str, Any]], criterion: str) -> str | None:
    found = [i for t in scored(turns) if (i := cefr_index((t.get("levels") or {}).get(criterion))) is not None]
    idx = _second_best(found)
    return None if idx is None else CEFR[idx]


def clamp_level(level: Any, anchor: str) -> str:
    """The model's level, kept within one step of `anchor`; `anchor` if the
    model returned something that isn't a CEFR level."""
    idx, base = cefr_index(level), CEFR.index(anchor)
    if idx is None:
        return anchor
    return CEFR[max(base - 1, min(base + 1, idx))]


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


# ─── Fluency from the audio (pure) ────────────────────────────────────────────

FILLERS = frozenset({"um", "umm", "uh", "uhh", "uhm", "er", "erm", "hmm", "hm", "ah", "eh", "mm"})
LONG_PAUSE_SECONDS = 1.0


def speech_metrics(words: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Speaking rate, pauses and fillers from Whisper word timings.

    Speaking time runs from the first word to the last, so thinking before
    starting isn't counted as slow speech — silences inside the answer are,
    and each one over a second is also counted as a pause."""
    if len(words) < 2:
        return None
    speaking = words[-1]["end"] - words[0]["start"]
    if speaking < 1:
        return None
    tokens = [w["word"].strip().strip(".,!?…-").lower() for w in words]
    fillers = sum(t in FILLERS for t in tokens)
    gaps = [b["start"] - a["end"] for a, b in zip(words, words[1:])]
    spoken = len(words) - fillers
    return {
        "words": spoken,
        "speaking_seconds": round(speaking, 1),
        "words_per_minute": round(spoken / speaking * 60),
        "long_pauses": sum(g >= LONG_PAUSE_SECONDS for g in gaps),
        "longest_pause": round(max(gaps, default=0.0), 1),
        "fillers": fillers,
    }


def describe_speech(answer: str, metrics: dict[str, Any] | None, spoken: bool) -> str:
    """What the model is told about how the answer sounded."""
    if not spoken:
        return "TYPED answer (no audio): fluency cannot be judged — return null for fluency."
    if not metrics:
        return (f"Spoken answer, {len(answer.split())} words; audio timings unavailable — judge fluency "
                "from length and how connected the speech is.")
    return (
        f"Measured from the audio: {metrics['words']} words in {metrics['speaking_seconds']} s of speech "
        f"({metrics['words_per_minute']} words per minute), {metrics['long_pauses']} pauses longer than "
        f"{LONG_PAUSE_SECONDS:.0f} s (longest {metrics['longest_pause']} s), {metrics['fillers']} fillers (um/uh/er)."
    )


# ─── Model calls ──────────────────────────────────────────────────────────────

LEVEL_GUIDE = """HOW TO TELL THE LEVEL — judge how the student actually speaks:

A1–A2: answers in single words or very short phrases, many pauses; only basic everyday words;
simple tenses, mostly Present Simple.
  A1 — isolated words and memorised phrases instead of sentences ("Almaty. Student. Football.").
  A2 — short simple sentences about the present joined with "and / but / because"; a past event
       only in a few words ("I was in Turkey").
B1–B2: can talk about themselves, hobbies and plans; uses different tenses (past, future, present
perfect), but sometimes makes mistakes in complex grammar.
  B1 — tells a connected story about the past, talks about plans, gives simple reasons — even with
       noticeable errors ("we was there", "I never saw so big city"), limited vocabulary and pauses
       to find words.
  B2 — clear, detailed answers, gives arguments and comparisons with linking words (however,
       although, on the other hand), good grammar control, errors don't cause misunderstanding.
C1–C2: fluent, well-argued speech, rich vocabulary, rare errors.
  C1 — complex sentences, conditionals, nuance and precise or idiomatic vocabulary, only
       occasional slips.
  C2 — near-native precision and ease, practically no errors.

THE FOUR CRITERIA (each one a CEFR level A1, A2, B1, B2, C1 or C2):
- fluency: how the speech flows — answer length (one-word answers vs developed answers), pauses,
  fillers, speaking rate. Use the MEASURED audio facts. Roughly, for a learner: under ~70 words per
  minute or several long pauses in a short answer is A1–A2; ~80–120 with some pauses while searching
  for words is B1–B2; ~120+ with pauses only to think about content and long developed answers is C1–C2.
- accuracy: how often the student makes mistakes and whether they get in the way of meaning.
  Frequent basic errors (he go, I am agree) — A1–A2; errors mainly in complex grammar — B1–B2;
  rare slips — C1–C2.
- vocabulary: range — only basic everyday words (A1–A2), enough to talk about familiar topics with
  some paraphrasing (B1–B2), rich, precise, idiomatic (C1–C2).
- grammar: RANGE of structures the student USED, not their correctness — Present Simple only (A1–A2),
  different tenses: past, future, present perfect (B1–B2), complex sentences, conditionals, passive,
  varied structures (C1–C2). "We was there and swimmed" still uses the past tense — the mistakes
  count for accuracy, not here.

Be strict and honest: a level needs EVIDENCE in what the student said. Don't round up out of
kindness — an inflated level fails the student at the real visa interview."""


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
    speech: str,
    previous_questions: list[str] | None = None,
    next_question_level: str | None = None,
    next_about_usa: bool = False,
) -> dict[str, Any] | None:
    """Judge one answer on the four criteria, react to it, and draft the next
    question at `next_question_level` — one call, so the conversation stays quick.

    Returns None when the model call fails or returns no usable level. There's
    deliberately no neutral fallback: a made-up level is indistinguishable from
    a real one and silently skews the result (seen when Groq's rate limit ran
    out mid-test).
    """
    next_band = next_question_level or level
    asked = "\n".join(f"- {q}" for q in (previous_questions or [])) or "- (none)"
    prompt = f"""You are a friendly English speaking examiner having a natural conversation with a
student from Kazakhstan to find their CEFR level. The answer below is a speech-to-text transcript.

{LEVEL_GUIDE}

QUESTION (asked at {level}): "{question}"
ANSWER: "{answer}"
HOW IT SOUNDED: {speech}

STEP 1 — "answer_type":
- "refused": the student did not try to answer — commented on the question itself ("that's a strange
  question"), refused, or talked about something unrelated. Says nothing about their English.
- "not_understood": the student said they don't understand or clearly couldn't answer in English.
- "answer": anything else, including short, broken or weak attempts.

STEP 2 — evidence, BEFORE any level:
- "full_sentences": how many sentences with their own subject and verb the student said
  ("I live in Almaty" — 1; "Almaty. Student." — 0; "I like football and I play it" — 2).
- "structures": the tenses and structures the student actually used (e.g. "Present Simple",
  "Past Simple", "will-future", "Present Perfect", "second conditional", "relative clause").
- "errors": EVERY grammar or word-choice mistake, as {{"wrong": "<exact words>", "correct":
  "<corrected>", "explanation_ru": "<коротко по-русски, почему>"}}, most important first. Empty if none.
It is a speech transcript: ignore punctuation, spelling, hyphens and capitalisation. Fillers (um, uh)
are not errors — they count only for fluency. The speech recogniser is set to English and silently
DROPS non-English words — Kazakh or Russian names of dishes, places and people — so a sentence with a
gap where such a word belongs ("My favorite food is because it's our national food") is a
transcription artefact, not a mistake: never list or penalise the gap.

STEP 3 — levels from that evidence: "fluency", "accuracy", "vocabulary", "grammar" (null for fluency
on a typed answer), then "overall" — the level this answer shows as a whole. Judge the language,
not the question: a rich answer to an easy question shows a high level; a short or simple answer to
a hard question shows a low one. "overall" rests on what the student can say — grammar and
vocabulary — and is never above the higher of those two: smooth delivery of Present-Simple-only
sentences is still A2. For "not_understood" give A1. For "refused" give anything.

STEP 4 — "reaction": a short natural spoken reaction in English (3-10 words), like a friendly
conversation partner reacting to what they actually said. If "refused", acknowledge it lightly
and move on ("Fair enough — let's try something different."). If "not_understood", reassure
("No problem, let's try an easier one."). Never comment on their English, never say "correct".

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
{{"answer_type": "...", "full_sentences": n, "structures": [...], "errors": [...], "fluency": "..." or null,
"accuracy": "...", "vocabulary": "...", "grammar": "...", "overall": "...",
"reaction": "...", "next_question": "..."}}"""
    data = await _json_completion(prompt, max_tokens=2500)
    if not data:
        return None
    answer_type = data.get("answer_type") if data.get("answer_type") in ("answer", "refused", "not_understood") else "answer"
    overall = cefr_index(data.get("overall"))
    if overall is None and answer_type != "refused":
        return None
    levels = {k: CEFR[i] for k in CRITERIA if (i := cefr_index(data.get(k))) is not None}
    # What the student can say caps the level — fluent delivery of simple
    # sentences doesn't make them B1. Enforced here, not left to the prompt.
    said = [CEFR.index(levels[k]) for k in ("grammar", "vocabulary") if k in levels]
    if overall is not None and said:
        overall = min(overall, max(said))
    # Words without a single sentence is A1 by definition — the model tends to
    # round that up to A2, the top of the "A1–A2" range it was given.
    if answer_type == "answer" and data.get("full_sentences") == 0:
        overall = 0
        levels["grammar"] = "A1"
    errors = data.get("errors") if isinstance(data.get("errors"), list) else []
    errors = [e for e in errors if isinstance(e, dict) and e.get("wrong") and e.get("correct")]
    structures = data.get("structures") if isinstance(data.get("structures"), list) else []
    next_question = data.get("next_question")
    return {
        "attempted": answer_type != "refused",
        "answer_type": answer_type,
        "overall": CEFR[overall] if overall is not None else None,
        "levels": levels,
        "structures": [str(x) for x in structures][:8],
        "error_count": len(errors),
        "reaction": str(data.get("reaction") or "I see.").strip(),
        "corrections": errors[:2] if answer_type == "answer" else [],
        "next_question": next_question.strip() if isinstance(next_question, str) and next_question.strip() else None,
    }


_FALLBACK_SUMMARY = {
    "summary_ru": "Мы определили твой примерный уровень по ответам в разговоре.",
    "strengths": [],
    "improve": [],
    "visa_note_ru": "Для визового интервью обычно достаточно уровня B1: важно понимать вопросы и отвечать уверенно.",
}


def _turn_for_prompt(i: int, t: dict[str, Any]) -> str:
    levels = ", ".join(f"{k} {v}" for k, v in (t.get("levels") or {}).items())
    return (
        f'[{i}] question ({t["level"]}): "{t["question"]}"\n'
        f'    answer: "{t["answer"]}"\n'
        f'    how it sounded: {t.get("speech_note") or "—"}\n'
        f'    structures: {", ".join(t.get("structures") or []) or "—"}; errors: {t.get("error_count", 0)}\n'
        f'    judged for this answer: {levels or "—"}; overall {t.get("overall") or "—"}'
    )


async def assess_test(turns: list[dict[str, Any]]) -> dict[str, Any]:
    """The final result: the model judges the whole conversation, the level is
    kept within one step of the sustained level, and if the model call fails
    the sustained levels are used as they are."""
    counted = scored(turns)
    anchor = sustained_level(turns)
    spoken = any(t.get("spoken") for t in counted)
    prompt = f"""Ты экзаменатор по английскому. Студент из Казахстана прошёл устный разговорный тест.
Определи его уровень по тому, КАК ОН ГОВОРИТ, — по всем ответам вместе.

{LEVEL_GUIDE}

ОТВЕТЫ (транскрипт речи; по каждому — что было измерено по аудио и как оценён этот ответ):
{chr(10).join(_turn_for_prompt(i, t) for i, t in enumerate(counted, 1))}

Ориентир по ответам: устойчивый уровень студента — {anchor}. Итог — это уровень, на котором студент
говорит стабильно, а не его лучший ответ: первые вопросы простые и высокий уровень показать не дают,
а один удачный ответ ещё не уровень.
{"" if spoken else "Все ответы набраны текстом — беглость не оценивай, верни для fluency null."}

Верни ТОЛЬКО JSON:
{{
  "level": "<A1|A2|B1|B2|C1|C2>",
  "fluency": "<уровень или null>", "accuracy": "<уровень>", "vocabulary": "<уровень>", "grammar": "<уровень>",
  "summary_ru": "<2 предложения простыми словами: что студент уже умеет и чего пока не хватает до следующего уровня>",
  "strengths": ["<конкретная сильная сторона со ссылкой на его ответ>", "..."],
  "improve": ["<конкретно что подтянуть и как тренировать>", "..."],
  "visa_note_ru": "<1-2 предложения: хватит ли этого уровня для визового интервью Work and Travel (обычно нужен B1) и что делать дальше>"
}}
По 2-3 пункта в strengths и improve. Без общих советов — только по его ответам."""
    data = await _json_completion(prompt, max_tokens=2500) or {}

    level = clamp_level(data.get("level"), anchor) if data else anchor
    criteria: dict[str, str | None] = {}
    for key in CRITERIA:
        own = sustained_criterion(turns, key)
        if key == "fluency" and not spoken:
            criteria[key] = None
        elif own is None:
            criteria[key] = None
        else:
            criteria[key] = clamp_level(data.get(key), own) if data else own
    summary = {
        "summary_ru": str(data.get("summary_ru") or _FALLBACK_SUMMARY["summary_ru"]),
        "strengths": [str(x) for x in data.get("strengths") or []][:3],
        "improve": [str(x) for x in data.get("improve") or []][:3],
        "visa_note_ru": str(data.get("visa_note_ru") or _FALLBACK_SUMMARY["visa_note_ru"]),
    }
    return {
        "level": level,
        "level_title": LEVEL_TITLES[level],
        "criteria": criteria,
        "corrections": [c for t in turns for c in t.get("corrections", [])][:5],
        **summary,
        "question_count": len(counted),
    }


# ─── Reporting (admin panel, agency cabinet) ──────────────────────────────────

REPORT_LEVELS = CEFR


async def latest_level_results(db: AsyncSession, user_ids: list[str] | None = None) -> dict[str, dict[str, Any]]:
    """Each user's most recent full test: {user_id: {"level", "tested_at"}}.
    Tests finished early have no final_level and are skipped.
    `user_ids=None` means every user (admin); an empty list means nobody."""
    if user_ids is not None and not user_ids:
        return {}
    query = (
        select(LevelTest.user_id, LevelTest.final_level, LevelTest.completed_at)
        .where(LevelTest.completed.is_(True), LevelTest.final_level.is_not(None))
        .order_by(LevelTest.completed_at.desc())
    )
    if user_ids is not None:
        query = query.where(LevelTest.user_id.in_(user_ids))
    latest: dict[str, dict[str, Any]] = {}
    for user_id, level, completed_at in (await db.execute(query)).all():
        if user_id not in latest:  # rows are newest first
            latest[user_id] = {
                "level": level,
                "tested_at": completed_at.isoformat() if completed_at else None,
            }
    return latest


def level_distribution(latest: dict[str, dict[str, Any]]) -> dict[str, int]:
    """Students per CEFR band; "B1+" counts as B1."""
    counts = {lvl: 0 for lvl in REPORT_LEVELS}
    for result in latest.values():
        base = (result.get("level") or "").rstrip("+")
        if base in counts:
            counts[base] += 1
    return counts
