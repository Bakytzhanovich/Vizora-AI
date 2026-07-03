"""After-visa module content and progress helpers."""
from typing import Any

AFTER_VISA_MODULES: list[dict[str, Any]] = [
    {
        "id": "trip_prep",
        "icon": "🎒",
        "title": "Подготовка к поездке",
        "description": "Что взять с собой и как подготовиться",
        "unlock_condition": "visa_received",
        "sections": [
            {
                "id": "trip_prep_items",
                "title": "Что взять с собой",
                "content": (
                    "Обязательно: паспорт с визой, DS-2019, копии всех документов (отдельно от "
                    "оригиналов), деньги наличными ($300–500), банковская карта, лекарства с "
                    "рецептом на английском, адаптер для розеток (Type A/B), тёплая одежда если "
                    "едешь на север."
                ),
            },
            {
                "id": "trip_prep_money",
                "title": "Сколько денег брать",
                "content": (
                    "Минимум $500–1000 наличными на первые 2–3 недели до первой зарплаты. "
                    "Плюс депозит за жильё если не предоставляет работодатель ($200–500). "
                    "Карта с международными переводами как запасной вариант."
                ),
            },
            {
                "id": "trip_prep_sim",
                "title": "SIM-карта в США",
                "content": (
                    "Купи eSIM заранее (Airalo, Holafly) для первых дней, или купи local SIM "
                    "по прилёту в любом Walmart/Target — T-Mobile, AT&T, Mint Mobile от "
                    "$15–30/месяц."
                ),
            },
            {
                "id": "trip_prep_timing",
                "title": "За сколько дней лететь",
                "content": (
                    "Прилетай за 1–3 дня до начала работы. Это даёт время на адаптацию, "
                    "поиск жилья, получение SIM-карты, ориентацию на месте."
                ),
            },
        ],
    },
    {
        "id": "arrival",
        "icon": "✈️",
        "title": "Первые дни в США",
        "description": "Аэропорт, ориентация, первые шаги",
        "unlock_condition": "visa_received",
        "sections": [
            {
                "id": "arrival_passport",
                "title": "Паспортный контроль",
                "content": (
                    "На вопрос офицера скажи: 'I'm here on Work and Travel J-1 program'. "
                    "Покажи DS-2019 и паспорт с визой. Обычно занимает 5–10 минут. "
                    "Не нервничай — у тебя уже есть виза, это формальность."
                ),
            },
            {
                "id": "arrival_i94",
                "title": "Получение I-94",
                "content": (
                    "После паспортного контроля автоматически генерируется электронная "
                    "I-94 запись. Проверь и распечатай на i94.cbp.dhs.gov после прилёта — "
                    "она может понадобиться для SSN."
                ),
            },
            {
                "id": "arrival_night",
                "title": "Первая ночь",
                "content": (
                    "Забронируй хостел/Airbnb заранее на первую ночь если работодатель "
                    "не встречает. Используй Hostelworld, Booking.com. Бюджет $30–60/ночь."
                ),
            },
            {
                "id": "arrival_employer",
                "title": "Связь с работодателем",
                "content": (
                    "Напиши работодателю о прилёте сразу. Уточни адрес и как добраться "
                    "(Uber/Lyft, автобус). Подтверди дату начала работы."
                ),
            },
        ],
    },
    {
        "id": "ssn",
        "icon": "🆔",
        "title": "Получение SSN",
        "description": "Social Security Number пошагово",
        "unlock_condition": "visa_received",
        "sections": [
            {
                "id": "ssn_what",
                "title": "Что такое SSN",
                "content": (
                    "Social Security Number — обязательный номер для легальной работы и "
                    "получения зарплаты в США. Без него работодатель не сможет тебе "
                    "платить официально."
                ),
            },
            {
                "id": "ssn_when",
                "title": "Когда подавать",
                "content": (
                    "Подавай через 10 дней после прилёта (раньше система может не видеть "
                    "твою запись о въезде). Не затягивай — обработка занимает 2–4 недели."
                ),
            },
            {
                "id": "ssn_docs",
                "title": "Какие документы нужны",
                "content": (
                    "Паспорт с визой J-1, DS-2019, форма SS-5 (заполняется на месте или "
                    "заранее на ssa.gov), доказательство трудоустройства (письмо от "
                    "работодателя)."
                ),
            },
            {
                "id": "ssn_where",
                "title": "Куда идти",
                "content": (
                    "Найди ближайший офис Social Security Administration на ssa.gov/locator. "
                    "Приходи рано утром — обычно очереди. Возьми с собой все документы "
                    "в оригинале."
                ),
            },
            {
                "id": "ssn_after",
                "title": "После подачи",
                "content": (
                    "Карточка SSN придёт по почте через 2–4 недели на адрес который указал. "
                    "Можешь начинать работать сразу после подачи заявления — не обязательно "
                    "ждать карточку."
                ),
            },
        ],
    },
    {
        "id": "banking",
        "icon": "🏦",
        "title": "Банк и финансы",
        "description": "Открытие счёта и управление деньгами",
        "unlock_condition": "visa_received",
        "sections": [
            {
                "id": "banking_open",
                "title": "Открытие счёта",
                "content": (
                    "Лучшие банки для J-1: Chase, Bank of America, Wells Fargo — есть везде, "
                    "простое открытие. Нужен паспорт, виза, иногда SSN (можно открыть и без "
                    "него в некоторых банках)."
                ),
            },
            {
                "id": "banking_type",
                "title": "Какой счёт выбрать",
                "content": (
                    "Checking account (расчётный) для повседневных трат и получения зарплаты. "
                    "Многие банки предлагают бесплатное обслуживание для студентов — спроси "
                    "про 'student checking account'."
                ),
            },
            {
                "id": "banking_transfer",
                "title": "Перевод денег домой",
                "content": (
                    "Wise (бывший TransferWise) — лучший курс для переводов в Казахстан. "
                    "Western Union — быстро но дороже. Избегай прямых банковских переводов "
                    "— высокие комиссии."
                ),
            },
            {
                "id": "banking_savings",
                "title": "Накопление",
                "content": (
                    "Заведи привычку откладывать 20–30% с каждой зарплаты. К концу программы "
                    "(3–4 месяца) реально накопить $2000–4000 при средней зарплате."
                ),
            },
        ],
    },
    {
        "id": "second_job",
        "icon": "💼",
        "title": "Вторая работа",
        "description": "Правила и как найти",
        "unlock_condition": "visa_received",
        "sections": [
            {
                "id": "second_job_allowed",
                "title": "Можно ли работать на второй работе",
                "content": (
                    "Да, но с условиями. J-1 разрешает 'concurrent employment' — вторую "
                    "работу, если она одобрена твоим спонсором. Никогда не начинай вторую "
                    "работу без согласования."
                ),
            },
            {
                "id": "second_job_limits",
                "title": "Ограничения",
                "content": (
                    "Суммарно не более 20 часов в неделю на дополнительной работе (помимо "
                    "основной). Вторая работа должна быть похожего типа (туризм, сервис) "
                    "— не любая работа подойдёт."
                ),
            },
            {
                "id": "second_job_permission",
                "title": "Как получить разрешение",
                "content": (
                    "Напиши спонсору с описанием второй работы: где, кем, сколько часов. "
                    "Спонсор должен одобрить ПЕРЕД тем как ты начнёшь работать там."
                ),
            },
            {
                "id": "second_job_find",
                "title": "Где искать",
                "content": (
                    "Facebook группы 'Work and Travel [город]', спроси коллег на основной "
                    "работе, местные доски объявлений (Indeed, для быстрых подработок)."
                ),
            },
        ],
    },
    {
        "id": "taxes",
        "icon": "📊",
        "title": "Налоги и Tax Return",
        "description": "Как вернуть уплаченные налоги",
        "unlock_condition": "visa_received",
        "sections": [
            {
                "id": "taxes_what",
                "title": "Какие налоги удерживают",
                "content": (
                    "Federal tax (федеральный), State tax (штата, не везде), иногда Social "
                    "Security и Medicare tax (J-1 студенты обычно освобождены — проверь "
                    "свой pay stub)."
                ),
            },
            {
                "id": "taxes_why",
                "title": "Почему можно вернуть",
                "content": (
                    "J-1 участники имеют статус 'nonresident alien' первые 2–5 лет — это "
                    "даёт льготы по налогам. Большинство студентов могут вернуть "
                    "значительную часть уплаченных налогов."
                ),
            },
            {
                "id": "taxes_when",
                "title": "Когда подавать",
                "content": (
                    "Tax return подаётся после 1 января следующего года за предыдущий "
                    "налоговый год. Дедлайн обычно 15 апреля. Можно подать удалённо из дома."
                ),
            },
            {
                "id": "taxes_how",
                "title": "Как подать",
                "content": (
                    "Sprintax.com — специализированный сервис для J-1/F-1 студентов, "
                    "рассчитан именно на твой статус (не используй обычный TurboTax). "
                    "Стоимость подачи $40–60."
                ),
            },
            {
                "id": "taxes_docs",
                "title": "Что нужно сохранить",
                "content": (
                    "Все pay stubs за весь период работы, форму W-2 от работодателя (придёт "
                    "по почте или email в январе), SSN, копию паспорта и DS-2019."
                ),
            },
        ],
    },
    {
        "id": "return_home",
        "icon": "🏠",
        "title": "Возвращение домой",
        "description": "Завершение программы правильно",
        "unlock_condition": "visa_received",
        "sections": [
            {
                "id": "return_grace",
                "title": "Grace Period",
                "content": (
                    "После окончания работы у тебя есть 30 дней Grace Period — можно "
                    "путешествовать по США, но НЕЛЬЗЯ работать. Используй это время "
                    "для путешествий!"
                ),
            },
            {
                "id": "return_travel",
                "title": "Куда поехать",
                "content": (
                    "Популярные маршруты: Нью-Йорк, Лас-Вегас + Гранд-Каньон, Калифорния "
                    "(LA, San Francisco), Майами. Бюджетные автобусы: Flixbus, Megabus."
                ),
            },
            {
                "id": "return_before",
                "title": "Перед вылетом домой",
                "content": (
                    "Сохрани все документы (DS-2019, pay stubs, чеки) — понадобятся для "
                    "tax return. Закрой банковский счёт или оставь минимум для будущих переводов."
                ),
            },
            {
                "id": "return_after",
                "title": "После возвращения",
                "content": (
                    "Подай tax return через Sprintax в начале следующего года. "
                    "Поделись опытом — это поможет следующим студентам и тебе как "
                    "кейс для будущих виз!"
                ),
            },
        ],
    },
]


def get_module(module_id: str) -> dict[str, Any] | None:
    return next((m for m in AFTER_VISA_MODULES if m["id"] == module_id), None)


def get_modules_summary() -> list[dict[str, Any]]:
    return [
        {
            "id": m["id"],
            "icon": m["icon"],
            "title": m["title"],
            "description": m["description"],
            "section_count": len(m["sections"]),
        }
        for m in AFTER_VISA_MODULES
    ]


def compute_module_progress(
    completed_ids: set[str], module_id: str
) -> dict[str, Any]:
    module = get_module(module_id)
    if not module:
        return {"completed": 0, "total": 0, "pct": 0}
    total = len(module["sections"])
    completed = sum(
        1 for s in module["sections"] if f"{module_id}:{s['id']}" in completed_ids
    )
    return {
        "completed": completed,
        "total": total,
        "pct": round(completed / total * 100) if total else 0,
    }
