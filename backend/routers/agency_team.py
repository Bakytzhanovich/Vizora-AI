import secrets
import uuid
from datetime import datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.agency_auth import AgencyCtx, create_member_token, get_current_member, require_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.agency import Agency, AgencyMember, AgencyStudent
from app.models.documents import DocumentProgress
from app.models.profile import StudentProfile
from app.models.roadmap import RoadmapProgress
from app.models.simulator import SimulatorSession
from app.models.user import User
from app.services.roadmap_service import _PROGRESS_WEIGHTS

router = APIRouter(prefix="/agency/team", tags=["agency-team"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _fmt_last_active(dt: datetime | None) -> str | None:
    if not dt:
        return None
    return dt.isoformat()


async def _get_sim_stats(db: AsyncSession, user_id: str) -> tuple[int, float]:
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
            import json
            try:
                scores = json.loads(scores_json)
                avg = sum(scores.values()) / len(scores) if scores else 0
                total += avg
                valid += 1
            except Exception:
                pass
    return count, round(total / valid, 1) if valid else 0.0


async def _get_readiness(db: AsyncSession, user_id: str) -> int:
    rows = await db.execute(
        select(RoadmapProgress.step_id).where(
            RoadmapProgress.user_id == user_id,
            RoadmapProgress.status == "completed",
        )
    )
    completed = {r[0] for r in rows.fetchall()} | {"profile"}
    doc_count = await db.scalar(
        select(func.count()).where(
            DocumentProgress.user_id == user_id,
            DocumentProgress.completed == True,
        )
    ) or 0
    if doc_count >= 9:
        completed.add("documents")
    return sum(w for sid, w in _PROGRESS_WEIGHTS.items() if sid in completed)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class InviteBody(BaseModel):
    email: EmailStr
    name: str
    role: str = "manager"


class UpdateMemberBody(BaseModel):
    role: str | None = None
    status: str | None = None


class JoinBody(BaseModel):
    token: str
    password: str
    name: str


class AssignBody(BaseModel):
    student_ids: list[str]
    manager_id: str


class ResendInviteBody(BaseModel):
    member_id: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
async def get_team(
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    members_result = await db.execute(
        select(AgencyMember).where(AgencyMember.agency_id == ctx.agency_id)
        .order_by(AgencyMember.role.desc(), AgencyMember.created_at)
    )
    members = members_result.scalars().all()

    total_students = await db.scalar(
        select(func.count()).where(AgencyStudent.agency_id == ctx.agency_id)
    ) or 0

    # Single GROUP BY query instead of N per-manager COUNTs
    counts_rows = await db.execute(
        select(AgencyStudent.assigned_manager_id, func.count(AgencyStudent.user_id))
        .where(AgencyStudent.agency_id == ctx.agency_id)
        .group_by(AgencyStudent.assigned_manager_id)
    )
    manager_counts: dict[str, int] = {row[0]: row[1] for row in counts_rows.fetchall() if row[0]}

    pending_invites = sum(1 for m in members if m.status == "invited")

    result = []
    for m in members:
        students_count = total_students if m.role == "admin" else manager_counts.get(m.id, 0)

        result.append({
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "role": m.role,
            "status": m.status,
            "students_count": students_count,
            "last_login": _fmt_last_active(m.last_login),
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            "invited_at": m.invited_at.isoformat() if m.invited_at else None,
        })

    return {
        "members": result,
        "total_members": len(result),
        "total_students": total_students,
        "pending_invites": pending_invites,
    }


@router.post("/invite", status_code=201)
async def invite_member(
    body: InviteBody,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in ("manager",):
        raise HTTPException(status_code=400, detail="Only 'manager' role can be invited")

    existing = await db.scalar(
        select(AgencyMember).where(
            AgencyMember.agency_id == ctx.agency_id,
            AgencyMember.email == body.email,
            AgencyMember.status != "deactivated",
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Member already exists in this agency")

    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(days=7)

    member = AgencyMember(
        agency_id=ctx.agency_id,
        role="manager",
        name=body.name,
        email=body.email,
        invite_token=token,
        invite_token_expires=expires,
        status="invited",
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    invite_link = f"{settings.FRONTEND_URL}/agency/join?token={token}"
    return {
        "success": True,
        "member_id": member.id,
        "invite_link": invite_link,
    }


@router.post("/resend-invite")
async def resend_invite(
    body: ResendInviteBody,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    member = await db.scalar(
        select(AgencyMember).where(
            AgencyMember.id == body.member_id,
            AgencyMember.agency_id == ctx.agency_id,
            AgencyMember.status == "invited",
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail="Invited member not found")

    token = secrets.token_urlsafe(32)
    member.invite_token = token
    member.invite_token_expires = datetime.utcnow() + timedelta(days=7)
    db.add(member)
    await db.commit()

    invite_link = f"{settings.FRONTEND_URL}/agency/join?token={token}"
    return {"success": True, "invite_link": invite_link}


@router.delete("/members/{member_id}")
async def deactivate_member(
    member_id: str,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    member = await db.scalar(
        select(AgencyMember).where(
            AgencyMember.id == member_id,
            AgencyMember.agency_id == ctx.agency_id,
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot deactivate admin")

    # Reassign their students to unassigned
    students_result = await db.execute(
        select(AgencyStudent).where(
            AgencyStudent.agency_id == ctx.agency_id,
            AgencyStudent.assigned_manager_id == member_id,
        )
    )
    students = students_result.scalars().all()
    for s in students:
        s.assigned_manager_id = None
        db.add(s)

    member.status = "deactivated"
    member.invite_token = None
    member.invite_token_expires = None
    db.add(member)
    await db.commit()

    return {"success": True, "reassigned_students": len(students)}


@router.put("/members/{member_id}")
async def update_member(
    member_id: str,
    body: UpdateMemberBody,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    member = await db.scalar(
        select(AgencyMember).where(
            AgencyMember.id == member_id,
            AgencyMember.agency_id == ctx.agency_id,
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "admin":
        raise HTTPException(status_code=403, detail="Нельзя изменить администратора агентства.")

    if body.role and body.role == "manager":
        member.role = body.role
    if body.status == "active":
        if not member.password_hash:
            raise HTTPException(
                status_code=400,
                detail="Невозможно активировать аккаунт без завершённой регистрации. Отправьте новое приглашение.",
            )
        member.status = "active"

    db.add(member)
    await db.commit()
    return {"success": True}


@router.get("/join-info")
async def get_join_info(token: str, db: AsyncSession = Depends(get_db)):
    member = await db.scalar(
        select(AgencyMember).where(AgencyMember.invite_token == token)
    )
    if not member:
        raise HTTPException(status_code=404, detail="Invalid invite token")
    if member.invite_token_expires and datetime.utcnow() > member.invite_token_expires:
        raise HTTPException(status_code=410, detail="Invite token expired")
    if member.status != "invited":
        raise HTTPException(status_code=409, detail="Invitation already used")

    agency = await db.get(Agency, member.agency_id)
    return {
        "agency_name": agency.name if agency else "",
        "invitee_name": member.name,
        "email": member.email,
    }


@router.post("/join")
async def join_agency(body: JoinBody, db: AsyncSession = Depends(get_db)):
    member = await db.scalar(
        select(AgencyMember).where(AgencyMember.invite_token == body.token)
    )
    if not member:
        raise HTTPException(status_code=404, detail="Invalid invite token")
    if member.invite_token_expires and datetime.utcnow() > member.invite_token_expires:
        raise HTTPException(status_code=410, detail="Invite token expired")
    if member.status != "invited":
        raise HTTPException(status_code=409, detail="Invitation already used")
    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    member.password_hash = hashed
    member.name = body.name.strip() or member.name
    member.status = "active"
    member.joined_at = datetime.utcnow()
    member.last_login = datetime.utcnow()
    member.invite_token = None
    member.invite_token_expires = None
    db.add(member)
    await db.commit()
    await db.refresh(member)

    token = create_member_token(member.agency_id, member.id, member.role)
    agency = await db.get(Agency, member.agency_id)
    return {
        "agency_token": token,
        "agency_id": member.agency_id,
        "member_id": member.id,
        "role": member.role,
        "name": agency.name if agency else "",
        "member_name": member.name,
    }


@router.get("/members/{member_id}/students")
async def get_member_students(
    member_id: str,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    member = await db.scalar(
        select(AgencyMember).where(
            AgencyMember.id == member_id,
            AgencyMember.agency_id == ctx.agency_id,
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    links = await db.execute(
        select(AgencyStudent).where(
            AgencyStudent.agency_id == ctx.agency_id,
            AgencyStudent.assigned_manager_id == member_id,
        )
    )
    links = links.scalars().all()
    user_ids = [l.user_id for l in links]

    if not user_ids:
        return {"students": [], "total": 0, "member": {"id": member.id, "name": member.name}}

    profiles_rows = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id.in_(user_ids))
    )
    profiles_map = {p.user_id: p for p in profiles_rows.scalars().all()}

    users_rows = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_rows.scalars().all()}

    today = datetime.utcnow().date()
    students = []
    for uid in user_ids:
        profile = profiles_map.get(uid)
        user = users_map.get(uid)
        if not user:
            continue

        name = profile.name if profile else user.email.split("@")[0]
        interview_date = str(profile.interview_date) if profile and profile.interview_date else None
        days_until = None
        if interview_date:
            try:
                iv = datetime.strptime(interview_date, "%Y-%m-%d").date()
                days_until = (iv - today).days
            except Exception:
                pass

        readiness = await _get_readiness(db, uid)
        sim_count, sim_avg = await _get_sim_stats(db, uid)

        students.append({
            "id": uid,
            "email": user.email,
            "name": name,
            "readiness": readiness,
            "simulator_sessions": sim_count,
            "simulator_avg_score": sim_avg,
            "interview_date": interview_date,
            "days_until_interview": days_until,
        })

    students.sort(key=lambda s: s["name"].lower())
    return {
        "students": students,
        "total": len(students),
        "member": {"id": member.id, "name": member.name, "role": member.role},
    }


@router.post("/assign-students")
async def assign_students(
    body: AssignBody,
    ctx: AgencyCtx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.manager_id != "unassign":
        manager = await db.scalar(
            select(AgencyMember).where(
                AgencyMember.id == body.manager_id,
                AgencyMember.agency_id == ctx.agency_id,
                AgencyMember.status == "active",
            )
        )
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")

    assigned = 0
    for student_id in body.student_ids:
        link = await db.scalar(
            select(AgencyStudent).where(
                AgencyStudent.agency_id == ctx.agency_id,
                AgencyStudent.user_id == student_id,
            )
        )
        if link:
            link.assigned_manager_id = None if body.manager_id == "unassign" else body.manager_id
            db.add(link)
            assigned += 1

    await db.commit()
    return {"success": True, "assigned": assigned}
