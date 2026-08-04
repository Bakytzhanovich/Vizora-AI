import json
import os
import secrets
import uuid
from datetime import datetime

import bcrypt
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.agency_auth import AgencyCtx, create_member_token, get_current_member, require_admin
from app.core.database import get_db
from app.models.agency import Agency, AgencyMember, AgencyStudent
from app.models.chat import ChatMessage
from app.models.documents import DocumentProgress
from app.models.profile import StudentProfile
from app.models.roadmap import RoadmapProgress
from app.models.simulator import SimulatorSession
from app.models.user import User
from app.services.roadmap_service import _PROGRESS_WEIGHTS
from app.services.subscription_service import get_agency_billing_status
from app.services.subscription_service import set_free_plan

router = APIRouter(prefix="/agency", tags=["agency"])

# ─── Internal helpers ─────────────────────────────────────────────────────────

async def _get_student_last_active(db: AsyncSession, user_id: str) -> datetime | None:
    result = await db.execute(
        text("""
            SELECT MAX(ts) FROM (
                SELECT created_at AS ts FROM chat_messages WHERE user_id = :uid
                UNION ALL
                SELECT created_at AS ts FROM simulator_sessions WHERE user_id = :uid
                UNION ALL
                SELECT updated_at AS ts FROM document_progress WHERE user_id = :uid
            )
        """),
        {"uid": user_id},
    )
    return result.scalar()


async def _get_student_readiness(db: AsyncSession, user_id: str) -> int:
    rows = await db.execute(
        select(RoadmapProgress.step_id).where(
            RoadmapProgress.user_id == user_id,
            RoadmapProgress.status == "completed",
        )
    )
    completed = {r[0] for r in rows.fetchall()}
    completed.add("profile")

    doc_completed = await db.scalar(
        select(func.count()).where(
            DocumentProgress.user_id == user_id,
            DocumentProgress.completed == True,
        )
    )
    if doc_completed and doc_completed >= 9:
        completed.add("documents")

    return sum(w for sid, w in _PROGRESS_WEIGHTS.items() if sid in completed)


async def _get_doc_progress_pct(db: AsyncSession, user_id: str) -> int:
    completed = await db.scalar(
        select(func.count()).where(
            DocumentProgress.user_id == user_id,
            DocumentProgress.completed == True,
        )
    )
    return min(100, round((completed or 0) / 9 * 100))


async def _get_simulator_stats(db: AsyncSession, user_id: str) -> tuple[int, float]:
    rows = await db.execute(
        select(SimulatorSession.scores).where(
            SimulatorSession.user_id == user_id,
            SimulatorSession.completed == True,
        )
    )
    sessions = rows.fetchall()
    count = len(sessions)
    if count == 0:
        return 0, 0.0
    total = 0.0
    valid = 0
    for (scores_json,) in sessions:
        if scores_json:
            try:
                scores = json.loads(scores_json)
                avg = sum(scores.values()) / len(scores) if scores else 0
                total += avg
                valid += 1
            except Exception:
                pass
    return count, round(total / valid, 1) if valid else 0.0


async def _get_or_create_admin_member(db: AsyncSession, agency: Agency) -> AgencyMember:
    member = await db.scalar(
        select(AgencyMember).where(
            AgencyMember.agency_id == agency.id,
            AgencyMember.role == "admin",
        )
    )
    if not member:
        member = AgencyMember(
            agency_id=agency.id,
            role="admin",
            name=agency.name,
            email=agency.email,
            status="active",
            joined_at=agency.created_at,
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)
    return member


async def _get_member_user_ids(db: AsyncSession, ctx: AgencyCtx) -> list[str]:
    cond = [AgencyStudent.agency_id == ctx.agency_id]
    if ctx.role == "manager" and ctx.member_id:
        cond.append(AgencyStudent.assigned_manager_id == ctx.member_id)
    result = await db.execute(select(AgencyStudent.user_id).where(*cond))
    return [r[0] for r in result.fetchall()]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AgencyRegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    country: str
    contact_phone: str | None = None


