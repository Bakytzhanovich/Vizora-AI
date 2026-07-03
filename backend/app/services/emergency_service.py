"""Emergency scenario definitions and action plan generation."""
from typing import Any

SCENARIOS: dict[str, dict[str, Any]] = {
    "fired": {
        "id": "fired",
        "title": "Меня уволили",
        "icon": "🚫",
        "description": "Работодатель уволил или резко сократил рабочие часы",
        "urgency": "high",
        "steps": [
            {
                "id": "fired_reason",
                "question": "Почему тебя уволили или сократили часы?",
                "options": [
                    "Конфликт с работодателем",
                    "Работодатель закрылся или сезон кончился",
                    "Нарушил правила на работе",
                    "Не знаю — просто сказали уходить",
                ],
            },
            {
                "id": "fired_new_job",
                "question": "Есть ли у тебя сейчас другая работа или предложение?",
                "options": [
                    "Нет, ищу новую работу",
                    "Есть другой работодатель, готов принять меня",
                    "Работаю через агентство — они помогают",
                ],
            },
            {
                "id": "fired_visa_time",
                "question": "Сколько времени осталось на твоей J-1 визе?",
                "options": [
                    "Больше 30 дней",
                    "10–30 дней",
                    "Меньше 10 дней",
                ],
            },
        ],
        "base_action_plan": [
            "📞 Немедленно позвони спонсору (CIEE/InterExchange/STS/etc) — расскажи ситуацию, они ОБЯЗАНЫ помочь",
            "📝 Запроси у работодателя письменное объяснение причины увольнения",
            "💼 Начни поиск нового работодателя через спонсора или сайты типа CoolWorks, SeasonWorkers",
            "⏰ J-1 виза даёт только 30 дней grace period после увольнения — действуй быстро",
            "📌 Не начинай работу у нового работодателя без одобрения спонсора — это нарушение визы",
            "🛡️ Если работодатель не выплатил зарплату — это незаконно, обратись к спонсору за помощью",
        ],
    },
    "lost_documents": {
        "id": "lost_documents",
        "title": "Потерял документы",
        "icon": "📄",
        "description": "Паспорт, DS-2019 или другие важные документы утеряны",
        "urgency": "high",
        "steps": [
            {
                "id": "docs_what",
                "question": "Какие документы потеряны?",
                "options": [
                    "Паспорт",
                    "DS-2019 (Exchange Visitor Form)",
                    "Паспорт И DS-2019",
                    "Другие документы (водительские права, карточки)",
                ],
            },
            {
                "id": "docs_how",
                "question": "Как документы были потеряны?",
                "options": [
                    "Сам потерял — не помню где",
                    "Украдены",
                    "Остались у работодателя или хозяина жилья",
                ],
            },
        ],
        "base_action_plan": [
            "📞 Первый звонок — спонсору: они дадут точные инструкции по твоей ситуации",
            "🏛️ Посети Консульство/Посольство своей страны для восстановления паспорта (найди ближайшее)",
            "📋 Для нового DS-2019 — обратись к спонсору, они выпустят замену",
            "👮 Если украдено — обратись в полицию за Police Report (нужен для всех дальнейших шагов)",
            "🔒 Сообщи банку об утере карт, заблокируй их и закажи новые",
            "📸 Сохрани фото/скан всех документов в облаке (Google Drive/iCloud) на будущее",
            "🏠 Если документы у работодателя — удержание паспорта незаконно в США, скажи спонсору",
        ],
    },
    "accident": {
        "id": "accident",
        "title": "Несчастный случай / болезнь",
        "icon": "🚑",
        "description": "Получил травму, попал в ДТП или серьёзно заболел",
        "urgency": "critical",
        "steps": [
            {
                "id": "accident_severity",
                "question": "Насколько серьёзна ситуация прямо сейчас?",
                "options": [
                    "Нужна экстренная помощь прямо сейчас",
                    "Травма/болезнь есть, но стабильно — могу читать",
                    "Уже получил помощь, разбираюсь с последствиями",
                ],
            },
            {
                "id": "accident_insurance",
                "question": "Есть ли у тебя медицинская страховка (входит в J-1 программу)?",
                "options": [
                    "Да, страховка есть",
                    "Не знаю — не проверял",
                    "Нет страховки",
                ],
            },
        ],
        "base_action_plan": [
            "🆘 Если экстренная ситуация — звони 911 НЕМЕДЛЕННО",
            "📞 После стабилизации позвони спонсору — они помогут с навигацией страховки и больниц",
            "🏥 При обращении в больницу скажи, что у тебя J-1 виза и страховка от программы",
            "📋 Сохраняй ВСЕ медицинские документы, счета и рецепты для страховой",
            "📝 Подай страховой клейм как можно быстрее (обычно через CISI или аналог)",
            "💼 Уведоми работодателя о своём состоянии и предполагаемых сроках возвращения",
        ],
    },
    "not_paid": {
        "id": "not_paid",
        "title": "Не платят зарплату",
        "icon": "💸",
        "description": "Работодатель задержал или не выплачивает зарплату",
        "urgency": "high",
        "steps": [
            {
                "id": "pay_delay",
                "question": "Сколько времени не платят?",
                "options": [
                    "Первая задержка — 1–7 дней",
                    "Больше 2 недель без оплаты",
                    "Работодатель отказывается платить",
                ],
            },
            {
                "id": "pay_tried",
                "question": "Ты уже говорил с работодателем об оплате?",
                "options": [
                    "Да, обещает заплатить",
                    "Да, отказывается или игнорирует",
                    "Нет, боюсь конфликта",
                ],
            },
        ],
        "base_action_plan": [
            "📞 Немедленно свяжись со спонсором — это их прямая обязанность помочь тебе",
            "📝 Сохрани все доказательства: расписания, сообщения, договор, pay stubs — всё",
            "🏛️ Подай жалобу в Department of Labor (DOL): dol.gov/agencies/whd — это бесплатно и анонимно",
            "⚖️ Работодатель ОБЯЗАН платить минимум Federal/State minimum wage — это закон США",
            "🚫 Не уходи с работы без оплаты или совета спонсора — это усложнит взыскание",
            "📋 Жалоба в DOL защищает тебя от увольнения (anti-retaliation protection по закону)",
        ],
    },
    "rights_violation": {
        "id": "rights_violation",
        "title": "Нарушение моих трудовых прав",
        "icon": "⚖️",
        "description": "Дискриминация, домогательства, небезопасные условия труда",
        "urgency": "high",
        "steps": [
            {
                "id": "rights_what",
                "question": "Что именно происходит?",
                "options": [
                    "Не платят минимальную зарплату",
                    "Дискриминация или домогательства",
                    "Небезопасные условия труда",
                    "Угрозы или принуждение",
                ],
            },
        ],
        "base_action_plan": [
            "📞 Горячая линия против торговли людьми: 1-888-373-7888 — звонок в США, 200+ языков, можно анонимно",
            "📱 SMS 'HELP' на номер 233733 (на территории США)",
            "⚖️ ЭТО ОФИЦИАЛЬНОЕ ПРАВО от Госдепартамента США — работодатель не может угрожать вам за обращение за помощью",
            "🚫 Работодатель НЕ имеет права забирать ваш паспорт — это незаконно",
            "📝 Запишите все детали: даты, что произошло, имена свидетелей",
            "🚪 У вас есть право уйти с неблагоприятного рабочего места",
            "🆘 Если угрожают — звоните 911",
            "⚖️ Обратитесь к НЕЗАВИСИМОМУ юристу, не к юристу от работодателя",
            "🌐 Жалоба на дискриминацию: www.eeoc.gov (бесплатно)",
        ],
    },
    "visa_status": {
        "id": "visa_status",
        "title": "Проблема с визой/статусом",
        "icon": "🛂",
        "description": "Вопросы по J-1 статусу, SEVIS или пограничный контроль",
        "urgency": "high",
        "steps": [
            {
                "id": "visa_issue_type",
                "question": "Какая именно проблема с визой или статусом?",
                "options": [
                    "Проблема с SEVIS (terminated / suspended)",
                    "Задержали на границе или в аэропорту",
                    "Хочу продлить или изменить даты программы",
                    "Другой вопрос по J-1 статусу",
                ],
            },
        ],
        "base_action_plan": [
            "📞 ПЕРВЫЙ ШАГ — позвони спонсору прямо сейчас: только они могут исправить SEVIS-записи",
            "🚫 Не пытайся въехать/выехать из США с проблемным SEVIS — это может привести к депортации",
            "📋 Собери все документы: DS-2019, паспорт, I-94, Job Offer Letter, доказательства работы",
            "🏛️ При задержании на границе — вежливо объясни цель визита, попроси связаться со спонсором",
            "⏰ Для продления программы — обратись к спонсору минимум за 2 недели до даты окончания",
            "📌 J-1 даёт 30-дневный grace period после окончания программы — не оставайся дольше",
        ],
    },
}


