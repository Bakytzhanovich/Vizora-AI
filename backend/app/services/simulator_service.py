import hashlib
import json
import logging
import random
from typing import Any, AsyncGenerator

import openai

from app.services.ai_service import get_ai_client, get_chat_model, strip_unexpected_scripts

# Full question bank sourced from official agency interview prep document (58 real questions).
# 70% of these are asked at every interview. Order within each phase reflects real consul flow.
INTERVIEW_QUESTION_BANK: dict[str, list[str]] = {
    # Phase 1 — Opening (always first 1-2 exchanges)
    "opening": [
        "How are you today?",
        "How did you get to the city today?",
        "What is the purpose of your visit to the United States?",
    ],
    # Phase 2 — Workplace rights / brochure (asked EARLY — consul tests if student prepared)
    "rights_knowledge": [
        "Did you read the brochure? Tell me something about what you read.",
        "You read the book, right? What is it about?",
        "Do you know about your rights at the workplace?",
        "If there is an emergency at your job, what will you do?",
        "What rights do you have in the States?",
        "What if you are fired from your job?",
        "What if you lost your passport?",
        "What if you were paid incorrectly?",
        "What will you do if anyone takes your passport?",
        "Any questions about this book?",
    ],
    # Phase 3 — Education (very detailed — consul may ask about specific classes, teachers, dean)
    "education": [
        "What do you study?",
        "What course are you? What year are you in?",
        "Where do you study?",
        "Are you a full-time or a part-time student?",
        "What faculty do you study at?",
        "What is your major?",
        "Why have you chosen this major/faculty/university?",
        "When are you going to graduate? How many years do you have to go?",
        "Are you a good student? Do you have problems at university?",
        "How much time does it take to get to your university?",
        "What classes did you miss today?",
        "What classes will you have tomorrow?",
        "What exams did you have last session? How did you pass them?",
        "Will you have problems at your university if you come back late?",
        "Will you have any problems if you leave early?",
        "What are you going to do after graduation? What are your plans for the future?",
    ],
    # Phase 4 — Personal & family
    "personal": [
        "Do you live with your parents? Why? Why not?",
        "Have you got brothers or sisters? Are they participating in any exchange program?",
        "Have you ever been abroad? Where and when?",
        "Do you have friends or relatives in the USA?",
        "What do your parents think about your participation in the program?",
        "Can you describe yourself? How can you characterize yourself?",
        "Can you describe your hometown?",
    ],
    # Phase 5 — English level
    "english_level": [
        "How well do you know/speak English?",
        "How long have you been learning English? Where?",
    ],
    # Phase 6 — Trip purpose
    "trip_purpose": [
        "Why do you want to go to the USA?",
        "What is the purpose of your visit to the US?",
        "How did you get into this program? Why did you decide to participate?",
    ],
    # Phase 7 — Trip details (consul expects precise answers: company name, city, salary, manager)
    "trip_details": [
        "What kind of job will you have in the USA?",
        "Why this job?",
        "In which city will you work? What is the name of the company?",
        "When do you need to start your job in the US?",
        "Did your coordinator suggest you this job?",
        "Are you travelling with your friends or alone?",
        "Where are you going to stay in the US?",
        "How long are you going to stay in the US?",
        "How will this experience help you in your future?",
        "What will you do if you have problems with your boss at work?",
    ],
    # Phase 8 — Finances
    "financial": [
        "Who gives you money for the trip? Who pays for your trip?",
        "What is your parents' annual income? How much do your parents earn?",
        "Where do your parents work?",
    ],
    # Phase 9 — Return & medical (closing phase)
    "return_medical": [
        "What will you do after you come back to Kazakhstan?",
        "Have you got any medical restrictions?",
        "Do you have medical problems?",
        "Are you on medication?",
        "Do you have any chronic diseases?",
    ],
    # Wildcard — consul improvises ~30% of questions from personal/unexpected topics
    "wildcard": [
        "What classes did you miss today?",
        "What classes will you have tomorrow?",
        "What exams did you have last session? How did you pass them?",
        "How many classes do you have per day?",
        "What is your favorite subject?",
        "Can you describe yourself? How would you characterize yourself?",
        "Can you describe your hometown?",
        "What do you do after classes?",
        "What are your hobbies?",
        "Do you play any sport?",
        "What kind of books do you read?",
        "Do you smoke?",
        "Do you have a car? Does your family have a car?",
        "Have you ever seen the USA on TV or in movies?",
        "Do you have a boyfriend or girlfriend?",
        "How many rooms are there in your flat?",
        "What is the main street in your city?",
        "Is your city large or small?",
        "How long have you been living in your current city?",
        "Are you religious?",
        "What does your father do for work? What about your mother?",
        "How old are your parents?",
        "Do you have any savings of your own?",
        "Have you worked before? What was your job?",
    ],
}

