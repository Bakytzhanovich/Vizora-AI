from typing import Any


def generate_checklist(profile: dict) -> list[dict[str, Any]]:
    base_docs: list[dict[str, Any]] = [
        {
            "id": "passport",
            "name": "Загранпаспорт",
            "description": "Действующий минимум 6 месяцев после окончания программы",
            "required": True,
            "category": "identity",
            "tips": "Проверь срок действия. Возьми все старые паспорта тоже.",
            "risk_note": None,
        },
        {
            "id": "ds2019",
            "name": "DS-2019",
            "description": "Сертификат от американского спонсора J-1 программы",
            "required": True,
            "category": "program",
            "tips": "Выдаётся агентством или спонсором. Без него нельзя записаться на интервью.",
            "risk_note": None,
        },
        {
            "id": "ds160_confirmation",
            "name": "Подтверждение DS-160",
            "description": "Распечатанная страница с баркодом после заполнения анкеты",
            "required": True,
            "category": "visa",
            "tips": "Заполнить на ceac.state.gov. Сохрани Application ID.",
            "risk_note": None,
        },
        {
            "id": "sevis_receipt",
            "name": "Квитанция SEVIS I-901",
            "description": "Подтверждение оплаты сбора SEVIS ($35)",
            "required": True,
            "category": "fees",
            "tips": "Оплатить на fmjfee.com. Распечатай квитанцию.",
            "risk_note": None,
        },
        {
            "id": "visa_fee_receipt",
            "name": "Квитанция визового сбора MRV",
            "description": "Подтверждение оплаты $185 за визу",
            "required": True,
            "category": "fees",
            "tips": "Оплачивается в банке или онлайн по инструкции консульства.",
            "risk_note": None,
        },
        {
            "id": "job_offer",
            "name": "Job Offer от работодателя",
            "description": "Официальное приглашение на работу в США",
            "required": True,
            "category": "program",
            "tips": "Содержит: место работы, зарплату, даты контракта, подпись работодателя.",
            "risk_note": None,
        },
        {
            "id": "university_certificate",
            "name": "Справка из университета",
            "description": "Подтверждение что ты студент очной формы",
            "required": True,
            "category": "education",
            "tips": "На английском языке с печатью и подписью. Срок действия обычно 1 месяц.",
            "risk_note": None,
        },
        {
            "id": "photo",
            "name": "Фото на визу",
            "description": "Фото американского стандарта 5x5 см на белом фоне",
            "required": True,
            "category": "identity",
            "tips": "Сделай в фотоателье. Не более 6 месяцев давности. Без очков.",
            "risk_note": None,
        },
        {
            "id": "appointment_confirmation",
            "name": "Подтверждение записи на интервью",
            "description": "Распечатанное подтверждение с датой и временем",
            "required": True,
            "category": "visa",
            "tips": "Записаться на ustraveldocs.com.",
            "risk_note": None,
        },
    ]

    # Financial planning awareness note (real figures from USCOM.KZ, 2025)
    base_docs.append({
        "id": "financial_plan",
        "name": "Финансовый план поездки",
        "description": "Программа $2100–$2450 + SEVIS $35 + виза $185 + авиабилет ~$900 + орг.расходы агентства ~140 000 тенге",
        "required": False,
        "category": "financial",
        "tips": (
            "Independent (самостоятельный поиск работы) — $2100. "
            "Premium (работу подбирает спонсор) — $2450. "
            "Итого на руках перед поездкой: ≈$3 700–4 200 плюс тенговые расходы."
        ),
        "risk_note": None,
    })

    conditional_docs: list[dict[str, Any]] = []

    financial_source = profile.get("financial_source", "")
    if financial_source == "parents":
        conditional_docs.extend([
            {
                "id": "parents_bank_statement",
                "name": "Банковская выписка родителей",
                "description": "Выписка за последние 3-6 месяцев",
                "required": True,
                "category": "financial",
                "tips": "Остаток должен покрывать поездку.",
                "risk_note": "Высокий риск — подготовь объяснение для офицера",
            },
            {
                "id": "parents_income_certificate",
                "name": "Справка о доходах родителей",
                "description": "С места работы родителей на английском",
                "required": True,
                "category": "financial",
                "tips": "Подтверждает стабильный доход семьи.",
                "risk_note": None,
            },
        ])
    elif financial_source == "self":
        conditional_docs.append({
            "id": "own_bank_statement",
            "name": "Личная банковская выписка",
            "description": "Выписка за последние 3 месяца",
            "required": True,
            "category": "financial",
            "tips": "Минимальный остаток $500–1000.",
            "risk_note": None,
        })

    if not profile.get("travel_history", True):
        conditional_docs.append({
            "id": "no_travel_explanation",
            "name": "Подготовь объяснение отсутствия поездок",
            "description": "Не документ, а речевая подготовка",
            "required": False,
            "category": "preparation",
            "tips": "Офицер спросит почему не выезжал. Ответ: учёба, не было возможности, хочу начать с США.",
            "risk_note": "Высокий риск — проработай в симуляторе",
        })

    return base_docs + conditional_docs