def get_scenarios() -> list[dict[str, Any]]:
    return [
        {
            "id": s["id"],
            "title": s["title"],
            "icon": s["icon"],
            "description": s["description"],
            "urgency": s["urgency"],
            "total_steps": len(s["steps"]),
        }
        for s in SCENARIOS.values()
    ]


def get_scenario(scenario_id: str) -> dict[str, Any] | None:
    return SCENARIOS.get(scenario_id)


def get_step(scenario_id: str, step_index: int) -> dict[str, Any] | None:
    scenario = get_scenario(scenario_id)
    if not scenario:
        return None
    steps = scenario["steps"]
    if step_index < 0 or step_index >= len(steps):
        return None
    return steps[step_index]


def compute_urgency(scenario_id: str, answers: list[str]) -> str:
    joined = " ".join(answers).lower()
    if scenario_id == "accident":
        return "critical"
    if scenario_id == "not_paid" and ("больше 2 недель" in joined or "отказывается" in joined):
        return "high"
    if scenario_id == "lost_documents" and "украдены" in joined:
        return "high"
    if scenario_id == "visa_status" and ("sevis" in joined or "задержали" in joined):
        return "high"
    if scenario_id == "rights_violation" and ("угрозы" in joined or "принуждение" in joined):
        return "critical"
    if scenario_id in ("fired", "lost_documents", "not_paid", "visa_status", "rights_violation"):
        return "high"
    return "medium"