# Field-tested coaching tips from official agency document (58 real questions).
# Used in TRAINER mode. Presented as agency tips, NOT official law.
ANSWER_GUIDANCE: dict[str, str] = {
    "trip_purpose": (
        "КРИТИЧНО: Никогда не говори 'зарабатывать деньги' — это красный флаг для консула. "
        "Всегда говори: культурный обмен, практика английского, знакомство с культурой США. "
        "Пример: 'I want to improve my English, experience American culture, and make new friends.'"
    ),
    "financial_source": (
        "КРИТИЧНО: Всегда отвечай 'My parents' — даже если платишь сам или частично. "
        "Это стандарт агентств: показывает финансовую стабильность семьи. "
        "Не говори 'I pay myself' — вызывает подозрения о финансовой нестабильности."
    ),
    "friends_in_usa": (
        "КРИТИЧНО: На вопрос 'Do you have friends or relatives in the USA?' — всегда отвечай 'No.' "
        "Связи в США воспринимаются как риск нелегального остаться. "
        "Никогда не упоминай знакомых в США добровольно."
    ),
    "return_date": (
        "КРИТИЧНО: Всегда называй конкретную дату — 'before September 1st, before my university starts.' "
        "Расплывчатые ответы типа 'in the fall' — красный флаг. Конкретика и уверенность обязательны."
    ),
    "fired_from_job": (
        "Правильный ответ: 'I will contact my coordinator in my home city and my sponsor organization.' "
        "Никогда не говори, что уйдёшь или найдёшь другую работу самостоятельно без спонсора."
    ),
    "lost_passport": (
        "Правильный ответ: 'I will report to the police and contact the Kazakhstan Embassy in the US.' "
        "Знание этого шага производит хорошее впечатление на консула."
    ),
    "paid_incorrectly": (
        "Правильный ответ: 'I will talk to my coordinator in my home city and my sponsor organization first.' "
        "Показывает знание цепочки ответственности."
    ),
    "passport_taken": (
        "Правильный ответ: 'I will report to the police, contact my Sponsor organization "
        "and coordination agency in Kazakhstan.' Нельзя молчать если паспорт взяли."
    ),
    "rights_knowledge": (
        "Консул спрашивает о брошюре 'Your rights in the workplace in the USA' — РАНО, почти сразу. "
        "Ключевые права: минимальная зарплата, безопасные условия труда, право обратиться к спонсору. "
        "Пример: 'I have the right to minimum wage, safe working conditions, and to contact my sponsor if there are problems.'"
    ),
    "job_problems_boss": (
        "На вопрос о проблемах с начальником: 'I will listen to his recommendations and work better.' "
        "Не говори, что пожалуешься или уйдёшь — это показывает неготовность к работе."
    ),
    "university_late_return": (
        "Правильный ответ: 'Yes, I will have problems. That is why I am going to come back by September 1st.' "
        "Это показывает привязанность к учёбе — ключевой фактор против риска остаться в США."
    ),
    "sevis_knowledge": (
        "Консул может спросить про SEVIS — нужно знать: регистрация в течение 3 дней после приезда к работодателю, "
        "ежемесячное обновление статуса. Нарушение = депортация."
    ),
}

# Unexpected personal questions used by the SILENCE/WILDCARD techniques below —
# these test whether the student sounds natural vs. rehearsed, distinct from the
# scripted "wildcard" phase pool above (which stays on safe icebreaker topics).
PERSONAL_WILDCARD_QUESTIONS: list[str] = [
    "What did you eat for breakfast today?",
    "What is your favorite American movie?",
    "Do you know anyone who stayed in the US illegally?",
    "What time did you wake up this morning?",
    "What's the weather like in your city right now?",
    "Have you ever missed a flight or a bus?",
]

_PERSONALITY_LABELS_RU: dict[str, str] = {
    "neutral": "нейтральный",
    "friendly": "дружелюбный",
    "strict": "строгий",
}

