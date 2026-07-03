import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.emergency import EmergencySession
from app.services.emergency_service import (
    generate_action_plan,
    get_scenario,
    get_scenarios,
    get_step,
)

router = APIRouter(prefix="/emergency", tags=["emergency"])


class StartRequest(BaseModel):
    scenario_id: str


class RespondRequest(BaseModel):
    session_id: str
    answer: str
    step_index: int


class ResolveRequest(BaseModel):
    session_id: str


@router.get("/scenarios")
async def list_scenarios(user_id: str = Depends(get_current_user_id)):
    return {"scenarios": get_scenarios()}


@router.post("/start")
async def start_session(
    body: StartRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    scenario = get_scenario(body.scenario_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")

    session = EmergencySession(
        user_id=user_id,
        scenario_id=body.scenario_id,
        answers=json.dumps([]),
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    first_step = get_step(body.scenario_id, 0)
    total_steps = len(scenario["steps"])

    return {
        "session_id": session.id,
        "scenario": {
            "id": scenario["id"],
            "title": scenario["title"],
            "icon": scenario["icon"],
            "urgency": scenario["urgency"],
        },
        "step": first_step,
        "step_index": 0,
        "total_steps": total_steps,
        "completed": False,
    }


@router.post("/respond")
async def respond_to_step(
    body: RespondRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EmergencySession, body.session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    scenario = get_scenario(session.scenario_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")

    answers: list[str] = json.loads(session.answers or "[]")
    while len(answers) <= body.step_index:
        answers.append("")
    answers[body.step_index] = body.answer
    session.answers = json.dumps(answers)

    total_steps = len(scenario["steps"])
    next_index = body.step_index + 1
    is_completed = next_index >= total_steps

    action_plan = None
    if is_completed:
        session.status = "completed"
        action_plan = generate_action_plan(session.scenario_id, answers)
        session.action_plan = json.dumps(action_plan)

    await db.commit()

    if is_completed:
        return {
            "step": None,
            "step_index": next_index,
            "total_steps": total_steps,
            "completed": True,
            "action_plan": action_plan,
        }

    next_step = get_step(session.scenario_id, next_index)
    return {
        "step": next_step,
        "step_index": next_index,
        "total_steps": total_steps,
        "completed": False,
        "action_plan": None,
    }


@router.get("/session/{session_id}")
async def get_session_detail(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EmergencySession, session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    answers = json.loads(session.answers or "[]")
    action_plan = json.loads(session.action_plan) if session.action_plan else None

    return {
        "session": {
            "id": session.id,
            "scenario_id": session.scenario_id,
            "answers": answers,
            "status": session.status,
            "created_at": session.created_at.isoformat(),
            "resolved_at": session.resolved_at.isoformat() if session.resolved_at else None,
        },
        "action_plan": action_plan,
    }


@router.post("/resolve")
async def resolve_session(
    body: ResolveRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EmergencySession, body.session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session.status = "resolved"
    session.resolved_at = datetime.utcnow()
    await db.commit()
    return {"success": True}
