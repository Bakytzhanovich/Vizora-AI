# Vizora AI

Vizora AI is a Work & Travel / US visa preparation platform with three main local interfaces:

- Student app: onboarding, dashboard, AI chat, interview simulator, documents, roadmap, referrals.
- Agency app: agency admin and manager workspace for students, team, settings, analytics.
- Owner admin panel: global users, agencies, managers, analytics, system status, knowledge base and scraper tools.

## Project Structure

```text
VizoraAI/
  backend/       FastAPI API, SQLite/Postgres database, scraper, tests
  frontend/      Next.js app
  telegram-bot/  Telegram bot and notification helpers
```

## Local URLs

```text
Frontend:        http://localhost:3000
Backend API:     http://localhost:8000
Backend health:  http://localhost:8000/health
```

Main frontend routes:

```text
/login                 Student / owner login
/dashboard             Student dashboard
/agency/login          Agency login
/agency/dashboard      Agency admin / manager dashboard
/admin/dashboard       Owner admin panel
/admin/knowledge-base  Owner knowledge base and scraper panel
```

## Backend Setup

Run backend from the `backend` directory so the local SQLite path resolves to `backend/vizora.db`.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend env file:

```text
backend/.env
```

Use `backend/.env.example` as a base. Do not commit real secrets.

Important variables:

```text
DATABASE_URL
ALLOWED_ORIGINS
JWT_SECRET
OPENAI_API_KEY
AI_PROVIDER
AI_MODEL
GEMINI_API_KEY
GROQ_API_KEY
TELEGRAM_BOT_TOKEN
NOTIFICATION_SECRET
ADMIN_SECRET
FRONTEND_URL
```

For local SQLite:

```text
DATABASE_URL=sqlite+aiosqlite:///./vizora.db
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend env file:

```text
frontend/.env.local
```

Local API setting:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Roles And Access

There are two different admin concepts:

- `users.role = admin`: owner/admin of the whole Vizora platform. This user can open `/admin/dashboard`.
- `agency_members.role = admin`: admin of one agency. This user opens `/agency/dashboard`, not owner admin.

Common roles:

```text
student                 Student interface: /dashboard
admin in users          Owner admin panel: /admin/dashboard
admin in agency_members Agency admin interface: /agency/dashboard
manager                 Agency manager interface: /agency/dashboard
```

To make an existing local user an owner admin:

```bash
sqlite3 backend/vizora.db "UPDATE users SET role = 'admin' WHERE email = 'nurs@gmail.com';"
```

After that, log in through:

```text
http://localhost:3000/login
```

The app should redirect that user to:

```text
http://localhost:3000/admin/dashboard
```

## Useful Checks

Frontend type check:

```bash
cd frontend
npx tsc --noEmit
```

Backend admin RBAC tests:

```bash
cd backend
source venv/bin/activate
python -m unittest tests.test_admin_rbac -v
```

Health check:

```bash
curl http://localhost:8000/health
```

Check local user roles:

```bash
sqlite3 backend/vizora.db "select email, role from users order by email;"
```

Check agency members:

```bash
sqlite3 backend/vizora.db "select email, role, status from agency_members order by email;"
```

## Owner Admin API

Owner admin frontend uses these backend endpoints:

```text
GET /api/admin/overview
GET /api/admin/users
GET /api/admin/agencies
GET /api/admin/managers
GET /api/admin/analytics
GET /api/admin/system
GET /api/admin/scraper/status
POST /api/admin/scraper/run-now
```

These endpoints require a normal JWT login for a user with:

```text
users.role = admin
```

`X-Admin-Secret` is not used for owner panel access.

## Notes

- Keep real `.env` files private.
- `backend/vizora.db` is the local development database.
- If a role changes in the database, log out and log in again in the browser.
- If Next.js keeps old behavior during development, restart `npm run dev` and hard reload the browser.