_PERSONALITY_INSTRUCTIONS: dict[str, str] = {
    "neutral": (
        "Tone: neutral and businesslike. Brief acknowledgments only ('I see.', 'Okay.', 'Alright.') — never warm, never cold."
    ),
    "friendly": (
        "Tone: slightly warmer than a typical officer, but still professional — this is NOT a friendly chat. "
        "Occasionally use a marginally softer acknowledgment ('Okay, thank you.', 'Alright, good.') instead of the bare minimum. "
        "Still never praise the content of an answer and still ask every question in the structure."
    ),
    "strict": (
        "Tone: more skeptical and terse than usual. Favor the shortest acknowledgments ('Really?', 'Hm.') "
        "or none at all. Push harder on vague answers — use FAST FOLLOW-UP more readily and take longer pauses "
        "before responding to weak answers."
    ),
}


def get_officer_personality(session_id: str | None) -> str:
    """Deterministic per-session officer personality: neutral 50% / friendly 20% / strict 30%.

    Seeded from session_id so the same session always gets the same officer
    (consistent tone across turns) while different sessions vary.
    """
    rng = _session_rng(session_id)
    return rng.choices(["neutral", "friendly", "strict"], weights=[50, 20, 30], k=1)[0]


def _turn_rng(session_id: str | None, turn_index: int) -> random.Random:
    """Deterministic per-turn RNG, independent of the per-session RNG used for question picks."""
    seed_key = f"{session_id}:{turn_index}" if session_id else None
    return random.Random(_seed_from_key(seed_key))


RISK_QUESTIONS: dict[str, list[str]] = {
    "no_travel_history": [
        "You have never traveled abroad. Why should I trust you will return?",
        "What ties do you have to your home country that ensure your return?",
        "Will you have problems at your university if you come back late?",
        "What will you do when you return to Kazakhstan?",
    ],
    "parent_finances": [
        "Who exactly is paying for this trip?",
        "What is your parents' annual income?",
        "Where do your parents work?",
        "Do you have bank statements to prove financial support?",
    ],
    "high_risk_year": [
        "You are in your final year. Why go now instead of focusing on graduation?",
        "What are your plans after graduation?",
        "Do you intend to return to complete your studies?",
        "Will you have any problems if you leave early?",
    ],
    "weak_english": [
        "Can you repeat that more clearly?",
        "I did not understand. Please explain again in simpler terms.",
        "How long have you been learning English?",
    ],
}


def _seed_from_key(key: str | None) -> int | None:
    """Shared deterministic seed derivation. None → caller gets true randomness."""
    if not key:
        return None
    return int(hashlib.sha256(key.encode()).hexdigest(), 16) % (2 ** 32)


def _session_rng(session_id: str | None) -> random.Random:
    """Return a Random instance seeded from session_id.
    Same session → same question mix (reproducible).
    Different sessions → different mixes (variety).
    """
    return random.Random(_seed_from_key(session_id))


def _pick(rng: random.Random, pool: list[str], k: int) -> list[str]:
    return rng.sample(pool, min(k, len(pool)))


def _fmt(questions: list[str]) -> str:
    return "\n  - " + "\n  - ".join(questions)


def _profile_text(profile: dict[str, Any]) -> str:
    level_map = {"weak": "слабый", "medium": "средний", "good": "хороший"}
    finance_map = {"self": "сам", "parents": "родители", "scholarship": "стипендия"}
    return (
        f"Страна: {profile.get('country', 'KZ')}, "
        f"Курс: {profile.get('course_year', '?')}, "
        f"Специальность: {profile.get('profession', '?')}, "
        f"Английский: {level_map.get(profile.get('english_level', ''), '?')}, "
        f"Поездки за рубеж: {'есть' if profile.get('travel_history') else 'нет'}, "
        f"Финансирование: {finance_map.get(profile.get('financial_source', ''), '?')}"
    )


def _profile_text_en(profile: dict[str, Any]) -> str:
    level_map = {"weak": "weak English", "medium": "intermediate English", "good": "strong English"}
    finance_map = {"self": "self-funded", "parents": "parents paying", "scholarship": "scholarship"}
    travel = "has prior international travel" if profile.get("travel_history") else "no prior international travel"
    return (
        f"Country: {profile.get('country', 'KZ')}, "
        f"university year: {profile.get('course_year', '?')}, "
        f"major/profession: {profile.get('profession', 'unknown')}, "
        f"English level: {level_map.get(profile.get('english_level', ''), 'unknown')}, "
        f"{travel}, "
        f"funding: {finance_map.get(profile.get('financial_source', ''), 'unknown')}"
    )


