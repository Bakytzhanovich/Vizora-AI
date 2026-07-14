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

## PostgreSQL With Docker

The project is prepared to run PostgreSQL locally through Docker Compose.

Copy the Docker env example:

```bash
cp .env.example .env
```

Start PostgreSQL and pgAdmin:

```bash
docker compose up -d postgres pgadmin
```

Check service status:

```bash
docker compose ps
docker compose logs postgres
```

PostgreSQL connection:

```text
Host: localhost
Port: 5432
Database: vizora
User: vizora
Password: secure_password
```

pgAdmin:

```text
URL: http://localhost:5050
Email: admin@vizora.local
Password: secure_pgadmin_password
```

The Postgres container uses a persistent Docker volume:

```text
postgres_data
```

## Backend Setup

Run backend from the `backend` directory.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
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

For local Docker PostgreSQL:

```text
DATABASE_URL=postgresql+asyncpg://vizora:secure_password@localhost:5432/vizora
AUTO_CREATE_TABLES=false
```

For quick local SQLite fallback only:

```text
# DATABASE_URL=sqlite+aiosqlite:///./vizora.db
```

Run Alembic migrations before starting the backend:

```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

Start FastAPI:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
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

## Alembic Migrations

Alembic is configured in:

```text
backend/alembic.ini
backend/alembic/
```

Current initial migration:

```text
backend/alembic/versions/20260714_0001_initial_schema.py
```

Run migrations:

```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

Create a new migration after model changes:

```bash
cd backend
source venv/bin/activate
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

Production should use migrations, not automatic table creation:

```text
AUTO_CREATE_TABLES=false
```

Local backward compatibility is still available with:

```text
AUTO_CREATE_TABLES=true
```

## Migrating Existing SQLite Data To PostgreSQL

Start Postgres and run migrations first:

```bash
docker compose up -d postgres
cd backend
source venv/bin/activate
alembic upgrade head
```

Copy existing SQLite data from `backend/vizora.db` into PostgreSQL:

```bash
cd backend
source venv/bin/activate
python scripts/migrate_sqlite_to_postgres.py \
  --sqlite-path vizora.db \
  --postgres-url postgresql+asyncpg://vizora:secure_password@localhost:5432/vizora
```

For a clean target database, add `--truncate`:

```bash
python scripts/migrate_sqlite_to_postgres.py \
  --sqlite-path vizora.db \
  --postgres-url postgresql+asyncpg://vizora:secure_password@localhost:5432/vizora \
  --truncate
```

The script copies rows table-by-table using current SQLAlchemy metadata and preserves existing UUID primary keys.

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

Check Postgres tables:

```bash
docker compose exec postgres psql -U vizora -d vizora -c "\dt"
```

Check backend can connect to Postgres:

```bash
cd backend
source venv/bin/activate
python -c "from app.core.config import settings; print(settings.database_url_async.split('@')[-1])"
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

## Railway Deployment Notes

Recommended backend environment variables on Railway:

```text
DATABASE_URL=<Railway Postgres URL>
AUTO_CREATE_TABLES=false
ALLOWED_ORIGINS=["https://your-vercel-domain.vercel.app"]
FRONTEND_URL=https://your-vercel-domain.vercel.app
JWT_SECRET=<long random secret>
AI_PROVIDER=openai
OPENAI_API_KEY=<secret>
TELEGRAM_BOT_TOKEN=<optional secret>
NOTIFICATION_SECRET=<optional secret>
ADMIN_SECRET=<optional secret>
```

The app accepts Railway-style `postgresql://...` URLs and normalizes them internally to `postgresql+asyncpg://...`.

Backend start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Run migrations during deploy/release:

```bash
alembic upgrade head
```

## Notes

- Keep real `.env` files private.
- `backend/vizora.db` is the legacy/local SQLite development database.
- PostgreSQL is the target production database.
- If a role changes in the database, log out and log in again in the browser.
- If Next.js keeps old behavior during development, restart `npm run dev` and hard reload the browser.
