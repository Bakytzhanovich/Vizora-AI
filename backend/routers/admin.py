"""Admin endpoints: scraper control + knowledge base management."""

import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.after_visa import AfterVisaProgress
from app.models.agency import Agency, AgencyMember, AgencyStudent
from app.models.analytics import AnalyticsEvent
from app.models.chat import ChatMessage
from app.models.documents import DocumentProgress
from app.models.early_access import EarlyAccessEmail
from app.models.emergency import EmergencySession
from app.models.knowledge_base import KnowledgeBase, ScraperRun
from app.models.profile import StudentProfile
from app.models.roadmap import RoadmapProgress
from app.models.simulator import SimulatorSession
from app.models.user import User
from app.core.security import get_current_user

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

# Keeps strong references to background tasks so the GC doesn't cancel them.
_bg_tasks: set[asyncio.Task] = set()


def _audit_admin_action(action: str, admin_user: User, **details) -> None:
    import logging

    logging.getLogger(__name__).info(
        "admin_action action=%s admin_id=%s admin_email=%s details=%s",
        action,
        admin_user.id,
        admin_user.email,
        details,
    )


# ─── Owner dashboard endpoints ───────────────────────────────────────────────

def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


async def _count(db: AsyncSession, model, *where) -> int:
    q = select(func.count()).select_from(model)
    for condition in where:
        q = q.where(condition)
    return await db.scalar(q) or 0


async def _distinct_count(db: AsyncSession, column, *where) -> int:
    q = select(func.count(func.distinct(column)))
    for condition in where:
        q = q.where(condition)
    return await db.scalar(q) or 0


async def _daily_counts(db: AsyncSession, column, since: datetime, *where) -> dict[str, int]:
    day = func.date(column)
    q = select(day, func.count()).where(column >= since).group_by(day).order_by(day)
    for condition in where:
        q = q.where(condition)
    rows = await db.execute(q)
    return {str(row[0]): row[1] for row in rows.all()}


_RETENTION_DAYS = [1, 3, 7, 14, 30]


async def _compute_weekly_retention(db: AsyncSession) -> dict:
    """Retention curve (D1/D3/D7/D14/D30) by weekly signup cohort.

    "Returned" at DN means the user has *any* product activity (a tracked
    analytics event, a chat message, a simulator session, or roadmap/
    document progress) within N days of registering — the standard
    cumulative "N-day retention" definition, counted from the moment of
    signup so every DN window has positive width (a fixed 1-day exclusion
    would make D1's window zero-length and permanently read ~0%). A cohort
    only gets a DN rate once its DN window has fully elapsed; cohorts still
    inside that window report a null rate instead of a misleadingly low one.
    """
    now = datetime.utcnow()
    users = (await db.execute(select(User.id, User.created_at))).all()
    empty_points = {f"d{d}": {"eligible": 0, "retained": 0, "rate": None} for d in _RETENTION_DAYS}
    if not users:
        return {"cohorts": [], "overall": empty_points, "eligible_users": 0}

    activity_sources = [
        (AnalyticsEvent.user_id, AnalyticsEvent.created_at),
        (ChatMessage.user_id, ChatMessage.created_at),
        (SimulatorSession.user_id, SimulatorSession.created_at),
        (RoadmapProgress.user_id, RoadmapProgress.created_at),
        (DocumentProgress.user_id, DocumentProgress.updated_at),
    ]
    activity_by_user: dict[str, list[datetime]] = defaultdict(list)
    for user_col, ts_col in activity_sources:
        rows = await db.execute(select(user_col, ts_col).where(user_col.isnot(None)))
        for uid, ts in rows.all():
            if uid and ts:
                activity_by_user[uid].append(ts)

    def _new_cohort() -> dict:
        return {"cohort_size": 0, "points": {d: {"eligible": 0, "retained": 0} for d in _RETENTION_DAYS}}

    cohorts: dict[str, dict] = defaultdict(_new_cohort)
    for uid, created_at in users:
        week_start = (created_at.date() - timedelta(days=created_at.weekday())).isoformat()
        cohort = cohorts[week_start]
        cohort["cohort_size"] += 1
        user_activity = activity_by_user.get(uid, [])
        for days in _RETENTION_DAYS:
            window_end = created_at + timedelta(days=days)
            if now < window_end:
                continue
            point = cohort["points"][days]
            point["eligible"] += 1
            if any(created_at <= ts <= window_end for ts in user_activity):
                point["retained"] += 1

    cohort_list = []
    overall_eligible = {d: 0 for d in _RETENTION_DAYS}
    overall_retained = {d: 0 for d in _RETENTION_DAYS}
    for week_start in sorted(cohorts.keys()):
        c = cohorts[week_start]
        points = {}
        for days in _RETENTION_DAYS:
            p = c["points"][days]
            rate = round(p["retained"] / p["eligible"] * 100, 1) if p["eligible"] else None
            points[f"d{days}"] = {"eligible": p["eligible"], "retained": p["retained"], "rate": rate}
            overall_eligible[days] += p["eligible"]
            overall_retained[days] += p["retained"]
        cohort_list.append({
            "week_start": week_start,
            "cohort_size": c["cohort_size"],
            "points": points,
        })

    overall = {}
    for days in _RETENTION_DAYS:
        eligible = overall_eligible[days]
        retained = overall_retained[days]
        rate = round(retained / eligible * 100, 1) if eligible else None
        overall[f"d{days}"] = {"eligible": eligible, "retained": retained, "rate": rate}

    return {"cohorts": cohort_list, "overall": overall, "eligible_users": overall_eligible[7]}


