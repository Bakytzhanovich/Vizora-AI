"""LLM-based extraction of Q&A pairs from raw scraped text."""

import json
import logging

from app.services.ai_service import get_ai_client, get_chat_model

logger = logging.getLogger(__name__)


_TRUST_LABEL = {
    1: "официальный источник",
    2: "по данным агентств",
    3: "по опыту студентов (не официальная информация)",
}

_TIER_INSTRUCTION = {
    1: "Информация из официального источника — представляй как факт.",
    2: "Информация от агентств — представляй как 'по данным агентств'.",
    3: (
        "Информация из форумов/блогов — ОБЯЗАТЕЛЬНО используй формулировки "
        "'по опыту некоторых студентов', 'по отзывам участников', НИКОГДА как факт."
    ),
}

_VALID_CATEGORIES = {
    "visa_j1", "documents", "visa_interview", "taxes", "life_usa",
    "program", "program_basics", "ssn", "emergency", "after_visa",
}


async def extract_qa_pairs(scraped_content: dict, tier: int) -> list[dict]:
    """Send scraped text to GPT-4o-mini, return structured Q&A pairs.

    Each item: {category, question, answer, trust_level, source_url}.
    Returns [] on any LLM or parsing error.
    """
    if not scraped_content or not scraped_content.get("raw_text", "").strip():
        return []

    trust_label = _TRUST_LABEL[tier]
    tier_instruction = _TIER_INSTRUCTION[tier]
    source_url = scraped_content["url"]

    system_prompt = f"""Ты обрабатываешь сырой текст с веб-страницы про визу J-1 и программу Work and Travel USA.

Извлеки из текста полезную информацию в формате вопрос-ответ на РУССКОМ языке,
релевантную для казахстанских студентов, готовящихся к программе W&T USA.

Правила:
- Только конкретные факты: цифры, сроки, требования, процедуры, реальные советы
- Не выдумывай информацию которой НЕТ в тексте
- Если текст не на русском — переведи естественно на русский
- Каждый ответ 2-4 предложения, конкретно и без воды
- Уровень доверия источника: {trust_label}
- {tier_instruction}
- Категории: visa_j1 | documents | visa_interview | taxes | life_usa | program | program_basics | ssn | emergency | after_visa
- Если в тексте нет полезной информации для W&T студентов — верни []

Верни ТОЛЬКО JSON массив (без markdown-обёртки):
[
  {{
    "category": "visa_j1",
    "question": "вопрос на русском",
    "answer": "ответ на русском",
    "trust_level": "{trust_label}",
    "source_url": "{source_url}"
  }}
]"""

    # Truncate to avoid context overflow; 15k chars ~= ~4k tokens
    text_chunk = scraped_content["raw_text"][:15_000]

    try:
        client = get_ai_client()
        response = await client.chat.completions.create(
            model=get_chat_model(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_chunk},
            ],
            temperature=0.2,
            max_tokens=2000,
        )
        raw = response.choices[0].message.content or "[]"

        # Strip markdown fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.lower().startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            # Handle {"items": [...]} wrapper
            if isinstance(parsed, dict):
                parsed = next(
                    (v for v in parsed.values() if isinstance(v, list)), []
                )
            else:
                return []

        results = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            question = item.get("question", "").strip()
            answer = item.get("answer", "").strip()
            category = item.get("category", "program").strip()
            if not question or not answer or len(question) < 10:
                continue
            if category not in _VALID_CATEGORIES:
                category = "program"
            results.append({
                "category": category,
                "question": question,
                "answer": answer,
                "trust_level": trust_label,
                "source_url": source_url,
            })

        logger.info(f"Extracted {len(results)} Q&A pairs from {source_url}")
        return results

    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error for {source_url}: {e}")
        return []
    except Exception as e:
        logger.error(f"LLM extraction failed for {source_url}: {e}")
        return []