def personalize_plan(scenario_id: str, answers: list[str], base_plan: list[str]) -> list[str]:
    plan = list(base_plan)
    joined = " ".join(answers).lower()

    if scenario_id == "accident" and "экстренная" in joined:
        plan = ["🆘 ПОЗВОНИ 911 ПРЯМО СЕЙЧАС — не трать время на чтение!"] + plan

    if scenario_id == "accident" and "нет страховки" in joined:
        plan.append("⚠️ Страховка — обязательное условие J-1. Уточни у спонсора — страховка может быть.")

    if scenario_id == "lost_documents" and "украдены" in joined:
        plan = [
            "👮 СРОЧНО: Позвони в полицию — получи Police Report для всех дальнейших шагов"
        ] + plan

    if scenario_id == "lost_documents" and "остались у работодателя" in joined:
        plan.append("⚖️ Удержание паспорта работодателем незаконно в США. Сообщи спонсору немедленно.")

    if scenario_id == "fired" and "меньше 10 дней" in joined:
        plan = [
            "⚠️ СРОЧНО: Меньше 10 дней на визе! Свяжись со спонсором для extension или отъезда"
        ] + plan

    if scenario_id == "not_paid" and "отказывается" in joined:
        plan.append(
            "📋 Обратись в State Labor Board твоего штата — дополнительная защита на уровне штата"
        )

    if scenario_id == "rights_violation" and ("угрозы" in joined or "принуждение" in joined):
        plan = ["🆘 ЕСЛИ УГРОЖАЮТ ПРЯМО СЕЙЧАС — ЗВОНИ 911 НЕМЕДЛЕННО!"] + plan

    return plan


def generate_action_plan(scenario_id: str, answers: list[str]) -> dict[str, Any]:
    scenario = get_scenario(scenario_id)
    if not scenario:
        return {"steps": [], "urgency": "medium", "contacts": [], "disclaimer": ""}

    base_plan = list(scenario["base_action_plan"])
    urgency = compute_urgency(scenario_id, answers)
    steps = personalize_plan(scenario_id, answers, base_plan)

    contacts: list[dict[str, str]] = [
        {
            "name": "Спонсор программы",
            "description": "CIEE, InterExchange, STS, Cultural Care и др.",
            "note": "Номер спонсора есть в твоих документах DS-2019",
            "priority": "first",
        },
        {
            "name": "Экстренная служба США",
            "phone": "911",
            "description": "Полиция, скорая помощь, пожарные",
            "priority": "emergency",
        },
        {
            "name": "Консульство твоей страны",
            "description": "Помощь гражданам за рубежом",
            "note": "Найди ближайшее консульство на сайте МИД",
            "priority": "secondary",
        },
    ]

    if scenario_id == "not_paid":
        contacts.append(
            {
                "name": "Dept. of Labor (DOL)",
                "phone": "1-866-487-9243",
                "description": "Жалобы на невыплату зарплаты — бесплатно, анонимно",
                "priority": "secondary",
            }
        )

    if scenario_id == "rights_violation":
        contacts.extend([
            {
                "name": "Горячая линия против торговли людьми",
                "phone": "1-888-373-7888",
                "description": "Анонимно, 200+ языков, США. SMS: 'HELP' → 233733",
                "priority": "first",
            },
            {
                "name": "EEOC (Комиссия по равным возможностям)",
                "description": "Жалоба на дискриминацию: www.eeoc.gov",
                "priority": "secondary",
            },
        ])

    disclaimer = (
        "⚠️ Этот план — первичная помощь. Ситуации индивидуальны. "
        "Всегда консультируйся со спонсором программы — они несут юридическую ответственность за тебя."
    )

    return {
        "steps": steps,
        "urgency": urgency,
        "contacts": contacts,
        "disclaimer": disclaimer,
    }
