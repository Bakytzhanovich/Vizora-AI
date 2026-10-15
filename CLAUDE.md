# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vizora AI is a Russian/Kazakh-language US visa preparation platform (Work & Travel, F-1): AI FAQ chat, voice interview simulator with a "consul" verdict, English level test, documents/DS-160 guide, roadmap, plus a B2B agency workspace and an owner admin panel. `README.md` has full local setup, env variables and role details.

## Commands

Backend (run from `backend/`, venv in `backend/venv`):

```bash
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
alembic upgrade head                                  # also runs automatically on startup
alembic revision --autogenerate -m "describe change"  # after model changes
python -m unittest discover -s tests -v               # all tests
python -m unittest tests.test_visa_decision -v        # one module
python -m unittest tests.test_visa_decision.<Class>.<test_name>
```

Frontend (run from `frontend/`):

```bash
npm run dev          # http://localhost:3000, needs NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local
npm run build
npm run lint
npx tsc --noEmit     # type check
```

kaspi-service (run from `kaspi-service/`, Node ≥ 20.6): `npm start`, `npm test`, `npm run lint`. Its own conventions are in `kaspi-service/AGENTS.md`.

Local Postgres: `docker compose up -d postgres pgadmin` from the repo root. SQLite (`sqlite+aiosqlite:///./vizora.db`) is only a local fallback; production is Postgres via asyncpg.

## Architecture

- **Backend** is FastAPI with async SQLAlchemy. `backend/main.py` wires everything: it imports every model module so metadata is complete, mounts the routers from `backend/routers/`, and in `lifespan` runs Alembic migrations (`RUN_MIGRATIONS_ON_STARTUP`), bootstraps the owner admin from `BOOTSTRAP_ADMIN_*` env vars, seeds the RAG knowledge base, and starts three in-process schedulers (KB scraper, web push reminders, subscription counter resets). Because of these schedulers the backend must run as **a single uvicorn process**; multiple workers would duplicate scheduled jobs.
- Business logic lives in `backend/app/services/`; routers stay thin. Config is `app/core/config.py` (pydantic settings from `backend/.env`). A new model must also be imported in `main.py` and get an Alembic migration.
- Middleware in `main.py` is raw ASGI on purpose: `BaseHTTPMiddleware` buffers responses and breaks the streaming endpoints (`/api/chat/message`, `/simulator/respond`). Keep new middleware raw ASGI. `/health` bypasses the Host-header check.
- **AI provider** is chosen by `AI_PROVIDER` (`openai` | `gemini` | `groq`) with optional `AI_MODEL` override in `app/services/ai_service.py`. Embeddings and TTS are OpenAI-only regardless of provider; STT uses Groq Whisper when the provider is groq. Simulator feedback relies on `response_format=json_object`, so any model swap must support it. Check which model is used where before changing AI code.
- **Auth has three separate contexts**:
  - students and owner admin use the user JWT (`app/core/security.py`); `users.role = admin` is the platform owner (`/admin/*`);
  - agency members use a separate JWT from `app/core/agency_auth.py` (`agency_members.role` = `admin` | `manager`), stored on the frontend under `agency_token` and sent by `lib/agency-api.ts`;
  - an agency `admin` is not a platform admin.
- **Payments**: Standard/Premium are paid by Kaspi. `PAYMENT_MODE` (default `manual`) picks the student flow: in `manual` the student leaves their Kaspi phone (`payment_requests` table), the owner sends a remote invoice from Kaspi Pay for business and clicks "Дать доступ" on `/admin/payments`; in `kaspi` the automatic QR checkout runs through `kaspi-service/`, a separate Express app that automates the merchant's Kaspi account (`app/services/kaspi_pay_client.py`). Both end in `routers/payments.py::_apply_successful_payment`. Without `KASPI_SERVICE_URL` the automatic flow is in mock mode, where `/payments/mock-complete` activates a plan for free, which is why manual is the default. Prices live only in `PLAN_PRICES_KZT`; the frontend reads them from `/api/payments/plans`. kaspi-service keeps state in local files (`keypair.json`, `device.json`, `tracked-payments.json`, `webhooks.json`), which must persist across deploys.
- **Frontend** is Next.js 14 App Router + Tailwind. Route groups: `(auth)` login/register, `(shell)` the student app with shared navigation, plus `admin/`, `agency/`, `simulator/`, `chat/`, `onboarding/`, and marketing pages (landing, `pricing`, `blog` from Markdown in `content/blog`). API clients are split by context: `lib/api.ts` (student), `lib/agency-api.ts`, `lib/admin-api.ts`. UI text goes through i18next (`lib/i18n.ts`, locales `ru` and `kz`). Colors are theme tokens in `app/globals.css` (light brand theme is the default, dark via `data-theme="dark"`); use `bg-card`, `text-primary`, `text-accent` etc. rather than hex values. The landing (`components/landing/`) is light-only and uses the brand hexes directly. The app is a PWA with web push (`lib/push.ts`).
- **telegram-bot/** is a separate Python bot plus notification helpers called by the backend.

## Deployment

Frontend is on Vercel. The backend is moving from Render to a VPS: `deploy/` holds the Docker Compose stack (Caddy for HTTPS, backend, optional Postgres and kaspi-service), `backup.sh`, and the step-by-step guide `deploy/DEPLOY.md` (in Russian). The `ALLOWED_HOSTS` env var must include the API domain or every non-`/health` request returns `400 Invalid host header`.

## Conventions

- Commit messages are in English, imperative, describing the user-visible effect (see `git log`).
- Comments explain non-obvious "why" (incidents, platform quirks); don't add comments that restate the code.
- User-facing copy is Russian (with Kazakh translations); keep both locales in sync when adding UI strings.