def _risks_text(risks: list[dict[str, Any]]) -> str:
    if not risks:
        return "Явных рисков не обнаружено"
    return "; ".join([r.get("label_ru", r.get("type", "")) for r in risks])


def _risks_text_en(risks: list[dict[str, Any]]) -> str:
    if not risks:
        return "No specific risk flags"
    return "; ".join([r.get("type", "") for r in risks if r.get("type")])


def _risk_questions_text(risks: list[dict[str, Any]]) -> str:
    lines = []
    for risk in risks:
        t = risk.get("type", "")
        if t in RISK_QUESTIONS:
            lines.append(f"[{t}]: " + " | ".join(RISK_QUESTIONS[t]))
    return "\n".join(lines) if lines else "Стандартные вопросы"


def _answer_guidance_text() -> str:
    lines = []
    for key, tip in ANSWER_GUIDANCE.items():
        lines.append(f"[{key}]: {tip}")
    return "\n".join(lines)


def get_trainer_prompt(profile: dict[str, Any], risks: list[dict[str, Any]]) -> str:
    return f"""Ты опытный тренер по подготовке к визовым интервью США для программы Work & Travel.

Симулируй реальное интервью в консульстве США. После каждого ответа студента:
1. На РУССКОМ дай краткий фидбек (1-2 предложения) — что хорошо, что плохо
2. Если ответ содержит КРИТИЧЕСКИЙ РИСК-ПАТТЕРН — флагуй с объяснением почему это опасно
3. Предложи лучшую формулировку: 📝 Better: "..."
4. Задай следующий вопрос НА АНГЛИЙСКОМ (следуй реальной структуре интервью)

Формат ответа:
💬 [Фидбек на русском, 1-2 предложения]
📝 Better: "[улучшенная формулировка на английском]" (только если нужно улучшение)
Next question: [следующий вопрос на английском]

РЕАЛЬНАЯ СТРУКТУРА ИНТЕРВЬЮ (следуй этому порядку):
1. Открытие: How are you? / How did you get here?
2. БРОШЮРА О ПРАВАХ (спрашивается рано!): Did you read the brochure? What rights do you have?
3. Учёба: Where do you study? Major? Year? Graduation?
4. Личное: Parents? Been abroad? Relatives in USA?
5. Цель поездки: Why USA? Cultural exchange?
6. Детали поездки: Job? City? Company? Start date? Duration?
7. Финансы: Who pays? Parents' income?
8. Возврат и здоровье: Plans after return? Medical issues?

КРИТИЧЕСКИЕ РИСК-ПАТТЕРНЫ (фиксируй немедленно):
{_answer_guidance_text()}

ВАЖНО: Эти паттерны — рекомендации агентств, НЕ официальный закон. Всегда представляй как "coaching tip от агентства".

ПРОФИЛЬ СТУДЕНТА: {_profile_text(profile)}
РИСКИ: {_risks_text(risks)}
ВОПРОСЫ ПО РИСКАМ ЭТОГО СТУДЕНТА: {_risk_questions_text(risks)}

Начинай с открытия и двигайся по структуре. Уделяй особое внимание зонам риска."""


_DIFFICULTY_INSTRUCTIONS: dict[str, str] = {
    "easy": (
        "Be professional but courteous. Accept reasonable answers without heavy follow-ups. "
        "Move through phases at a steady pace."
    ),
    "medium": (
        "Be direct and professional. If an answer is vague or evasive, "
        "ask ONE follow-up within the same phase, then move on."
    ),
    "hard": (
        "Be skeptical and thorough. Challenge weak or suspicious answers with a pointed follow-up. "
        "Press harder on risk-flag phases. Maintain a stern, formal tone throughout."
    ),
}


