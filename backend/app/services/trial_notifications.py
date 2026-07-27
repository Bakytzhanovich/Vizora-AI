"""Banner shown across authenticated pages nudging trial/expired/past_due
users toward a plan. Pure function over an already-computed `access` dict
(from subscription_service.get_user_access) — callers that already fetched
access for another reason (e.g. GET /profile/me) don't pay for a second query.
"""


def _days_word_ru(days: int) -> str:
    """Russian plural: 1 день, 2-4 дня, 5+ дней (with the usual 11-14 exception)."""
    if 11 <= days % 100 <= 14:
        return "дней"
    last = days % 10
    if last == 1:
        return "день"
    if 2 <= last <= 4:
        return "дня"
    return "дней"


def get_subscription_banner(access: dict) -> dict | None:
    status = access["status"]

    if status == "trial":
        days = access["days_remaining"]

        if days > 4:
            return None  # No banner for the first few days

        if days == 4:
            return {
                "type": "warning",
                "color": "yellow",
                "message": f"Осталось {days} дня бесплатного доступа",
                "cta": "Выбрать план",
                "cta_url": "/pricing",
            }

        if days == 1:
            return {
                "type": "danger",
                "color": "red",
                "message": "Последний день триала! Подпишись со скидкой 30%",
                "cta": "Подписаться со скидкой",
                "cta_url": "/pricing?discount=trial30",
                "show_discount": True,
            }

        if days == 0:
            return {
                "type": "urgent",
                "color": "red",
                "message": "Сегодня последний день! Не теряй прогресс",
                "cta": "Сохранить доступ",
                "cta_url": "/pricing",
            }

        return {
            "type": "warning",
            "color": "orange",
            "message": f"Осталось {days} {_days_word_ru(days)} бесплатного доступа",
            "cta": "Выбрать план",
            "cta_url": "/pricing",
        }

    if status == "expired":
        return {
            "type": "danger",
            "color": "red",
            "message": "Твой бесплатный период закончился — подписка нужна",
            "cta": "Выбрать план",
            "cta_url": "/paywall",
        }

    if status == "past_due":
        return {
            "type": "danger",
            "color": "red",
            "message": "Проблема с оплатой — обнови способ оплаты",
            "cta": "Обновить оплату",
            "cta_url": "/pricing?renew=1",
        }

    if status == "canceled":
        period_end = access.get("period_end")
        suffix = f" до {period_end.strftime('%d.%m')}" if period_end else ""
        return {
            "type": "warning",
            "color": "orange",
            "message": f"Подписка отменена — доступ сохранится{suffix}",
            "cta": "Возобновить",
            "cta_url": "/pricing",
        }

    return None