@router.get("/overview")
async def admin_overview(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """High-level owner dashboard numbers and recent activity."""
    now = datetime.utcnow()
    since_7d = now - timedelta(days=7)
    since_30d = now - timedelta(days=30)

    total_users = await _count(db, User)
    total_profiles = await _count(db, StudentProfile)
    total_agencies = await _count(db, Agency)
    total_members = await _count(db, AgencyMember)
    active_managers = await _count(
        db,
        AgencyMember,
        AgencyMember.role == "manager",
        AgencyMember.status == "active",
    )
    pending_invites = await _count(db, AgencyMember, AgencyMember.status == "invited")
    agency_students = await _count(db, AgencyStudent, AgencyStudent.status == "active")
    unassigned_students = await _count(
        db,
        AgencyStudent,
        AgencyStudent.status == "active",
        AgencyStudent.assigned_manager_id.is_(None),
    )
    chat_messages = await _count(db, ChatMessage, ChatMessage.role == "user")
    simulator_sessions = await _count(db, SimulatorSession)
    completed_simulations = await _count(
        db,
        SimulatorSession,
        SimulatorSession.completed.is_(True),
    )
    kb_entries = await _count(db, KnowledgeBase)
    verified_kb_entries = await _count(db, KnowledgeBase, KnowledgeBase.verified.is_(True))

    recent_users_rows = await db.execute(
        select(User.email, User.role, User.created_at, StudentProfile.name)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .order_by(User.created_at.desc())
        .limit(6)
    )
    recent_agencies_rows = await db.execute(
        select(Agency.name, Agency.email, Agency.subscription_plan, Agency.created_at)
        .order_by(Agency.created_at.desc())
        .limit(6)
    )
    plan_rows = await db.execute(
        select(Agency.subscription_plan, func.count())
        .group_by(Agency.subscription_plan)
        .order_by(func.count().desc())
    )

    return {
        "metrics": {
            "total_users": total_users,
            "completed_profiles": total_profiles,
            "new_users_7d": await _count(db, User, User.created_at >= since_7d),
            "new_users_30d": await _count(db, User, User.created_at >= since_30d),
            "total_agencies": total_agencies,
            "new_agencies_30d": await _count(db, Agency, Agency.created_at >= since_30d),
            "agency_members": total_members,
            "active_managers": active_managers,
            "pending_invites": pending_invites,
            "agency_students": agency_students,
            "unassigned_students": unassigned_students,
            "chat_questions": chat_messages,
            "simulator_sessions": simulator_sessions,
            "completed_simulations": completed_simulations,
            "knowledge_base_entries": kb_entries,
            "verified_knowledge_base_entries": verified_kb_entries,
            "early_access_leads": await _count(db, EarlyAccessEmail),
        },
        "recent_users": [
            {
                "email": row.email,
                "role": row.role,
                "name": row.name,
                "created_at": _iso(row.created_at),
            }
            for row in recent_users_rows
        ],
        "recent_agencies": [
            {
                "name": row.name,
                "email": row.email,
                "plan": row.subscription_plan,
                "created_at": _iso(row.created_at),
            }
            for row in recent_agencies_rows
        ],
        "subscription_plans": [
            {"plan": row[0], "count": row[1]}
            for row in plan_rows
        ],
    }


@router.get("/users")
async def admin_users(
    request: Request,
    search: str | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """Paginated user list with profile and agency context."""
    base = (
        select(User)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
    )
    count_q = (
        select(func.count(func.distinct(User.id)))
        .select_from(User)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
    )
    if search:
        like = f"%{search.lower()}%"
        condition = or_(
            func.lower(User.email).like(like),
            func.lower(StudentProfile.name).like(like),
            func.lower(StudentProfile.university).like(like),
        )
        base = base.where(condition)
        count_q = count_q.where(condition)

    total = await db.scalar(count_q) or 0
    rows = await db.execute(
        select(
            User.id,
            User.email,
            User.role,
            User.telegram_username,
            User.created_at,
            StudentProfile.name,
            StudentProfile.university,
            StudentProfile.country,
            Agency.name.label("agency_name"),
            AgencyMember.name.label("manager_name"),
        )
        .select_from(User)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .outerjoin(AgencyStudent, AgencyStudent.user_id == User.id)
        .outerjoin(Agency, Agency.id == AgencyStudent.agency_id)
        .outerjoin(AgencyMember, AgencyMember.id == AgencyStudent.assigned_manager_id)
        .where(*base._where_criteria)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return {
        "total": total,
        "users": [
            {
                "id": row.id,
                "email": row.email,
                "role": row.role,
                "name": row.name,
                "university": row.university,
                "country": row.country,
                "agency_name": row.agency_name,
                "manager_name": row.manager_name,
                "telegram_username": row.telegram_username,
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ],
    }


@router.get("/agencies")
async def admin_agencies(
    request: Request,
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """Agency list with ownership-level operational counts."""
    members = (
        select(
            AgencyMember.agency_id.label("agency_id"),
            func.count().label("members_count"),
            func.sum(case((AgencyMember.role == "manager", 1), else_=0)).label("managers_count"),
            func.sum(case((AgencyMember.status == "invited", 1), else_=0)).label("pending_invites"),
        )
        .group_by(AgencyMember.agency_id)
        .subquery()
    )
    students = (
        select(
            AgencyStudent.agency_id.label("agency_id"),
            func.count().label("students_count"),
            func.sum(case((AgencyStudent.assigned_manager_id.is_(None), 1), else_=0)).label("unassigned_count"),
        )
        .where(AgencyStudent.status == "active")
        .group_by(AgencyStudent.agency_id)
        .subquery()
    )

    total = await _count(db, Agency)
    rows = await db.execute(
        select(
            Agency.id,
            Agency.name,
            Agency.email,
            Agency.country,
            Agency.contact_phone,
            Agency.subscription_plan,
            Agency.white_label_enabled,
            Agency.created_at,
            members.c.members_count,
            members.c.managers_count,
            members.c.pending_invites,
            students.c.students_count,
            students.c.unassigned_count,
        )
        .outerjoin(members, members.c.agency_id == Agency.id)
        .outerjoin(students, students.c.agency_id == Agency.id)
        .order_by(Agency.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return {
        "total": total,
        "agencies": [
            {
                "id": row.id,
                "name": row.name,
                "email": row.email,
                "country": row.country,
                "contact_phone": row.contact_phone,
                "subscription_plan": row.subscription_plan,
                "white_label_enabled": row.white_label_enabled,
                "members_count": row.members_count or 0,
                "managers_count": row.managers_count or 0,
                "pending_invites": row.pending_invites or 0,
                "students_count": row.students_count or 0,
                "unassigned_count": row.unassigned_count or 0,
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ],
    }


@router.get("/managers")
async def admin_managers(
    request: Request,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """Agency members across every agency."""
    students = (
        select(
            AgencyStudent.assigned_manager_id.label("member_id"),
            func.count().label("students_count"),
        )
        .where(AgencyStudent.status == "active")
        .group_by(AgencyStudent.assigned_manager_id)
        .subquery()
    )
    filters = []
    if status_filter:
        filters.append(AgencyMember.status == status_filter)

    total_q = select(func.count()).select_from(AgencyMember)
    for condition in filters:
        total_q = total_q.where(condition)
    total = await db.scalar(total_q) or 0

    rows = await db.execute(
        select(
            AgencyMember.id,
            AgencyMember.role,
            AgencyMember.name,
            AgencyMember.email,
            AgencyMember.status,
            AgencyMember.joined_at,
            AgencyMember.last_login,
            AgencyMember.created_at,
            Agency.name.label("agency_name"),
            students.c.students_count,
        )
        .select_from(AgencyMember)
        .join(Agency, Agency.id == AgencyMember.agency_id)
        .outerjoin(students, students.c.member_id == AgencyMember.id)
        .where(*filters)
        .order_by(AgencyMember.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return {
        "total": total,
        "members": [
            {
                "id": row.id,
                "role": row.role,
                "name": row.name,
                "email": row.email,
                "status": row.status,
                "agency_name": row.agency_name,
                "students_count": row.students_count or 0,
                "joined_at": _iso(row.joined_at),
                "last_login": _iso(row.last_login),
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ],
    }


@router.get("/analytics")
async def admin_analytics(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Global activity, product usage, and funnel metrics."""
    now = datetime.utcnow()
    since = now - timedelta(days=13)
    dates = [(now.date() - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]

    user_counts = await _daily_counts(db, User.created_at, since)
    chat_counts = await _daily_counts(db, ChatMessage.created_at, since, ChatMessage.role == "user")
    simulator_counts = await _daily_counts(db, SimulatorSession.created_at, since)
    event_counts = await _daily_counts(db, AnalyticsEvent.created_at, since)

    top_event_rows = await db.execute(
        select(AnalyticsEvent.event, func.count().label("count"))
        .group_by(AnalyticsEvent.event)
        .order_by(func.count().desc())
        .limit(8)
    )

    return {
        "activity_14d": [
            {
                "date": date,
                "registrations": user_counts.get(date, 0),
                "chat_questions": chat_counts.get(date, 0),
                "simulator_sessions": simulator_counts.get(date, 0),
                "events": event_counts.get(date, 0),
            }
            for date in dates
        ],
        "funnel": {
            "registered_users": await _count(db, User),
            "completed_profiles": await _count(db, StudentProfile),
            "chat_users": await _distinct_count(db, ChatMessage.user_id),
            "simulator_users": await _distinct_count(db, SimulatorSession.user_id),
            "document_users": await _distinct_count(db, DocumentProgress.user_id),
            "roadmap_users": await _distinct_count(db, RoadmapProgress.user_id),
            "agency_students": await _distinct_count(db, AgencyStudent.user_id),
        },
        "product_usage": {
            "chat_messages": await _count(db, ChatMessage),
            "user_chat_questions": await _count(db, ChatMessage, ChatMessage.role == "user"),
            "simulator_sessions": await _count(db, SimulatorSession),
            "completed_simulator_sessions": await _count(
                db,
                SimulatorSession,
                SimulatorSession.completed.is_(True),
            ),
            "completed_documents": await _count(
                db,
                DocumentProgress,
                DocumentProgress.completed.is_(True),
            ),
            "completed_roadmap_steps": await _count(
                db,
                RoadmapProgress,
                RoadmapProgress.status == "completed",
            ),
            "completed_after_visa_sections": await _count(
                db,
                AfterVisaProgress,
                AfterVisaProgress.completed.is_(True),
            ),
            "emergency_sessions": await _count(db, EmergencySession),
            "analytics_events": await _count(db, AnalyticsEvent),
        },
        "top_events": [
            {"event": row.event, "count": row.count}
            for row in top_event_rows
        ],
        "retention": await _compute_weekly_retention(db),
    }


@router.get("/system")
async def admin_system(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Non-secret system health and configuration summary."""
    last_run = await db.scalar(
        select(ScraperRun).order_by(ScraperRun.started_at.desc()).limit(1)
    )
    try:
        from scraper.scheduler import get_scheduler
        scheduler = get_scheduler()
        job = scheduler.get_job("monthly_kb_update")
        next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
        scheduler_running = scheduler.running
    except Exception:
        next_run = None
        scheduler_running = False

    return {
        "server_time": datetime.utcnow().isoformat(),
        "database_provider": settings.DATABASE_URL.split(":", 1)[0],
        "admin_secret_configured": bool(settings.ADMIN_SECRET),
        "ai_provider": settings.AI_PROVIDER,
        "ai_model": settings.AI_MODEL or "provider default",
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "groq_configured": bool(settings.GROQ_API_KEY),
        "telegram_configured": bool(settings.TELEGRAM_BOT_TOKEN),
        "notification_secret_configured": bool(settings.NOTIFICATION_SECRET),
        "frontend_url": settings.FRONTEND_URL,
        "allowed_origins": settings.ALLOWED_ORIGINS,
        "scheduler_running": scheduler_running,
        "next_scraper_run": next_run,
        "knowledge_base_entries": await _count(db, KnowledgeBase),
        "last_scraper_run": {
            "status": last_run.status,
            "started_at": _iso(last_run.started_at),
            "completed_at": _iso(last_run.completed_at),
            "sources_scraped": last_run.sources_scraped,
            "new_entries_added": last_run.new_entries_added,
            "error_message": last_run.error_message,
        } if last_run else None,
    }


# ─── Scraper endpoints ───────────────────────────────────────────────────────

@router.post("/scraper/run-now", status_code=202)
async def run_scraper_now(
    request: Request,
    admin_user: User = Depends(get_current_user),
):
    """Manually trigger the scraping pipeline in the background."""
    _audit_admin_action("scraper.run-now", admin_user)
    run_id = str(uuid.uuid4())

    # Import here to avoid circular deps at module load
    import asyncio
    from scraper.pipeline import run_scraping_pipeline

    task = asyncio.create_task(run_scraping_pipeline(run_id=run_id))
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)

    return {"status": "started", "run_id": run_id}


@router.get("/scraper/status")
async def scraper_status(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Return last run stats, next scheduled run, KB size."""
    last_run = await db.scalar(
        select(ScraperRun).order_by(ScraperRun.started_at.desc()).limit(1)
    )

    kb_size = await db.scalar(select(func.count()).select_from(KnowledgeBase))

    try:
        from scraper.scheduler import get_scheduler
        scheduler = get_scheduler()
        job = scheduler.get_job("monthly_kb_update")
        next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    except Exception:
        next_run = None

    return {
        "knowledge_base_size": kb_size or 0,
        "next_scheduled_run": next_run,
        "last_run": {
            "id": last_run.id,
            "started_at": last_run.started_at.isoformat(),
            "completed_at": last_run.completed_at.isoformat() if last_run.completed_at else None,
            "status": last_run.status,
            "sources_scraped": last_run.sources_scraped,
            "new_entries_added": last_run.new_entries_added,
            "error_message": last_run.error_message,
        } if last_run else None,
    }


@router.get("/scraper/logs")
async def scraper_logs(
    request: Request,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Return history of pipeline runs."""
    rows = await db.execute(
        select(ScraperRun).order_by(ScraperRun.started_at.desc()).limit(limit)
    )
    runs = rows.scalars().all()

    return {
        "runs": [
            {
                "id": r.id,
                "started_at": r.started_at.isoformat(),
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "status": r.status,
                "sources_scraped": r.sources_scraped,
                "new_entries_added": r.new_entries_added,
                "error_message": r.error_message,
            }
            for r in runs
        ]
    }


# ─── Knowledge base endpoints ────────────────────────────────────────────────

@router.get("/knowledge-base")
async def list_knowledge_base(
    request: Request,
    category: str | None = Query(None),
    trust_level: str | None = Query(None),
    verified: bool | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of KB entries with optional filters."""
    q = select(KnowledgeBase).order_by(KnowledgeBase.created_at.desc())
    if category:
        q = q.where(KnowledgeBase.category == category)
    if trust_level:
        q = q.where(KnowledgeBase.trust_level == trust_level)
    if verified is not None:
        q = q.where(KnowledgeBase.verified == verified)

    total = await db.scalar(
        select(func.count()).select_from(q.subquery())
    )
    rows = await db.execute(q.limit(limit).offset(offset))
    entries = rows.scalars().all()

    # Stats by trust level
    stats_rows = await db.execute(
        select(KnowledgeBase.trust_level, func.count())
        .group_by(KnowledgeBase.trust_level)
    )
    stats = {row[0]: row[1] for row in stats_rows}

    return {
        "total": total,
        "entries": [
            {
                "id": e.id,
                "category": e.category,
                "question": e.question,
                "answer": e.answer,
                "trust_level": e.trust_level,
                "source_url": e.source_url,
                "created_at": e.created_at.isoformat(),
                "verified": e.verified,
            }
            for e in entries
        ],
        "stats_by_trust": stats,
    }


@router.patch("/knowledge-base/{entry_id}/verify")
async def verify_entry(
    request: Request,
    entry_id: str,
    admin_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a KB entry as manually verified."""
    _audit_admin_action("knowledge-base.verify", admin_user, entry_id=entry_id)
    entry = await db.get(KnowledgeBase, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.verified = True
    await db.commit()
    return {"id": entry_id, "verified": True}


@router.delete("/knowledge-base/{entry_id}")
async def delete_entry(
    request: Request,
    entry_id: str,
    admin_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a KB entry (e.g. bad data from scraper)."""
    _audit_admin_action("knowledge-base.delete", admin_user, entry_id=entry_id)
    entry = await db.get(KnowledgeBase, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": entry_id}
