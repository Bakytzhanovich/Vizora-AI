"""Admin endpoints: scraper control + knowledge base management."""

import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.knowledge_base import KnowledgeBase, ScraperRun

router = APIRouter(prefix="/admin", tags=["admin"])

# Keeps strong references to background tasks so the GC doesn't cancel them.
_bg_tasks: set[asyncio.Task] = set()


def _check_admin(request: Request) -> None:
    secret = request.headers.get("X-Admin-Secret", "")
    if not settings.ADMIN_SECRET or secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


# ─── Scraper endpoints ───────────────────────────────────────────────────────

@router.post("/scraper/run-now", status_code=202)
async def run_scraper_now(request: Request):
    """Manually trigger the scraping pipeline in the background."""
    _check_admin(request)

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
    _check_admin(request)

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
    _check_admin(request)

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
    _check_admin(request)

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
    db: AsyncSession = Depends(get_db),
):
    """Mark a KB entry as manually verified."""
    _check_admin(request)

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
    db: AsyncSession = Depends(get_db),
):
    """Delete a KB entry (e.g. bad data from scraper)."""
    _check_admin(request)

    entry = await db.get(KnowledgeBase, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": entry_id}
