import re
from typing import Any, AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import settings

# Llama models (used via Groq for speed/cost) occasionally leak stray tokens
# from an unrelated script into otherwise-correct ru/kz/en output — a known
# multilingual-decoding quirk, worse for lower-resource languages like
# Kazakhstan's — rather than anything this app's prompts control. Cyrillic
# and Latin are always legitimate here (ru/kz responses, English consul
# dialogue); these other scripts never are, so they're stripped defensively
# from every streamed chunk before it reaches the client.
_UNEXPECTED_SCRIPT_RE = re.compile(
    "["
    "一-鿿"  # CJK Unified Ideographs
    "぀-ヿ"  # Hiragana + Katakana
    "가-힯"  # Hangul syllables
    "฀-๿"  # Thai
    "؀-ۿ"  # Arabic
    "ऀ-ॿ"  # Devanagari
    "]+"
)


def strip_unexpected_scripts(text: str) -> str:
    return _UNEXPECTED_SCRIPT_RE.sub("", text)


# Shared across every AsyncOpenAI client below — the SDK's own default is 10
# minutes, far too long for a request/response web handler. A single source
# of truth avoids one client silently drifting back to an unbounded wait if
# a future edit only updates some of the constructors.
_OPENAI_TIMEOUT_SECONDS = 30.0


# Supported providers. All use the OpenAI SDK — only base_url and API key differ.
_PROVIDER_CONFIGS: dict[str, dict] = {
    "openai": {
        "base_url": None,
        "default_model": "gpt-4o-mini",
        "key_attr": "OPENAI_API_KEY",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "default_model": "gemini-2.0-flash",
        "key_attr": "GEMINI_API_KEY",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "key_attr": "GROQ_API_KEY",
    },
}

_client: AsyncOpenAI | None = None
_client_provider: str | None = None  # invalidate cache when provider changes


def get_ai_client() -> AsyncOpenAI:
    """Return an AsyncOpenAI-compatible client for the configured AI provider."""
    global _client, _client_provider
    provider = settings.AI_PROVIDER
    if _client is None or _client_provider != provider:
        cfg = _PROVIDER_CONFIGS.get(provider, _PROVIDER_CONFIGS["openai"])
        api_key = getattr(settings, cfg["key_attr"], "")
        if not api_key:
            raise ValueError(
                f"AI_PROVIDER is '{provider}' but {cfg['key_attr']} is not set in .env"
            )
        kwargs: dict = {"api_key": api_key, "timeout": _OPENAI_TIMEOUT_SECONDS}
        if cfg["base_url"]:
            kwargs["base_url"] = cfg["base_url"]
        _client = AsyncOpenAI(**kwargs)
        _client_provider = provider
    return _client


def get_chat_model() -> str:
    """Return the model name to use for chat completions."""
    if settings.AI_MODEL:
        return settings.AI_MODEL
    cfg = _PROVIDER_CONFIGS.get(settings.AI_PROVIDER, _PROVIDER_CONFIGS["openai"])
    return cfg["default_model"]


# Backward-compatibility alias — kept so legacy imports don't break.
def get_openai_client() -> AsyncOpenAI:
    return get_ai_client()


_audio_client: AsyncOpenAI | None = None


def get_openai_audio_client() -> AsyncOpenAI:
    """Always returns a real OpenAI client for audio APIs (Whisper STT, TTS-1).

    These are OpenAI-exclusive endpoints — Gemini and Groq don't support them,
    so this client ignores AI_PROVIDER and always uses OPENAI_API_KEY.
    """
    global _audio_client
    if _audio_client is None:
        _audio_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=_OPENAI_TIMEOUT_SECONDS)
    return _audio_client


_embed_client: AsyncOpenAI | None = None


def get_openai_embed_client() -> AsyncOpenAI:
    """Always returns a real OpenAI client for the Embeddings API.

    text-embedding-3-small is OpenAI-only; ignores AI_PROVIDER.
    Uses its own singleton separate from the audio client.
    """
    global _embed_client
    if _embed_client is None:
        _embed_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=_OPENAI_TIMEOUT_SECONDS)
    return _embed_client


_STT_PROVIDER_CONFIGS: dict[str, dict] = {
    "openai": {"base_url": None, "model": "whisper-1", "key_attr": "OPENAI_API_KEY"},
    "groq": {"base_url": "https://api.groq.com/openai/v1", "model": "whisper-large-v3-turbo", "key_attr": "GROQ_API_KEY"},
}

_stt_client: AsyncOpenAI | None = None
_stt_provider: str | None = None


def get_stt_client() -> tuple[AsyncOpenAI, str]:
    """Return (client, model) for speech-to-text.

    Uses Groq's OpenAI-compatible Whisper endpoint when AI_PROVIDER=groq
    (no separate OpenAI key required). Any other provider falls back to a
    dedicated OpenAI client, since Whisper is otherwise OpenAI-exclusive.
    """
    global _stt_client, _stt_provider
    provider = "groq" if settings.AI_PROVIDER == "groq" else "openai"
    if _stt_client is None or _stt_provider != provider:
        cfg = _STT_PROVIDER_CONFIGS[provider]
        api_key = getattr(settings, cfg["key_attr"], "")
        if not api_key:
            raise ValueError(
                f"STT provider is '{provider}' but {cfg['key_attr']} is not set in .env"
            )
        kwargs: dict = {"api_key": api_key, "timeout": _OPENAI_TIMEOUT_SECONDS}
        if cfg["base_url"]:
            kwargs["base_url"] = cfg["base_url"]
        _stt_client = AsyncOpenAI(**kwargs)
        _stt_provider = provider
    return _stt_client, _STT_PROVIDER_CONFIGS[provider]["model"]


