from typing import Any


def generate_risk_profile(
    travel_history: bool,
    financial_source: str,
    course_year: int,
    english_level: str,
    country_code: str = "USA",
    visa_type: str = "J1",
) -> dict[str, Any]:
    # Tagged with the target visa program now — risk logic below is still
    # entirely J1/USA-specific and untouched; this just records which
    # program a given profile was generated for, so a future non-J1/USA
    # risk model doesn't need to backfill or migrate existing profiles.
    risks = []

    if not travel_history:
        risks.append({
            "type": "no_travel_history",
            "severity": "high",
            "label_ru": "Нет истории поездок",
            "advice_ru": "Подготовь убедительное объяснение почему ты вернёшься домой",
            "focus_questions": [
                "Why do you want to visit USA?",
                "What are your ties to Kazakhstan?",
                "Why should we believe you'll return?",
            ],
        })

    if financial_source == "parents":
        risks.append({
            "type": "parent_finances",
            "severity": "medium",
            "label_ru": "Финансы через родителей",
            "advice_ru": "Готовь банковские справки и документы о доходах родителей",
            "focus_questions": [
                "How will you fund your trip?",
                "What is your parents' income?",
                "Do you have bank statements?",
            ],
        })

    if course_year in (1, 4):
        note = (
            "1st year = not enough ties to home country"
            if course_year == 1
            else "4th year = officer may think you won't return"
        )
        note_ru = (
            "1 курс — офицер сомневается в твоих связях с родиной"
            if course_year == 1
            else "4 курс — офицер думает, что ты можешь не вернуться"
        )
        risks.append({
            "type": "high_risk_year",
            "severity": "high",
            "label_ru": f"Рискованный курс ({course_year}-й)",
            "advice_ru": note_ru,
            "note": note,
        })

    if english_level == "weak":
        risks.append({
            "type": "weak_english",
            "severity": "medium",
            "label_ru": "Слабый английский",
            "advice_ru": "Выучи ключевые фразы для интервью и тренируй уверенность",
            "focus_questions": [
                "Practice speaking confidence",
                "Learn key interview phrases",
            ],
        })

    high_count = sum(1 for r in risks if r["severity"] == "high")
    if high_count >= 2:
        overall = "high"
    elif high_count == 1 or len(risks) >= 2:
        overall = "medium"
    elif len(risks) == 1:
        overall = "medium"
    else:
        overall = "low"

    return {
        "risks": risks,
        "overall_risk": overall,
        "country_code": country_code,
        "visa_type": visa_type,
    }
