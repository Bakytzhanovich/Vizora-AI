"""One-time bulk generation of knowledge_base entries.

Uses the configured AI_PROVIDER (Groq, since OPENAI_API_KEY is a placeholder
in this environment) to generate Q&A pairs per category. Embeddings are left
NULL — the same state as the existing ~50 entries — because text-embedding-3-small
is OpenAI-exclusive and no working OpenAI key is configured. Retrieval already
works without embeddings (keyword search in rag_service.py). Backfill embeddings
later by re-running scraper/deduplicator.get_embedding() once a real key exists.

Run: venv/bin/python3 scripts/generate_knowledge_base.py
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.knowledge_base import KnowledgeBase
from app.services.ai_service import get_ai_client, get_chat_model
from app.services.rag_service import _STOPWORDS

OFFICIAL = "официальный источник"
AGENCY = "по данным агентств"
EXPERIENCE = "по опыту студентов (не официальная информация)"

# trust_mode:
#   "official_or_agency"   — model picks OFFICIAL or AGENCY per entry
#   "fixed_agency"         — always AGENCY, ignore model's trust_level field
#   "mixed_agency_experience" — model picks AGENCY or EXPERIENCE per entry
CATEGORIES = [
    {
        "name": "program_basics",
        "topic": (
            "Что такое программа Work and Travel USA, история программы, кто может "
            "участвовать, возрастные ограничения (18-28 лет), ограничения по курсу "
            "обучения, требования к английскому, сколько студентов участвует ежегодно, "
            "какие страны участвуют, цель культурного обмена против заблуждения "
            "что это просто 'программа подработки'"
        ),
        "count": 25,
        "trust_mode": "official_or_agency",
    },
    {
        "name": "visa_j1",
        "topic": (
            "Виза J-1 подробно: чем отличается от других виз, срок действия, "
            "многократный въезд, что такое SEVIS, роль визового спонсора, форма "
            "DS-2019 подробно, что будет если виза истечёт, разница между визовым "
            "штампом и статусом, отличия J-1 от F-1 и B1/B2"
        ),
        "count": 25,
        "trust_mode": "official_or_agency",
    },
    {
        "name": "documents",
        "topic": (
            "Документы подробно: частые ошибки в полях DS-160, детали DS-2019, "
            "процесс оплаты SEVIS fee $35, требования к паспорту (срок действия, "
            "старые паспорта), требования к фото, требования к выписке из банка, "
            "справка из университета, перевод документов с русского/казахского, "
            "сроки действия документов, что делать если документ потерян перед интервью"
        ),
        "count": 30,
        "trust_mode": "official_or_agency",
    },
    {
        "name": "visa_interview",
        "topic": (
            "Визовое интервью максимально подробно: что надеть, что взять с собой, "
            "за сколько приехать, этапы интервью, как справиться с волнением, "
            "причины отказа по 214(b) подробно, как отвечать про связи с родиной "
            "(ties to home country), что если не понял вопрос офицера, короткое "
            "интервью — это хорошо или плохо, неожиданные вопросы офицера, типичные "
            "уточняющие вопросы, язык тела и поведение, что после одобрения визы, "
            "что после отказа, можно ли подать повторно и когда, групповая запись на "
            "интервью, можно ли прийти с родителями или координатором агентства"
        ),
        "count": 40,
        "trust_mode": "fixed_agency",
    },
    {
        "name": "program_cost",
        "topic": (
            "Полная стоимость программы по типам агентств, варианты рассрочки "
            "оплаты, что возвращается при отказе в визе, скрытые расходы о которых "
            "забывают, нюансы обмена валют, как бюджетировать всю поездку а не "
            "только взнос агентству, скидки или льготы у некоторых агентств, "
            "сравнение Independent и Premium вариантов"
        ),
        "count": 15,
        "trust_mode": "fixed_agency",
    },
    {
        "name": "employment",
        "topic": (
            "Трудоустройство подробно: какие виды работ доступны, как происходит "
            "подбор работы, на что обратить внимание в job offer (red flags), как "
            "устанавливается зарплата, чаевые в сервисных профессиях, жильё от "
            "работодателя против самостоятельного поиска, что делать если "
            "работодатель плохо обращается, лимиты по рабочим часам, правила "
            "переработки, правила второй подработки подробно, что если работодатель "
            "отменил job offer до приезда"
        ),
        "count": 25,
        "trust_mode": "fixed_agency",
    },
    {
        "name": "life_in_usa",
        "topic": (
            "Жизнь в США подробно: чек-лист первой недели, как открыть банковский "
            "счёт пошагово, полный процесс получения SSN, варианты телефона/сим-карты "
            "в сравнении, варианты транспорта (во многих городах США нет культуры "
            "личных авто для студентов), покупка продуктов и стоимость жизни, "
            "медицинская страховка что покрывает а что нет, что делать если "
            "заболел, ситуации с соседями по жилью, культурная адаптация, типичные "
            "культурные шоки именно для студентов из СНГ, культура чаевых, советы "
            "по безопасности для новоприехавших"
        ),
        "count": 30,
        "trust_mode": "mixed_agency_experience",
    },
    {
        "name": "taxes",
        "topic": (
            "Налоги подробно: что такое налоговое удержание простыми словами, "
            "форма W-2, что значит статус nonresident alien для налогов, Sprintax "
            "пошагово, освобождение от FICA, различия налогов по штатам, точные "
            "сроки подачи декларации, что будет если не подать декларацию, сколько "
            "реально можно вернуть, налоговый договор между США и Казахстаном если "
            "применим"
        ),
        "count": 15,
        "trust_mode": "mixed_agency_experience",
    },
    {
        "name": "emergency",
        "topic": (
            "Экстренные ситуации подробно: что именно говорить полиции, что именно "
            "говорить спонсору программы, реалистичные сроки решения для каждого "
            "типа ситуации (потеря документов, проблемы с зарплатой, увольнение, "
            "травма), когда подключать посольство Казахстана а когда спонсора а "
            "когда местные власти, основы процесса страхового случая, какие записи "
            "и доказательства нужно сохранять"
        ),
        "count": 20,
        "trust_mode": "official_or_agency",
    },
    {
        "name": "return_and_after",
        "topic": (
            "Возвращение домой и после программы: правила grace period подробно, "
            "популярные маршруты путешествий после работы и реалистичные бюджеты, "
            "что делать с вещами/мебелью перед отъездом, закрывать ли банковский "
            "счёт или оставить открытым, пересылка вещей домой, нюансы таможни при "
            "въезде в Казахстан, как этот опыт помогает в будущих визовых заявках, "
            "можно ли поехать на Work and Travel второй раз, переход с Work and "
            "Travel на другие визы США (например F-1 для учёбы)"
        ),
        "count": 15,
        "trust_mode": "mixed_agency_experience",
    },
    {
        "name": "agencies_kazakhstan",
        "topic": (
            "Выбор агентства в Казахстане: как выбрать между разными агентствами, "
            "какие вопросы задать агентству перед подписанием договора, признаки "
            "недобросовестного агентства (red flags), агентство против "
            "самостоятельной организации (DIY) — плюсы и минусы, типичные условия "
            "договора с агентством которые нужно понимать, какие услуги агентство "
            "должно предоставлять всегда. НЕ придумывай новые названия агентств или "
            "цены — используй только общие формулировки без конкретных названий."
        ),
        "count": 10,
        "trust_mode": "fixed_agency",
    },
]


def _normalize_words(text: str) -> set[str]:
    words = text.lower().replace("?", " ").replace(",", " ").replace(".", " ").split()
    return {w for w in words if len(w) > 2 and w not in _STOPWORDS}


def _is_near_duplicate(question: str, seen_word_sets: list[set[str]], threshold: float = 0.6) -> bool:
    q_words = _normalize_words(question)
    if not q_words:
        return False
    for existing in seen_word_sets:
        if not existing:
            continue
        overlap = len(q_words & existing)
        union = len(q_words | existing)
        if union and overlap / union >= threshold:
            return True
    return False


def _build_prompt(topic: str, count: int, trust_mode: str) -> str:
    trust_instructions = {
        "official_or_agency": (
            'Для каждого вопроса добавь поле "trust_level": либо '
            f'"{OFFICIAL}" (если это проверяемый официальный факт визового '
            f'процесса/госдепартамента) либо "{AGENCY}" (если это практика агентств, '
            "не закреплённая официально)."
        ),
        "fixed_agency": "",
        "mixed_agency_experience": (
            'Для каждого вопроса добавь поле "trust_level": либо '
            f'"{AGENCY}" (если это фактический процесс/шаг) либо '
            f'"{EXPERIENCE}" (если это субъективный совет или личный опыт студентов).'
        ),
    }[trust_mode]

    return f"""Генерируй {count} вопросов-ответов на русском языке для базы знаний AI-помощника студентов Work and Travel USA из Казахстана.

