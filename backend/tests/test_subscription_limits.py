import asyncio
import unittest
from datetime import datetime, timedelta

import app.models.profile  # noqa: F401 — User.profile needs StudentProfile mapped
from app.models.user import User
from app.services.subscription_service import _current_month, get_user_access


class _Db:
    async def commit(self):
        pass


def _standard_user(used: int, month) -> User:
    return User(
        email="s@x.com", role="student", subscription_plan="standard",
        subscription_period_end=datetime.utcnow() + timedelta(days=20),
        sessions_used_this_month=used, sessions_month=month,
    )


class MonthlySessionLimitTests(unittest.TestCase):
    def test_new_month_gives_the_sessions_back(self):
        last_month = (_current_month() - timedelta(days=1)).replace(day=1)
        user = _standard_user(15, last_month)
        access = asyncio.run(get_user_access(user, _Db()))
        self.assertTrue(access["sessions_ok"])
        self.assertEqual(access["sessions_used"], 0)
        self.assertEqual(user.sessions_month, _current_month())

    def test_used_up_month_stays_blocked(self):
        user = _standard_user(15, _current_month())
        self.assertFalse(asyncio.run(get_user_access(user, _Db()))["sessions_ok"])


if __name__ == "__main__":
    unittest.main()