class AgencyLoginBody(BaseModel):
    email: EmailStr
    password: str


class AddStudentBody(BaseModel):
    email: str
    name: str


class BulkStudent(BaseModel):
    email: str
    name: str


class BulkAddBody(BaseModel):
    students: list[BulkStudent]


class UpdateSettingsBody(BaseModel):
    name: str | None = None
    contact_phone: str | None = None
    white_label_name: str | None = None


# ─── Auth ─────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def agency_register(body: AgencyRegisterBody, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(Agency).where(Agency.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    agency = Agency(
        name=body.name,
        email=body.email,
        password_hash=hashed,
        country=body.country,
        contact_phone=body.contact_phone,
    )
    db.add(agency)
    await db.flush()

    member = AgencyMember(
        agency_id=agency.id,
        role="admin",
        name=body.name,
        email=body.email,
        status="active",
        joined_at=datetime.utcnow(),
        last_login=datetime.utcnow(),
    )
    db.add(member)
    await db.commit()
    await db.refresh(agency)
    await db.refresh(member)

    token = create_member_token(agency.id, member.id, "admin")
    return {
        "agency_token": token,
        "agency_id": agency.id,
        "member_id": member.id,
        "role": "admin",
        "name": agency.name,
    }


@router.post("/login")
async def agency_login(body: AgencyLoginBody, db: AsyncSession = Depends(get_db)):
    # Try Agency owner login first
    agency = await db.scalar(select(Agency).where(Agency.email == body.email))
    if agency and bcrypt.checkpw(body.password.encode(), agency.password_hash.encode()):
        member = await _get_or_create_admin_member(db, agency)
        member.last_login = datetime.utcnow()
        db.add(member)
        await db.commit()
        token = create_member_token(agency.id, member.id, "admin")
        return {
            "agency_token": token,
            "agency_id": agency.id,
            "member_id": member.id,
            "role": "admin",
            "name": agency.name,
            "member_name": member.name,
            "subscription_plan": agency.subscription_plan,
        }

    # Try AgencyMember (manager) login
    member = await db.scalar(
        select(AgencyMember).where(
            AgencyMember.email == body.email,
            AgencyMember.status == "active",
        )
    )
    if member and member.password_hash and bcrypt.checkpw(body.password.encode(), member.password_hash.encode()):
        agency = await db.get(Agency, member.agency_id)
        member.last_login = datetime.utcnow()
        db.add(member)
        await db.commit()
        token = create_member_token(member.agency_id, member.id, member.role)
        return {
            "agency_token": token,
            "agency_id": member.agency_id,
            "member_id": member.id,
            "role": member.role,
            "name": agency.name if agency else "",
            "member_name": member.name,
            "subscription_plan": agency.subscription_plan if agency else "trial",
        }

    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/me")