def get_consul_prompt(
    profile: dict[str, Any],
    risks: list[dict[str, Any]],
    difficulty: str = "medium",
    session_id: str | None = None,
    turn_index: int = 0,
    transcript: list[dict[str, Any]] | None = None,
) -> str:
    rng = _session_rng(session_id)

    # Sample a unique question set for this session from each phase pool
    rights_qs   = _pick(rng, INTERVIEW_QUESTION_BANK["rights_knowledge"], 3)
    edu_qs      = _pick(rng, INTERVIEW_QUESTION_BANK["education"],        4)
    personal_qs = _pick(rng, INTERVIEW_QUESTION_BANK["personal"],         2)
    purpose_qs  = _pick(rng, INTERVIEW_QUESTION_BANK["trip_purpose"],     2)
    trip_qs     = _pick(rng, INTERVIEW_QUESTION_BANK["trip_details"],     3)
    finance_qs  = _pick(rng, INTERVIEW_QUESTION_BANK["financial"],        2)
    return_qs   = _pick(rng, INTERVIEW_QUESTION_BANK["return_medical"],   2)
    wildcard_qs = _pick(rng, INTERVIEW_QUESTION_BANK["wildcard"],         2)

    risk_qs: list[str] = []
    for risk in risks:
        t = risk.get("type", "")
        if t in RISK_QUESTIONS:
            risk_qs.extend(RISK_QUESTIONS[t])
    risk_text = _fmt(risk_qs) if risk_qs else "\n  None — proceed to closing."

    difficulty_note = _DIFFICULTY_INSTRUCTIONS.get(difficulty, _DIFFICULTY_INSTRUCTIONS["medium"])

    personality = get_officer_personality(session_id)
    personality_note = _PERSONALITY_INSTRUCTIONS[personality]

    # Per-turn deterministic directives for the low-probability techniques —
    # rolled independently of the session RNG so they don't disturb the fixed
    # question-bank sampling above, but still reproducible for a given turn.
    # Exclude wildcard questions already asked this session so the 10%-per-turn roll can
    # never make the officer repeat itself verbatim (which STRICT RULES forbids).
    asked_texts = {e["content"] for e in (transcript or []) if e.get("role") == "officer"}
    available_wildcards = [q for q in PERSONAL_WILDCARD_QUESTIONS if q not in asked_texts]

    turn_rng = _turn_rng(session_id, turn_index)
    use_silence = turn_rng.random() < 0.20
    use_wildcard = turn_rng.random() < 0.10 and bool(available_wildcards)
    wildcard_question = _pick(turn_rng, available_wildcards, 1)[0] if use_wildcard else None

    turn_directives = []
    if use_wildcard:
        turn_directives.append(
            f'THIS TURN: instead of the next planned question, ask this unexpected personal question '
            f'verbatim to test naturalness: "{wildcard_question}"'
        )
    elif use_silence:
        turn_directives.append(
            "THIS TURN: use the SILENCE TECHNIQUE — do not acknowledge the previous answer at all "
            "(no 'I see', no 'Okay', nothing). Go directly to the next question as if pausing to write notes first."
        )
    turn_directive_text = "\n".join(turn_directives) if turn_directives else "THIS TURN: proceed normally."

    return f"""You are a strict US consulate officer conducting a J-1 Work and Travel visa interview.

=== THIS SESSION'S QUESTION SET ===
Each session uses a different mix of questions drawn from the real consulate question bank.
Work through each phase in order. After 2-3 questions per phase, move to the next.
Use THESE specific questions — not other questions you might know.

PHASE 1 — Opening (1 question only):
  - "Good morning. What is the purpose of your visit to the United States?"

PHASE 2 — Workplace Rights & Brochure (ask 2-3 of these THIS EARLY):{_fmt(rights_qs)}

PHASE 3 — Education (ask 2-3 of these):{_fmt(edu_qs)}

PHASE 4 — Personal & Family (ask 1-2 of these):{_fmt(personal_qs)}

PHASE 5 — Trip Purpose (ask 1-2 of these):{_fmt(purpose_qs)}

PHASE 6 — Trip Details (ask 2-3 of these):{_fmt(trip_qs)}

PHASE 7 — Finances (ask 1-2 of these):{_fmt(finance_qs)}

PHASE 8 — Return & Closing (ask 1-2 of these):{_fmt(return_qs)}

PHASE 8b — Wildcard (ask 1-2 if time allows — simulates real consul improvisation):{_fmt(wildcard_qs)}

PHASE 9 — Risk follow-ups for this student:{risk_text}

PHASE 10 — Close (see INTERVIEW LENGTH below for when to trigger this):
  Privately judge how the WHOLE interview went, then output ONLY the matching quoted sentence
  below — verbatim, nothing before or after it, no explanation of which case matched, no
  restating the condition:
  - Case: answers were strong, confident, and consistent throughout, with no unresolved concerns.
    Output exactly: "Congratulations. Your visa is approved. Welcome to the Work and Travel program."
    (say it as a genuine motivating moment — the one time you may sound warm)
  - Case: answers were mixed — acceptable overall but with some vague or weak moments.
    Output exactly: "Thank you. Your application will be processed. You'll receive notification within 3 to 5 business days."
  - Case: you had to press hard on multiple weak, evasive, or contradictory answers.
    Output exactly: "Thank you. That will be all."
  Do not default to the approval line — only use it when genuinely earned.

=== INTERVIEW LENGTH ===
So far there have been {turn_index} exchanges in this interview.
- If the student's answers have been strong, consistent, and confident: move to PHASE 10 after 8-10 exchanges total.
- If answers have been vague, evasive, or raised concerns you had to press on: extend to 15+ exchanges before closing.
- Never end abruptly mid-phase — finish the current phase's minimum questions first, then close.

=== EMOTIONAL REACTIONS (this is what makes you feel like a real officer, not a form) ===
1. GOOD answer (clear, confident, complete): respond with ONE short neutral acknowledgment only —
   "I see." / "Okay." / "Alright." — then immediately ask the next question. NEVER praise or encourage
   ("Good job", "Great", "Well done" are forbidden).
2. WEAK or VAGUE answer: imply a brief pause, then use ONE of — "Could you be more specific?" /
   "I'm not sure I understand." / "Can you elaborate on that?" — before moving on.
3. SUSPICIOUS answer: use a skeptical follow-up — "Really?" / "Are you sure about that?" /
   "That's interesting. Tell me more." — in a doubtful tone.
4. FAST FOLLOW-UP: when an answer raises questions (vague employer, vague dates, vague amounts),
   fire off rapid, specific follow-ups instead of your normal single question — e.g.
   "Who exactly? What company? Which city? What date? How much exactly?" Pick 1-2 of these, not all at once.
5. CONTRADICTION CHECK: if the student's current answer conflicts with something they said earlier in
   this conversation, call it out before moving on: "Wait, earlier you mentioned [X]. Now you're saying [Y].
   Can you clarify?" — quote their actual earlier words.

=== OFFICER PERSONALITY FOR THIS SESSION ===
{personality_note}

=== THIS TURN'S DIRECTIVE ===
{turn_directive_text}

=== STRICT RULES ===
1. Speak ONLY in English — never any other language.
2. Ask ONE question per turn — never two at once (the FAST FOLLOW-UP rapid-fire above counts as one turn).
3. Never repeat a question already asked in this conversation.
4. Acknowledgments are LIMITED to the short forms in EMOTIONAL REACTIONS above — never longer filler,
   never "Thank you for that", never anything that sounds like encouragement or teaching.
5. Never explain, teach, or comment on the correctness of an answer — you are an officer, not a teacher.
6. Never break character; never acknowledge being an AI.
7. After Phase 10, produce no more questions.
8. On Phase 10, output ONLY the exact quoted closing sentence — never your reasoning, never which
   case you matched, never any text besides that one sentence.

=== HANDLING OFF-TOPIC OR IRRELEVANT ANSWERS ===
If the student does not answer your question:
  → Say ONCE: "Please answer my question directly. [Restate question]"
  → If still off-topic, accept it and move on — never ask the same question more than twice.

=== DIFFICULTY ===
{difficulty_note}

=== STUDENT PROFILE ===
{_profile_text_en(profile)}
Risk flags: {_risks_text_en(risks)}

Review the full conversation so far (check for contradictions with earlier answers), identify the
current phase, and produce the single next officer turn following EMOTIONAL REACTIONS, THIS TURN'S
DIRECTIVE, and the question set above."""