def compute_progress(checklist: list[dict], completed_ids: set[str]) -> int:
    required = [d for d in checklist if d["required"]]
    if not required:
        return 0
    done = sum(1 for d in required if d["id"] in completed_ids)
    return round(done / len(required) * 100)


DS160_STEPS: list[dict[str, Any]] = [
    {
        "step": 1,
        "title": "Начало заполнения",
        "description": "Зайди на ceac.state.gov → New Application → выбери консульство (Almaty для KZ)",
        "important": "Сохрани Application ID — он нужен чтобы продолжить если прервёшься",
        "warning": None,
    },
    {
        "step": 2,
        "title": "Personal Information 1",
        "description": "Имя ТОЧНО как в паспорте. Фамилия → Surname, Имя → Given Names",
        "important": "Have you ever used other names? — если меняли фамилию, укажи",
        "warning": "Ошибка в имени = отказ. Проверь дважды.",
    },
    {
        "step": 3,
        "title": "Personal Information 2",
        "description": "Дата рождения, место рождения, гражданство, национальность",
        "important": "National Identification Number — ИИН для Казахстана",
        "warning": None,
    },
    {
        "step": 4,
        "title": "Travel Information",
        "description": "Цель поездки: Exchange Visitor (J). Дата въезда, штат где будете работать",
        "important": "Specific Travel Plans — укажи примерные даты если есть",
        "warning": None,
    },
    {
        "step": 5,
        "title": "Travel Companions",
        "description": "Едешь один? — No. Едешь с группой? — Yes, укажи название группы",
        "important": None,
        "warning": None,
    },
    {
        "step": 6,
        "title": "Previous US Travel",
        "description": "Был ли раньше в США? Были ли отказы в визе США?",
        "important": "Если был отказ — ОБЯЗАТЕЛЬНО укажи. Ложь = пожизненный бан.",
        "warning": "Никогда не скрывай предыдущие отказы",
    },
    {
        "step": 7,
        "title": "US Contact Information",
        "description": "Адрес работодателя в США (из Job Offer)",
        "important": "Точный адрес из Job Offer. Телефон работодателя.",
        "warning": None,
    },
    {
        "step": 8,
        "title": "US Emergency Contact",
        "description": "Контакт в США на случай экстренной ситуации",
        "important": "Можно указать работодателя если нет знакомых в США",
        "warning": None,
    },
    {
        "step": 9,
        "title": "Home Country Contact",
        "description": "Контакт на родине (родители или близкий человек)",
        "important": "Имя, телефон, адрес родителей или родственника",
        "warning": None,
    },
    {
        "step": 10,
        "title": "Family Information",
        "description": "Информация о родителях (имя, дата рождения, страна рождения)",
        "important": "Родственники в США? — укажи честно если есть",
        "warning": None,
    },
    {
        "step": 11,
        "title": "Work / Education / Training",
        "description": "Текущее место учёбы, специальность, даты",
        "important": "Primary Occupation: Student. Employer: название университета",
        "warning": None,
    },
    {
        "step": 12,
        "title": "Security Questions Part 1",
        "description": "Вопросы о судимостях, наркотиках, терроризме",
        "important": "Для большинства студентов — все ответы NO",
        "warning": "Отвечай честно. Проверяется по базам данных.",
    },
    {
        "step": 13,
        "title": "Security Questions Part 2",
        "description": "Вопросы об иммиграционных нарушениях",
        "important": "Незаконно депортирован? Нарушал визовый режим? — для большинства NO",
        "warning": None,
    },
    {
        "step": 14,
        "title": "Photo Upload",
        "description": "Загрузи фото американского стандарта",
        "important": "Требования: 600×600px минимум, белый фон, лицо 50% кадра",
        "warning": "Неправильное фото — самая частая причина проблем",
    },
    {
        "step": 15,
        "title": "Review and Submit",
        "description": "Проверь все данные → Submit → Распечатай страницу с баркодом",
        "important": "После отправки нельзя редактировать. Проверь ВСЁ.",
        "warning": "Распечатай сразу — нужна на интервью",
    },
]

COMMON_MISTAKES: list[dict[str, str]] = [
    {
        "mistake": "Ошибка в написании имени",
        "consequence": "Отказ или задержка визы",
        "solution": "Имя ТОЧНО как в паспорте. Проверь каждую букву.",
    },
    {
        "mistake": "Скрыт предыдущий отказ в визе",
        "consequence": "Пожизненный запрет на въезд в США",
        "solution": "Всегда указывай все отказы честно. Они проверяются.",
    },
    {
        "mistake": "Неправильное фото",
        "consequence": "Отказ анкеты, задержка",
        "solution": "Сделай фото в фотоателье со стандартом для США.",
    },
    {
        "mistake": "Неточный адрес работодателя",
        "consequence": "Вопросы на интервью, подозрения",
        "solution": "Адрес точно из Job Offer. Проверь на Google Maps.",
    },
    {
        "mistake": "Не сохранён Application ID",
        "consequence": "Нельзя продолжить анкету",
        "solution": "Запиши ID сразу при создании. Храни в заметках.",
    },
    {
        "mistake": "Неправильная цель поездки",
        "consequence": "Отказ визы",
        "solution": "Для Work & Travel выбирай Exchange Visitor (J), не Tourist.",
    },
]