async def agency_me(
    ctx: AgencyCtx = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    agency = await db.get(Agency, ctx.agency_id)
    if not agency:
        raise HTTPException(status_code=404)

    if ctx.role == "manager" and ctx.member_id:
        total = await db.scalar(
            select(func.count()).where(
                AgencyStudent.agency_id == ctx.agency_id,
                AgencyStudent.assigned_manager_id == ctx.member_id,
            )
        )
    else:
        total = await db.scalar(
            select(func.count()).where(AgencyStudent.agency_id == ctx.agency_id)
        )

    member_name = agency.name
    if ctx.member_id:
        member = await db.get(AgencyMember, ctx.member_id)
        if member:
            member_name = member.name

    return {
        "id": agency.id,
        "name": agency.name,
        "member_name": member_name,
        "email": agency.email,
        "country": agency.country,
        "contact_phone": agency.contact_phone,
        "billing": get_agency_billing_status(agency),
        "white_label_name": agency.white_label_name,
        "white_label_logo_url": agency.white_label_logo_url,
        "white_label_primary_color": agency.white_label_primary_color,
        "white_label_enabled": agency.white_label_enabled,
        "student_count": total or 0,
        "created_at": agency.created_at.isoformat(),
        "role": ctx.role,
        "member_id": ctx.member_id,
    }


# ─── Student management ───────────────────────────────────────────────────────

@router.post("/students/add", status_code=201)
async def add_student(
    body: AddStudentBody,
    ctx: AgencyCtx = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user:
        temp_password = secrets.token_urlsafe(12)
        hashed = bcrypt.hashpw(temp_password.encode(), bcrypt.gensalt()).decode()
        user = User(email=body.email, password_hash=hashed)
        set_free_plan(user)
        db.add(user)
        await db.flush()

        profile = StudentProfile(
            user_id=user.id,
            name=body.name,
            university="",
            course_year=1,
            profession="",
            english_level="medium",
            travel_history=False,
            financial_source="self",
            job_offer="no",
            country="KZ",
            via_agency=True,
        )
        db.add(profile)

    existing_link = await db.scalar(
        select(AgencyStudent).where(
            AgencyStudent.agency_id == ctx.agency_id,
            AgencyStudent.user_id == user.id,
        )
    )
    if existing_link:
        raise HTTPException(status_code=409, detail="Student already linked to this agency")

    assigned_manager = ctx.member_id if ctx.role == "manager" else None
    link = AgencyStudent(
        agency_id=ctx.agency_id,
        user_id=user.id,
        assigned_manager_id=assigned_manager,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    invite_link = f"http://localhost:3000/login?email={body.email}"
    return {"student_id": user.id, "invite_link": invite_link}


@router.post("/students/bulk-add")
async def bulk_add_students(
    body: BulkAddBody,
    ctx: AgencyCtx = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    results = []
    assigned_manager = ctx.member_id if ctx.role == "manager" else None
    for s in body.students:
        try:
            user = await db.scalar(select(User).where(User.email == s.email))
            if not user:
                temp_password = secrets.token_urlsafe(12)
                hashed = bcrypt.hashpw(temp_password.encode(), bcrypt.gensalt()).decode()
                user = User(email=s.email, password_hash=hashed)
                set_free_plan(user)
                db.add(user)
                await db.flush()

                profile = StudentProfile(
                    user_id=user.id,
                    name=s.name,
                    university="",
                    course_year=1,
                    profession="",
                    english_level="medium",
                    travel_history=False,
                    financial_source="self",
                    job_offer="no",
                    country="KZ",
                    via_agency=True,
                )
                db.add(profile)

            existing = await db.scalar(
                select(AgencyStudent).where(
                    AgencyStudent.agency_id == ctx.agency_id,
                    AgencyStudent.user_id == user.id,
                )
            )
            if not existing:
                link = AgencyStudent(
                    agency_id=ctx.agency_id,
                    user_id=user.id,
                    assigned_manager_id=assigned_manager,
                )
                db.add(link)
                results.append({"email": s.email, "status": "added"})
            else:
                results.append({"email": s.email, "status": "already_linked"})
        except Exception as e:
            results.append({"email": s.email, "status": "error", "detail": str(e)})

    await db.commit()
    added = sum(1 for r in results if r["status"] == "added")
    return {"added": added, "total": len(results), "results": results}


@router.get("/students")
async def list_students(
    search: str = "",
    sort: str = "name",
    manager_filter: str = "",
    ctx: AgencyCtx = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    base_cond = [AgencyStudent.agency_id == ctx.agency_id]

    if ctx.role == "manager" and ctx.member_id:
        base_cond.append(AgencyStudent.assigned_manager_id == ctx.member_id)
    elif ctx.role == "admin":
        if manager_filter == "unassigned":
            base_cond.append(AgencyStudent.assigned_manager_id.is_(None))
        elif manager_filter and manager_filter != "all":
            base_cond.append(AgencyStudent.assigned_manager_id == manager_filter)

    links_result = await db.execute(select(AgencyStudent).where(*base_cond))
    links = links_result.scalars().all()
    user_ids = [l.user_id for l in links]
    link_map = {l.user_id: l for l in links}

    if not user_ids:
        return {"students": [], "total": 0}

    # Load manager names
    manager_ids = {l.assigned_manager_id for l in links if l.assigned_manager_id}
    members_map: dict[str, str] = {}
    if manager_ids:
        mem_rows = await db.execute(
            select(AgencyMember.id, AgencyMember.name).where(AgencyMember.id.in_(manager_ids))
        )
        members_map = {row[0]: row[1] for row in mem_rows.fetchall()}

    profiles_rows = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id.in_(user_ids))
    )
    profiles_map: dict[str, StudentProfile] = {p.user_id: p for p in profiles_rows.scalars().all()}

    users_rows = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map: dict[str, User] = {u.id: u for u in users_rows.scalars().all()}

    sim_data: dict[str, tuple[int, float]] = {}
    for uid in user_ids:
        sim_data[uid] = await _get_simulator_stats(db, uid)

    doc_rows = await db.execute(
        select(DocumentProgress.user_id, func.count(DocumentProgress.id)).where(
            DocumentProgress.user_id.in_(user_ids),
            DocumentProgress.completed == True,
        ).group_by(DocumentProgress.user_id)
    )
    doc_map = {r[0]: min(100, round(r[1] / 9 * 100)) for r in doc_rows.fetchall()}

    rp_rows = await db.execute(
        select(RoadmapProgress.user_id, RoadmapProgress.step_id).where(
            RoadmapProgress.user_id.in_(user_ids),
            RoadmapProgress.status == "completed",
        )
    )
    rp_map: dict[str, set[str]] = {}
    for uid, sid in rp_rows.fetchall():
        rp_map.setdefault(uid, set()).add(sid)

    today = datetime.utcnow().date()
    students = []
    for uid in user_ids:
        profile = profiles_map.get(uid)
        user = users_map.get(uid)
        if not user:
            continue

        name = profile.name if profile else user.email.split("@")[0]
        university = profile.university if profile else ""
        interview_date = str(profile.interview_date) if profile and profile.interview_date else None

        completed_steps = rp_map.get(uid, set()) | {"profile"}
        doc_pct = doc_map.get(uid, 0)
        if doc_pct >= 100:
            completed_steps.add("documents")
        readiness = sum(w for sid, w in _PROGRESS_WEIGHTS.items() if sid in completed_steps)

        sim_count, sim_avg = sim_data.get(uid, (0, 0.0))
        last_active = await _get_student_last_active(db, uid)

        if search and search.lower() not in name.lower() and search.lower() not in user.email.lower():
            continue

        days_until = None
        if interview_date:
            try:
                iv = datetime.strptime(interview_date, "%Y-%m-%d").date()
                days_until = (iv - today).days
            except Exception:
                pass

        link = link_map.get(uid)
        assigned_manager_id = link.assigned_manager_id if link else None

        students.append({
            "id": uid,
            "email": user.email,
            "name": name,
            "university": university,
            "readiness": readiness,
            "documents_pct": doc_pct,
            "simulator_sessions": sim_count,
            "simulator_avg_score": sim_avg,
            "interview_date": interview_date,
            "days_until_interview": days_until,
            "last_active": last_active.isoformat() if last_active else None,
            "assigned_manager_id": assigned_manager_id,
            "assigned_manager_name": members_map.get(assigned_manager_id) if assigned_manager_id else None,
        })

    if sort == "readiness":
        students.sort(key=lambda s: s["readiness"], reverse=True)
    elif sort == "interview_date":
        students.sort(key=lambda s: (s["interview_date"] is None, s["interview_date"]))
    else:
        students.sort(key=lambda s: s["name"].lower())

    return {"students": students, "total": len(students)}


@router.get("/students/{student_id}")
async def get_student(
    student_id: str,
    ctx: AgencyCtx = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    cond = [
        AgencyStudent.agency_id == ctx.agency_id,
        AgencyStudent.user_id == student_id,
    ]
    if ctx.role == "manager" and ctx.member_id:
        cond.append(AgencyStudent.assigned_manager_id == ctx.member_id)

    link = await db.scalar(select(AgencyStudent).where(*cond))
    if not link:
        raise HTTPException(status_code=404, detail="Student not found")

    user = await db.get(User, student_id)
    profile = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == student_id)
    )
    if not user:
        raise HTTPException(status_code=404)

    rp_rows = await db.execute(
        select(RoadmapProgress).where(RoadmapProgress.user_id == student_id)
    )
    roadmap_rows = rp_rows.scalars().all()
    completed_steps = {r.step_id for r in roadmap_rows if r.status == "completed"}
    completed_steps.add("profile")

    doc_pct = await _get_doc_progress_pct(db, student_id)
    if doc_pct >= 100:
        completed_steps.add("documents")

    readiness = sum(w for sid, w in _PROGRESS_WEIGHTS.items() if sid in completed_steps)
    sim_count, sim_avg = await _get_simulator_stats(db, student_id)

    score_breakdown = {"confidence": 0.0, "language": 0.0, "content": 0.0}
    sim_rows = await db.execute(
        select(SimulatorSession.scores).where(
            SimulatorSession.user_id == student_id,
            SimulatorSession.completed == True,
            SimulatorSession.scores.isnot(None),
        )
    )
    score_data = sim_rows.fetchall()
    if score_data:
        totals: dict[str, float] = {}
        for (scores_json,) in score_data:
            try:
                scores = json.loads(scores_json)
                for k, v in scores.items():
                    totals[k] = totals.get(k, 0) + v
            except Exception:
                pass
        if totals:
            n = len(score_data)
            score_breakdown = {k: round(v / n, 1) for k, v in totals.items()}

    last_active = await _get_student_last_active(db, student_id)

    risk_profile = []
    if profile and profile.risk_profile:
        try:
            risk_profile = json.loads(profile.risk_profile)
        except Exception:
            pass

    return {
        "student": {
            "id": student_id,
            "email": user.email,
            "name": profile.name if profile else user.email.split("@")[0],
            "university": profile.university if profile else "",
            "course_year": profile.course_year if profile else 1,
            "english_level": profile.english_level if profile else "medium",
            "country": profile.country if profile else "KZ",
            "interview_date": str(profile.interview_date) if profile and profile.interview_date else None,
            "financial_source": profile.financial_source if profile else "self",
            "travel_history": profile.travel_history if profile else False,
            "via_agency": profile.via_agency if profile else True,
            "added_at": link.added_at.isoformat(),
        },
        "readiness": readiness,
        "documents_pct": doc_pct,
        "simulator_sessions": sim_count,
        "simulator_avg_score": sim_avg,
        "simulator_scores": score_breakdown,
        "risk_profile": risk_profile,
        "roadmap_completed": sorted(completed_steps),
        "last_active": last_active.isoformat() if last_active else None,
    }


# ─── Analytics ───────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics(
    ctx: AgencyCtx = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    user_ids = await _get_member_user_ids(db, ctx)
    total = len(user_ids)

    # Count unassigned students (admin sees these as a metric)
    unassigned_count = 0
    if ctx.role == "admin":
        unassigned_count = await db.scalar(
            select(func.count()).where(
                AgencyStudent.agency_id == ctx.agency_id,
                AgencyStudent.assigned_manager_id.is_(None),
            )
        ) or 0

    if total == 0:
        return {
            "total_students": 0,
            "active_today": 0,
            "avg_readiness": 0,
            "sim_sessions_total": 0,
            "readiness_distribution": {"high": 0, "medium": 0, "low": 0},
            "weak_topics": [],
            "weekly_activity": [],
            "unassigned_students": unassigned_count,
        }

    today = datetime.utcnow().date()

    active_today = 0
    for uid in user_ids:
        last = await _get_student_last_active(db, uid)
        if last and last.date() == today:
            active_today += 1

    readiness_vals = []
    for uid in user_ids:
        r = await _get_student_readiness(db, uid)
        readiness_vals.append(r)

    avg_readiness = round(sum(readiness_vals) / total) if readiness_vals else 0
    dist = {"high": 0, "medium": 0, "low": 0}
    for r in readiness_vals:
        if r >= 70:
            dist["high"] += 1
        elif r >= 40:
            dist["medium"] += 1
        else:
            dist["low"] += 1

    sim_total = await db.scalar(
        select(func.count(SimulatorSession.id)).where(
            SimulatorSession.user_id.in_(user_ids),
            SimulatorSession.completed == True,
        )
    )

    topic_sums: dict[str, float] = {}
    topic_counts: dict[str, int] = {}
    score_rows = await db.execute(
        select(SimulatorSession.scores).where(
            SimulatorSession.user_id.in_(user_ids),
            SimulatorSession.completed == True,
            SimulatorSession.scores.isnot(None),
        )
    )
    for (scores_json,) in score_rows.fetchall():
        try:
            scores = json.loads(scores_json)
            for k, v in scores.items():
                topic_sums[k] = topic_sums.get(k, 0) + v
                topic_counts[k] = topic_counts.get(k, 0) + 1
        except Exception:
            pass

    topic_label_map = {
        "confidence": "Уверенность",
        "language": "Английский язык",
        "content": "Содержание ответов",
    }
    weak_topics = []
    for k, label in topic_label_map.items():
        if k in topic_sums and topic_counts[k] > 0:
            avg = round(topic_sums[k] / topic_counts[k], 1)
            weak_topics.append({"topic": label, "avg_score": avg, "key": k})
    weak_topics.sort(key=lambda x: x["avg_score"])

    from datetime import timedelta
    week_start = datetime.utcnow() - timedelta(days=6)
    chat_rows = await db.execute(
        select(ChatMessage.user_id, ChatMessage.created_at).where(
            ChatMessage.user_id.in_(user_ids),
            ChatMessage.created_at >= week_start,
        )
    )
    sim_rows2 = await db.execute(
        select(SimulatorSession.user_id, SimulatorSession.created_at).where(
            SimulatorSession.user_id.in_(user_ids),
            SimulatorSession.created_at >= week_start,
        )
    )
    activity_by_day: dict[str, set[str]] = {}
    for uid, ts in list(chat_rows.fetchall()) + list(sim_rows2.fetchall()):
        day_key = str(ts.date())
        activity_by_day.setdefault(day_key, set()).add(uid)

    weekly = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        weekly.append({"date": str(day), "active_users": len(activity_by_day.get(str(day), set()))})

    return {
        "total_students": total,
        "active_today": active_today,
        "avg_readiness": avg_readiness,
        "sim_sessions_total": sim_total or 0,
        "readiness_distribution": dist,
        "weak_topics": weak_topics,
        "weekly_activity": weekly,
        "unassigned_students": unassigned_count,
    }


@router.get("/alerts")
async def get_alerts(
    ctx: AgencyCtx = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    user_ids = await _get_member_user_ids(db, ctx)

    alerts = []
    today = datetime.utcnow().date()

    for uid in user_ids:
        profile = await db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == uid)
        )
        name = profile.name if profile else uid[:8]

        if profile and profile.interview_date:
            days_until = (profile.interview_date - today).days
            sim_count, _ = await _get_simulator_stats(db, uid)
            if 0 < days_until <= 3 and sim_count == 0:
                alerts.append({
                    "student_id": uid,
                    "student_name": name,
                    "type": "critical",
                    "message": f"Интервью через {days_until} дн., симулятор не запускался ни разу",
                })
            elif 0 < days_until <= 7 and sim_count < 3:
                alerts.append({
                    "student_id": uid,
                    "student_name": name,
                    "type": "warning",
                    "message": f"Интервью через {days_until} дн., мало тренировок ({sim_count})",
                })

        last_active = await _get_student_last_active(db, uid)
        if not last_active:
            alerts.append({
                "student_id": uid,
                "student_name": name,
                "type": "warning",
                "message": "Ни разу не заходил в систему",
            })
        elif (today - last_active.date()).days >= 7:
            days_ago = (today - last_active.date()).days
            alerts.append({
                "student_id": uid,
                "student_name": name,
                "type": "warning",
                "message": f"Не активен {days_ago} дн.",
            })

        sim_count, sim_avg = await _get_simulator_stats(db, uid)
        if sim_count >= 2 and sim_avg < 5.0:
            alerts.append({
                "student_id": uid,
                "student_name": name,
                "type": "warning",
                "message": f"Средний балл симулятора низкий: {sim_avg}/10",
            })

    alerts.sort(key=lambda a: 0 if a["type"] == "critical" else 1)
    return {"alerts": alerts[:20]}


# ─── Settings ─────────────────────────────────────────────────────────────────

@router.put("/settings")
async def update_settings(
    body: UpdateSettingsBody,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    agency = await db.get(Agency, ctx.agency_id)
    if not agency:
        raise HTTPException(status_code=404)

    if body.name is not None:
        agency.name = body.name
    if body.contact_phone is not None:
        agency.contact_phone = body.contact_phone
    if body.white_label_name is not None:
        agency.white_label_name = body.white_label_name

    db.add(agency)
    await db.commit()
    return {"ok": True}


# ─── White-label ─────────────────────────────────────────────────────────────

class WhiteLabelBody(BaseModel):
    white_label_name: str
    primary_color: str | None = None
    enabled: bool


@router.post("/white-label")
async def update_white_label(
    body: WhiteLabelBody,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    agency = await db.get(Agency, ctx.agency_id)
    if not agency:
        raise HTTPException(status_code=404)

    color = body.primary_color or "#6C63FF"
    if color and (not color.startswith("#") or len(color) not in (4, 7)):
        raise HTTPException(status_code=422, detail="Invalid hex color")

    agency.white_label_name = body.white_label_name
    agency.white_label_primary_color = color
    agency.white_label_enabled = body.enabled
    db.add(agency)
    await db.commit()
    await db.refresh(agency)

    return {
        "success": True,
        "agency": {
            "white_label_name": agency.white_label_name,
            "white_label_logo_url": agency.white_label_logo_url,
            "white_label_primary_color": agency.white_label_primary_color,
            "white_label_enabled": agency.white_label_enabled,
        },
    }


_LOGO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "agency-logos")
_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
_MAX_SIZE = 2 * 1024 * 1024


@router.post("/white-label/logo")
async def upload_logo(
    request: Request,
    file: UploadFile = File(...),
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Only PNG/JPG files allowed")

    contents = await file.read()
    if len(contents) > _MAX_SIZE:
        raise HTTPException(status_code=422, detail="File too large (max 2MB)")

    os.makedirs(_LOGO_DIR, exist_ok=True)
    ext = "png" if file.content_type == "image/png" else "jpg"
    filename = f"{ctx.agency_id}.{ext}"
    path = os.path.join(_LOGO_DIR, filename)
    with open(path, "wb") as f:
        f.write(contents)

    base_url = str(request.base_url).rstrip("/")
    logo_url = f"{base_url}/static/agency-logos/{filename}"

    agency = await db.get(Agency, ctx.agency_id)
    if agency:
        agency.white_label_logo_url = logo_url
        db.add(agency)
        await db.commit()

    return {"logo_url": logo_url}