async def generate_simulator_response(
    mode: str,
    transcript: list[dict[str, Any]],
    profile: dict[str, Any],
    risks: list[dict[str, Any]],
    difficulty: str = "medium",
    session_id: str | None = None,
) -> AsyncGenerator[str, None]:
    if mode == "trainer":
        system_prompt = get_trainer_prompt(profile, risks)
    else:
        turn_index = len([e for e in transcript if e["role"] == "student"])
        system_prompt = get_consul_prompt(profile, risks, difficulty, session_id, turn_index, transcript)

    messages: list[dict[str, str]] = []
    for entry in transcript:
        role = "assistant" if entry["role"] == "officer" else "user"
        messages.append({"role": role, "content": entry["content"]})

    # Consul needs low temperature for consistent phase adherence and short answers.
    # Trainer needs room for feedback + coaching tip + next question.
    temperature = 0.7 if mode == "trainer" else 0.5
    max_tokens = 350 if mode == "trainer" else 120

    client = get_ai_client()
    response = await client.chat.completions.create(
        model=get_chat_model(),
        messages=[{"role": "system", "content": system_prompt}, *messages],
        stream=True,
        max_tokens=max_tokens,
        temperature=temperature,
    )

    async for chunk in response:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            cleaned = strip_unexpected_scripts(delta)
            if cleaned:
                yield cleaned