Тема: {topic}

Требования:
- Реалистичные вопросы которые студенты ДЕЙСТВИТЕЛЬНО задают (разговорные формулировки, не канцелярит)
- Ответы 2-5 предложений, конкретные, без воды
- Используй реальные факты: J-1 виза, SEVIS $35, визовый сбор $185, даты программы примерно май-сентябрь, возраст 18-28 лет
- Если не уверен в точной цифре/правиле — пиши "обычно" или "как правило" вместо абсолютных утверждений
- НЕ выдумывай конкретные названия агентств или цены сверх уже известных (USCOM.KZ $2100/$2450, KCET, Columbus Work Travel — эти уже есть в базе, не повторяй их)
- Каждый вопрос должен покрывать РАЗНЫЙ аспект темы, избегай повторов между вопросами
{trust_instructions}

Верни JSON в формате: {{"qa_pairs": [{{"question": "...", "answer": "..."{', "trust_level": "..."' if trust_instructions else ''}}}]}}
"""


async def _fetch_existing_word_sets(db) -> list[set[str]]:
    rows = await db.execute(select(KnowledgeBase.question))
    return [_normalize_words(q) for (q,) in rows.all()]


async def generate_category(
    db,
    name: str,
    topic: str,
    count: int,
    trust_mode: str,
    seen_word_sets: list[set[str]],
) -> dict:
    client = get_ai_client()
    model = get_chat_model()
    prompt = _build_prompt(topic, count, trust_mode)

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=max(2500, count * 180),
        )
    except Exception as exc:
        print(f"  [{name}] API call FAILED: {exc}")
        return {"category": name, "generated": 0, "inserted": 0, "duplicates": 0, "error": str(exc)}

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        try:
            parsed = json.loads(raw[start:end + 1]) if start != -1 and end != -1 else {}
        except json.JSONDecodeError:
            print(f"  [{name}] JSON parse FAILED, raw head: {raw[:200]!r}")
            return {"category": name, "generated": 0, "inserted": 0, "duplicates": 0, "error": "json_parse_failed"}

    qa_pairs = parsed.get("qa_pairs", []) if isinstance(parsed, dict) else []
    inserted, duplicates = 0, 0

    for qa in qa_pairs:
        question = (qa.get("question") or "").strip()
        answer = (qa.get("answer") or "").strip()
        if not question or not answer:
            continue

        if _is_near_duplicate(question, seen_word_sets):
            duplicates += 1
            continue

        if trust_mode == "fixed_agency":
            trust_level = AGENCY
        else:
            candidate = qa.get("trust_level", "")
            allowed = (OFFICIAL, AGENCY) if trust_mode == "official_or_agency" else (AGENCY, EXPERIENCE)
            trust_level = candidate if candidate in allowed else allowed[1]

        db.add(KnowledgeBase(
            id=str(uuid.uuid4()),
            category=name,
            question=question,
            answer=answer,
            trust_level=trust_level,
            source_url=None,
            embedding=None,
            created_at=datetime.utcnow(),
            verified=False,
        ))
        seen_word_sets.append(_normalize_words(question))
        inserted += 1

    if inserted:
        await db.commit()

    print(f"  [{name}] generated={len(qa_pairs)} inserted={inserted} duplicates_skipped={duplicates}")
    return {"category": name, "generated": len(qa_pairs), "inserted": inserted, "duplicates": duplicates}


async def run_full_generation():
    results = []

    # Fetch dedup baseline in its own short-lived session so a later per-category
    # failure can't leave a shared session in a broken transaction state.
    async with AsyncSessionLocal() as db:
        seen_word_sets = await _fetch_existing_word_sets(db)
    print(f"Starting with {len(seen_word_sets)} existing questions for dedup baseline.\n")

    for cat in CATEGORIES:
        print(f"=== {cat['name']} (target {cat['count']}) ===")
        # Each category gets its own session — one bad commit can't poison the rest.
        async with AsyncSessionLocal() as db:
            result = await generate_category(
                db, cat["name"], cat["topic"], cat["count"], cat["trust_mode"], seen_word_sets
            )
        results.append(result)
        await asyncio.sleep(1)

    print("\n=== SUMMARY ===")
    total_inserted = sum(r["inserted"] for r in results)
    for r in results:
        status = f"error={r['error']}" if "error" in r else "ok"
        print(f"  {r['category']:25s} inserted={r['inserted']:3d}  ({status})")
    print(f"\nTotal inserted this run: {total_inserted}")
    return results


if __name__ == "__main__":
    asyncio.run(run_full_generation())
