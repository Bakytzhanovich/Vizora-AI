from typing import Any

ROADMAP_STEPS: list[dict[str, Any]] = [
    {
        "id": "profile",
        "number": 1,
        "title": "Профиль заполнен",
        "description": "Анкета Vizora AI заполнена",
        "category": "preparation",
        "auto_complete": True,
        "tips": "Профиль помогает AI персонализировать подготовку",
    },
    {
        "id": "documents",
        "number": 2,
        "title": "Документы собраны",
        "description": "Все необходимые документы готовы",
        "category": "preparation",
        "auto_complete": False,
        "tips": "Проверь чек-лист документов в разделе Документы",
    },
    {
        "id": "ds160",
        "number": 3,
        "title": "DS-160 заполнен",
        "description": "Онлайн-анкета на визу заполнена и отправлена",
        "category": "visa",
        "auto_complete": False,
        "tips": "Заполни на ceac.state.gov. Сохрани Application ID.",
    },
    {
        "id": "sevis",
        "number": 4,
        "title": "SEVIS оплачен",
        "description": "Сбор SEVIS I-901 ($35) оплачен",
        "category": "visa",
        "auto_complete": False,
        "tips": "Оплатить на fmjfee.com",
    },
    {
        "id": "appointment",
        "number": 5,
        "title": "Запись в консульство",
        "description": "Дата и время интервью назначены",
        "category": "visa",
        "auto_complete": False,
        "tips": "Записаться на ustraveldocs.com",
    },
    {
        "id": "interview_prep",
        "number": 6,
        "title": "Подготовка к интервью",
        "description": "Пройди минимум 5 сессий симулятора",
        "category": "interview",
        "auto_complete": False,
        "tips": "Начни с Режима Тренер, затем Режим Консул",
    },
    {
        "id": "interview",
        "number": 7,
        "title": "Визовое интервью",
        "description": "Интервью в консульстве США пройдено",
        "category": "interview",
        "auto_complete": False,
        "tips": "Возьми все документы. Приди за 30 минут.",
    },
    {
        "id": "visa",
        "number": 8,
        "title": "Виза получена 🎉",
        "description": "Виза J-1 одобрена и получена",
        "category": "visa",
        "auto_complete": False,
        "tips": "Поздравляем! Теперь готовься к поездке.",
    },
    {
        "id": "flight",
        "number": 9,
        "title": "Билет куплен",
        "description": "Авиабилеты в США куплены",
        "category": "travel",
        "auto_complete": False,
        "tips": "Купи заранее — дешевле. Прилети за 1-2 дня до начала работы.",
    },
    {
        "id": "arrival",
        "number": 10,
        "title": "Прилёт в США ✈️",
        "description": "Ты в Америке!",
        "category": "travel",
        "auto_complete": False,
        "tips": "Пройди паспортный контроль. Скажи что по J-1 программе.",
    },
    {
        "id": "ssn",
        "number": 11,
        "title": "SSN получен",
        "description": "Social Security Number оформлен",
        "category": "usa",
        "auto_complete": False,
        "tips": "Обратись в SSA офис через 10 дней после приезда",
    },
    {
        "id": "work",
        "number": 12,
        "title": "Работа начата",
        "description": "Ты работаешь в США!",
        "category": "usa",
        "auto_complete": False,
        "tips": "Сохраняй все pay stubs — нужны для налогов",
    },
    {
        "id": "taxes",
        "number": 13,
        "title": "Налоги поданы",
        "description": "Tax return подан после окончания программы",
        "category": "usa",
        "auto_complete": False,
        "tips": "Подай через sprintax.com — специально для J-1",
    },
    {
        "id": "return",
        "number": 14,
        "title": "Возвращение домой 🏠",
        "description": "Программа завершена, ты дома",
        "category": "return",
        "auto_complete": False,
        "tips": "Поздравляем с успешной программой!",
    },
]

# IDs in order — used for current-step detection
_STEP_ORDER = [s["id"] for s in ROADMAP_STEPS]

# Journey progress weights (keys must match step IDs)
_PROGRESS_WEIGHTS: dict[str, int] = {
    "profile": 10,
    "documents": 15,
    "interview_prep": 25,
    "visa": 30,
    "return": 20,
}


def calculate_completed_steps(doc_progress: int, manual_completions: set[str]) -> set[str]:
    """Return the set of all completed step IDs, merging auto and manual completions."""
    completed: set[str] = {"profile"}  # always done for authenticated users
    if doc_progress >= 100:
        completed.add("documents")
    completed |= manual_completions
    return completed


def compute_journey_progress(completed_ids: set[str]) -> int:
    return sum(w for step_id, w in _PROGRESS_WEIGHTS.items() if step_id in completed_ids)


def find_current_step(completed_ids: set[str]) -> str | None:
    for step_id in _STEP_ORDER:
        if step_id not in completed_ids:
            return step_id
    return None  # all done