_FEEDBACK_FALLBACK: dict[str, Any] = {
    "scores": {"confidence": 5.0, "language": 5.0, "content": 5.0, "overall": 5.0},
    "answer_analysis": [],
    "key_mistakes": [],
    "strong_points": ["Попытка пройти интервью — это уже важный шаг."],
    "phrases_to_memorize": [],
    "next_session_focus": ["Пройди ещё несколько сессий для получения детального анализа."],
    "recommendation": "Сессия слишком короткая для полного анализа. Пройди интервью до конца.",
}


def _officer_reveal_text(personality: str, overall: float) -> str:
    label = _PERSONALITY_LABELS_RU[personality]
    displayed = round(overall)
    # Derive the tier from the same rounded number we show, so the sentence never reads
    # like "7/10 — хороший результат, но есть куда расти" for a borderline 6.8.
    if displayed >= 7:
        tier = "отличный результат"
    elif displayed >= 5:
        tier = "хороший результат, но есть куда расти"
    else:
        tier = "нужно больше практики"
    return f"Тебе попался {label} офицер и ты справился на {displayed}/10 — {tier}."


async def generate_feedback(
    transcript: list[dict[str, Any]],
    mode: str,
    session_id: str | None = None,
    profile: dict[str, Any] | None = None,
    risks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    # Build a numbered transcript so the model can cite specific exchanges
    pairs: list[str] = []
    i = 0
    entries = transcript
    while i < len(entries):
        if entries[i]["role"] == "officer":
            q = entries[i]["content"]
            a = entries[i + 1]["content"] if i + 1 < len(entries) and entries[i + 1]["role"] == "student" else "(no answer)"
            pairs.append(f'[{len(pairs) + 1}] Q: "{q}"\n    A: "{a}"')
            i += 2
        else:
            i += 1

    if len(pairs) < 2:
        return _FEEDBACK_FALLBACK

    transcript_text = "\n\n".join(pairs)
    mode_label = "тренировка с фидбеком" if mode == "trainer" else "строгий режим консула"
    profile_text = _profile_text(profile) if profile else "Профиль не указан"
    risks_text = _risks_text(risks or [])

    prompt = f"""Ты эксперт по визовым интервью J-1 Work and Travel USA.
Проанализируй это конкретное интервью (режим: {mode_label}) и дай детальный разбор.

ПРОФИЛЬ ЭТОГО СТУДЕНТА: {profile_text}
ЕГО РИСК-ФАКТОРЫ (из его профиля, не общие): {risks_text}

ТРАНСКРИПТ (пронумерованные пары вопрос-ответ):
{transcript_text}

КРИТЕРИИ ОЦЕНКИ:
- Знание программы: ответы про спонсора, SEVIS, DS-2019, права из брошюры
- Ties to home country: упомянул ли учёбу / семью в КЗ / планы после программы
- Финансы: конкретные суммы и уверенный тон (не расплывчато)
- Язык: слова-паразиты (like, thing, you know), грамматика, словарный запас
- Цель поездки: культурный обмен / английский (НЕ деньги)
- Возврат: названа конкретная дата "before September 1st" или "before university starts"
- Проблемы с работодателем: обратиться к спонсору и координатору (НЕ 911 и НЕ уходить без уведомления)
- Родственники в США: должен быть ответ "No"
- Кто платит: "My parents" (даже если платит сам)

ЗАДАНИЕ: Верни ТОЛЬКО валидный JSON без markdown-блоков, ровно в этой структуре:

{{
  "scores": {{
    "confidence": <0-10, уверенность речи и поведения>,
    "language": <0-10, грамматика словарный запас беглость>,
    "content": <0-10, знание программы и правильность ответов по сути>,
    "overall": <среднее арифметическое трёх>
  }},
  "answer_analysis": [
    {{
      "question": "<точная цитата вопроса офицера>",
      "student_answer": "<точная цитата ответа студента>",
      "verdict": "good" | "warning" | "critical",
      "what_was_good": "<конкретно что правильно, или null>",
      "what_was_wrong": "<конкретная ошибка с цитатой из ответа, или null>",
      "better_answer": "<улучшенная формулировка на английском, или null>"
    }}
  ],
  "key_mistakes": [
    {{
      "mistake": "<краткое название ошибки>",
      "severity": "critical" | "warning",
      "explanation": "<почему это проблема на реальном интервью>",
      "correct_action": "<что нужно говорить/делать вместо этого>"
    }}
  ],
  "strong_points": ["<конкретная сильная сторона с ссылкой на ответ>"],
  "phrases_to_memorize": [
    {{
      "situation": "<когда использовать>",
      "wrong": "<что студент сказал или типичная ошибка>",
      "correct": "<правильная формулировка на английском>"
    }}
  ],
  "next_session_focus": ["<конкретная тема для следующей практики>"],
  "recommendation": "<итоговая рекомендация 2-3 предложения>"
}}

Правила:
- answer_analysis — разбери КАЖДУЮ пару из транскрипта
- key_mistakes — только реальные ошибки из этого интервью, не общие советы
- strong_points — только то что студент реально сделал правильно в этой сессии
- phrases_to_memorize — только фразы из реальных ошибок этой сессии
- Всё на русском, кроме английских фраз и цитат из транскрипта
- Будь конкретным — цитируй реальные слова студента, не давай общих советов
- ОБЯЗАТЕЛЬНО учитывай ПРОФИЛЬ И РИСК-ФАКТОРЫ ЭТОГО СТУДЕНТА выше: если у него есть риск
  "нет истории поездок" — оцени, дал ли он убедительный ответ про связи с родиной; если
  "финансы через родителей" — оцени уверенность и конкретику в финансовых ответах; если
  "рискованный курс" (1 или 4 курс) — оцени, объяснил ли он свои планы на учёбу; и т.д.
  Не пиши общий разбор "для всех" — recommendation и next_session_focus должны звучать так,
  будто написаны именно под его специальность и его конкретные риски, а не шаблонно"""

    def _as_score(value: Any, default: float = 5.0) -> float:
        """The model returns free-text JSON with no schema enforcement — coerce defensively
        instead of trusting scores to already be numbers."""
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    async def _attempt() -> dict[str, Any] | None:
        client = get_ai_client()
        try:
            response = await client.chat.completions.create(
                model=get_chat_model(),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=4096,
                # Forces valid JSON at the API level instead of hoping the model
                # honors the "return ONLY JSON" prompt instruction — Groq/OpenAI/
                # Gemini's OpenAI-compat endpoint all support this.
                response_format={"type": "json_object"},
            )
        except openai.APIError as e:
            # Covers APITimeoutError/APIConnectionError/etc — a long transcript
            # pushing close to the 4096-token completion can legitimately take
            # longer than the client's timeout. Falls into the same retry-then-
            # fallback path as a malformed response, instead of propagating
            # uncaught into an unhandled 500 on /simulator/end.
            logging.getLogger(__name__).warning(
                "generate_feedback: OpenAI call failed for session=%s: %s", session_id, e,
            )
            return None

        raw = ""
        try:
            # response.choices[0] raises IndexError (not caught below without
            # this try starting here) when the provider returns an empty
            # choices list — happens for content-filtered/safety-blocked
            # completions on some OpenAI-compatible backends.
            raw = (response.choices[0].message.content or "{}").strip()
            # Strip markdown code fences if the model adds them anyway
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
            if raw.endswith("```"):
                raw = raw[:-3].strip()

            data = json.loads(raw)
            s = data.get("scores", {})
            if not isinstance(s, dict):
                s = {}
            confidence = _as_score(s.get("confidence"))
            language = _as_score(s.get("language"))
            content = _as_score(s.get("content"))
            overall = (
                _as_score(s["overall"])
                if "overall" in s and s["overall"] is not None
                else round((confidence + language + content) / 3, 1)
            )
            data["scores"] = {**s, "confidence": confidence, "language": language, "content": content, "overall": overall}

            # Reveal the randomly-assigned officer personality only for the strict consul mode —
            # trainer mode has no officer roleplay to reveal.
            if mode == "consul":
                personality = get_officer_personality(session_id)
                data["officer_personality"] = personality
                data["officer_reveal"] = _officer_reveal_text(personality, overall)

            return data
        except (json.JSONDecodeError, TypeError, ValueError, KeyError, AttributeError, IndexError):
            logging.getLogger(__name__).warning(
                "generate_feedback: unparseable model output for session=%s, raw[:500]=%r",
                session_id, raw[:500],
            )
            return None

    # One retry before giving up — a truncated/malformed response is often a
    # one-off (long transcript pushing near the token limit, a rare model
    # slip), and the fallback below discards all real analysis, so it's worth
    # a second attempt rather than defaulting to it immediately.
    result = await _attempt()
    if result is None:
        result = await _attempt()
    return result if result is not None else _FEEDBACK_FALLBACK
