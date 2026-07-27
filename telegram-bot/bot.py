"""
Vizora AI — Telegram Bot

Setup:
1. Message @BotFather on Telegram
2. /newbot → follow prompts → get TELEGRAM_BOT_TOKEN
3. /mybots → select bot → Bot Settings → Menu Button
   → Type: Web App → URL: https://vizora.kz (or your deployed URL)
4. /mybots → select bot → Bot Settings → Configure Mini App
   → Enable and set URL: https://vizora.kz
5. Copy .env.example to .env and fill in values
6. pip install -r requirements.txt
7. python bot.py
"""

import logging
import os

from dotenv import load_dotenv
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
    WebAppInfo,
)
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from notifications import run_all, start_scheduler

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://vizora.kz")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


def _app_button(label: str, path: str = "", tg_param: str = "") -> InlineKeyboardButton:
    """Build an inline button opening the Mini App at a specific path/param."""
    url = f"{MINI_APP_URL}{path}" if path else MINI_APP_URL
    if tg_param:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}tg_param={tg_param}"
    return InlineKeyboardButton(label, web_app=WebAppInfo(url=url))


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    /start [param]

    Deep link params:
      ref_CODE          → referral signup, passes code to Mini App
      agency_ID         → student added by agency
      reminder_simulator → open straight to simulator
    """
    if not update.message or not update.effective_user:
        return

    args = context.args or []
    tg_param = args[0] if args else ""

    welcome = (
        "👋 Привет! Я бот Vizora AI\n\n"
        "Я помогу тебе подготовиться к визовому интервью "
        "J-1 для программы Work and Travel USA.\n\n"
        "Что я умею:\n"
        "🤖 Отвечать на вопросы про Work & Travel\n"
        "🎤 Тренировать тебя для интервью с консулом\n"
        "📄 Помогать с документами\n"
        "🗺️ Вести тебя по всему пути к визе\n\n"
        "Нажми кнопку ниже чтобы начать 👇"
    )

    keyboard = InlineKeyboardMarkup([
        [_app_button("🚀 Открыть Vizora AI", tg_param=tg_param)],
    ])

    await update.message.reply_text(welcome, reply_markup=keyboard)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/help"""
    if not update.message:
        return

    text = (
        "🤖 *Vizora AI Bot — справка*\n\n"
        "Помогаю студентам подготовиться к визовому интервью J-1 (Work & Travel USA).\n\n"
        "*Команды:*\n"
        "/start — открыть Vizora AI\n"
        "/menu — быстрое меню разделов\n"
        "/help — эта справка\n\n"
        "*Что умеет Vizora AI:*\n"
        "• AI чат — ответы на вопросы 24/7\n"
        "• Симулятор интервью с оценкой ответов\n"
        "• Чек-лист документов\n"
        "• Roadmap подготовки шаг за шагом\n"
        "• Emergency помощь если что-то пошло не так в США\n\n"
        "Нажми /start чтобы начать 🚀"
    )

    await update.message.reply_text(text, parse_mode="Markdown")


async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/menu — quick-access grid for returning users."""
    if not update.message:
        return

    keyboard = InlineKeyboardMarkup([
        [
            _app_button("📊 Мой прогресс", "/dashboard"),
            _app_button("🤖 Спросить AI", "/chat"),
        ],
        [
            _app_button("🎤 Симулятор", "/simulator"),
            _app_button("📄 Документы", "/documents"),
        ],
        [
            _app_button("🗺️ Roadmap", "/roadmap"),
            _app_button("🆘 Emergency", "/emergency"),
        ],
    ])

    await update.message.reply_text("Выбери раздел 👇", reply_markup=keyboard)


async def unknown_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    await update.message.reply_text(
        "Не понял эту команду. Напиши /help чтобы увидеть список команд."
    )


async def _post_init(application: Application) -> None:
    """Starts the inactivity/interview-reminder scheduler once the bot's event
    loop is running — APScheduler's AsyncIOScheduler needs a live loop to bind to,
    which only exists once run_polling() has handed control to the async runtime."""
    start_scheduler()
    await run_all()  # also run once immediately so a fresh deploy doesn't wait for 10:00/18:00


def main() -> None:
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN не установлен в .env")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(_post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("menu", menu))
    app.add_handler(MessageHandler(filters.COMMAND, unknown_command))

    logger.info("Vizora AI Bot запущен и ждёт сообщений...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