async def generate_chat_response(
    user_message: str,
    student_profile: dict[str, Any],
    knowledge_context: list[dict[str, Any]],
    chat_history: list[dict[str, str]],
    language: str = "ru",
) -> AsyncGenerator[str, None]:
    english_map = {"weak": "слабый", "medium": "средний", "good": "хороший"}
    finance_map = {"self": "сам", "parents": "родители", "scholarship": "стипендия"}

    # Build context with trust level labels so the AI cites sources correctly
    context_parts = []
    for item in knowledge_context:
        trust = item.get("trust_level", "официальный источник")
        context_parts.append(f"[{trust}]\nВ: {item['question']}\nО: {item['answer']}")
    context_text = "\n\n".join(context_parts)

    if language == "kz":
        language_instruction = "Тек қазақ тілінде жауап бер. Жауаптарың толығымен қазақ тілінде болсын."
        citation_rules = """ДЕРЕККӨЗДЕРГЕ СІЛТЕМЕ ЖАСАУ ЕРЕЖЕЛЕРІ (мағынасы дәл сөзінен маңызды — бір фразаны әр жолы қайталама):
- Ақпарат [официальный источник] деп белгіленсе — бұл ресми дерек екенін түсіндір (әр жолы басқаша: "Ресми деректер бойынша...", "Ресми ақпаратқа сәйкес...", "Бұл жағынан ресми түрде...")
- [по данным агентств] болса — бұл агенттіктерден екенін түсіндір (әртүрлі нұсқада)
- [по опыту студентов] болса — МІНДЕТТІ ТҮРДЕ бұл жеке тәжірибе, ресми факт емес екенін түсіндір (әр жолы басқаша сөйле: "Кейбір студенттер айтқандай...", "Осындай тәжірибе кездескен...")
- Студенттердің тәжірибесін ешқашан ресми факт ретінде бермеу"""
    else:
        language_instruction = "Отвечай ТОЛЬКО на русском языке."
        citation_rules = """ПРАВИЛА ЦИТИРОВАНИЯ ИСТОЧНИКОВ (смысл важнее точной формулировки — не повторяй одну и ту же фразу в каждом ответе):
- Если информация помечена [официальный источник] — дай понять, что это официальные данные (меняй формулировку: "По официальным данным...", "Официально это выглядит так...", "Согласно официальным источникам...")
- Если [по данным агентств] — дай понять, что это от агентств, разными словами каждый раз
- Если [по опыту студентов] — ОБЯЗАТЕЛЬНО дай понять, что это неофициальный личный опыт, а не факт — но каждый раз своими словами ("Некоторые студенты рассказывали...", "По опыту части ребят...", "Встречались случаи, когда...")
- Никогда не выдавай опыт студентов за официальный факт"""

    system_prompt = f"""Ты — Vizora AI, персональный помощник по программе Work & Travel USA. Ты как знающий старший друг, который сам через это прошёл и уже помог сотням студентов — а не справочная система, зачитывающая инструкцию.

{language_instruction}

СТИЛЬ ОБЩЕНИЯ (важно — не звучать как робот):
- Пиши живо, по-человечески, будто объясняешь другу — а не зачитываешь регламент.
- Не начинай разные ответы одной и той же конструкцией — меняй формулировки, порядок мыслей, длину фраз от сообщения к сообщению.
- Если ссылаешься на источник — вплетай это в предложение естественно, а не всегда одинаковым штампом в начале.
- Отвечай по существу: 2-4 предложения на простой вопрос, до 6-8 если тема правда сложная — не обрывай мысль ради краткости в ущерб пониманию.
- Если не знаешь ответа — скажи прямо и по-человечески, предложи обратиться в агентство, без сухих канцелярских оговорок.
Никогда не давай юридических гарантий по поводу получения визы.
Не используй markdown разметку — пиши обычным текстом.

{citation_rules}

ПРОФИЛЬ СТУДЕНТА:
- Имя: {student_profile.get('name', '')}
- Страна: {student_profile.get('country', 'KZ')}
- Курс: {student_profile.get('course_year', '?')} курс
- Профессия/специальность: {student_profile.get('profession', '?')}
- Английский: {english_map.get(student_profile.get('english_level', ''), student_profile.get('english_level', '?'))}
- История поездок: {'есть' if student_profile.get('travel_history') else 'нет'}
- Финансирование: {finance_map.get(student_profile.get('financial_source', ''), student_profile.get('financial_source', '?'))}
- Дата интервью: {student_profile.get('interview_date') or 'не указана'}

БАЗА ЗНАНИЙ (используй эту информацию при ответе):
{context_text if context_text else 'Контекст не найден — отвечай на основе общих знаний о W&T.'}

Если вопрос про интервью — учитывай профиль студента и его специфические риски."""

    messages: list[dict[str, str]] = []
    for msg in chat_history[-5:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    client = get_ai_client()
    response = await client.chat.completions.create(
        model=get_chat_model(),
        messages=[{"role": "system", "content": system_prompt}, *messages],
        stream=True,
        max_tokens=500,
        temperature=0.7,
    )

    async for chunk in response:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            cleaned = strip_unexpected_scripts(delta)
            if cleaned:
                yield cleaned
