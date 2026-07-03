"""Main scraping pipeline: scrape → process → dedupe → store."""

import asyncio
import logging
import sys
import uuid
from datetime import datetime

# Ensure backend root is in sys.path when run standalone
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.knowledge_base import KnowledgeBase, ScraperRun
from scraper.content_processor import extract_qa_pairs
from scraper.deduplicator import (
    embedding_from_db,
    embedding_to_db,
    get_embedding,
    is_duplicate,  # sync — caller supplies pre-computed vector
)
from scraper.sources import TIER_1_SOURCES
from scraper.web_scraper import discover_agency_sites, discover_community_sources, scrape_page

logger = logging.getLogger(__name__)

_PIPELINE_TIMEOUT_SECONDS = 1800  # 30 minutes hard cap
_RATE_LIMIT_SECONDS = 2.0


async def _load_existing_embeddings(db: AsyncSession) -> list[tuple[str, list[float]]]:
    """Load all KB entries that have embeddings for dedup comparison."""
    rows = await db.execute(select(KnowledgeBase.question, KnowledgeBase.embedding))
    result = []
    for question, emb_raw in rows:
        vec = embedding_from_db(emb_raw)
        if vec:
            result.append((question, vec))
    return result


async def _save_entry(db: AsyncSession, qa: dict, embedding: list[float]) -> None:
    """Persist a single KB entry. Caller must supply the pre-computed embedding."""
    try:
        db.add(KnowledgeBase(
            id=str(uuid.uuid4()),
            category=qa["category"],
            question=qa["question"],
            answer=qa["answer"],
            trust_level=qa["trust_level"],
            source_url=qa.get("source_url"),
            embedding=embedding_to_db(embedding),
            verified=False,
        ))
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save KB entry: {e}")


async def _scrape_and_process(url: str, tier: int) -> list[dict]:
    content = await scrape_page(url)
    if not content:
        return []
    return await extract_qa_pairs(content, tier=tier)


async def _pipeline_body() -> dict:
    """Execute the full pipeline and return stats dict."""
    stats = {
        "sources_scraped": 0,
        "new_entries_added": 0,
        "errors": [],
    }

    async with AsyncSessionLocal() as db:
        # -- Tier 1: always scrape official sources --
        tier1_qa: list[dict] = []
        for source in TIER_1_SOURCES:
            try:
                qa_pairs = await _scrape_and_process(source["url"], tier=1)
                tier1_qa.extend(qa_pairs)
                stats["sources_scraped"] += 1
                logger.info(f"Tier1 {source['source_name']}: {len(qa_pairs)} pairs")
            except Exception as e:
                logger.error(f"Tier1 failed for {source['url']}: {e}")
                stats["errors"].append(str(e))
            await asyncio.sleep(_RATE_LIMIT_SECONDS)

        # -- Tier 2: discover agency sites --
        tier2_qa: list[dict] = []
        try:
            agency_urls = await discover_agency_sites()
            for url in agency_urls[:10]:
                try:
                    qa_pairs = await _scrape_and_process(url, tier=2)
                    tier2_qa.extend(qa_pairs)
                    stats["sources_scraped"] += 1
                    logger.info(f"Tier2 {url}: {len(qa_pairs)} pairs")
                except Exception as e:
                    logger.warning(f"Tier2 failed for {url}: {e}")
                await asyncio.sleep(_RATE_LIMIT_SECONDS)
        except Exception as e:
            logger.error(f"Agency discovery failed: {e}")

        # -- Tier 3: community sources --
        tier3_qa: list[dict] = []
        try:
            community_urls = await discover_community_sources()
            for url in community_urls[:10]:
                try:
                    qa_pairs = await _scrape_and_process(url, tier=3)
                    tier3_qa.extend(qa_pairs)
                    stats["sources_scraped"] += 1
                    logger.info(f"Tier3 {url}: {len(qa_pairs)} pairs")
                except Exception as e:
                    logger.warning(f"Tier3 failed for {url}: {e}")
                await asyncio.sleep(_RATE_LIMIT_SECONDS)
        except Exception as e:
            logger.error(f"Community discovery failed: {e}")

        all_new_qa = tier1_qa + tier2_qa + tier3_qa
        logger.info(f"Total candidate Q&A pairs: {len(all_new_qa)}")

        # -- Deduplication --
        # Load existing embeddings once; grow in-place to avoid O(n²) list copies.
        existing_embeddings = await _load_existing_embeddings(db)

        for qa in all_new_qa:
            # Compute embedding once — reuse for both dedup and storage.
            try:
                text = qa["question"] + " " + qa["answer"]
                vec = await get_embedding(text)
            except Exception as e:
                logger.warning(f"Embedding failed, skipping entry: {e}")
                continue

            if is_duplicate(vec, existing_embeddings):
                logger.debug(f"Duplicate skipped: {qa['question'][:60]}")
                continue

            await _save_entry(db, qa, embedding=vec)
            stats["new_entries_added"] += 1
            # Extend in-place so within-batch near-dups are caught without list copies.
            existing_embeddings.append((qa["question"], vec))

    logger.info(
        f"Pipeline done: {stats['sources_scraped']} sources, "
        f"{stats['new_entries_added']} new entries"
    )
    return stats


async def run_scraping_pipeline(run_id: str | None = None) -> dict:
    """Public entry point. Creates a ScraperRun record, runs pipeline, updates it."""
    run_id = run_id or str(uuid.uuid4())
    started_at = datetime.utcnow()

    async with AsyncSessionLocal() as db:
        run = ScraperRun(
            id=run_id,
            started_at=started_at,
            status="running",
        )
        db.add(run)
        await db.commit()

    # asyncio.shield protects the inner coroutine's DB session from CancelledError
    # when wait_for fires — the session can finish its current commit cleanly.
    stats: dict = {"sources_scraped": 0, "new_entries_added": 0}
    try:
        stats = await asyncio.wait_for(
            asyncio.shield(_pipeline_body()),
            timeout=_PIPELINE_TIMEOUT_SECONDS,
        )
        status = "completed"
        error_msg = None
    except asyncio.TimeoutError:
        status = "failed"
        error_msg = f"Pipeline exceeded {_PIPELINE_TIMEOUT_SECONDS}s timeout"
        logger.error(error_msg)
    except Exception as e:
        status = "failed"
        error_msg = str(e)
        logger.exception("Pipeline failed with unexpected error")

    async with AsyncSessionLocal() as db:
        run = await db.get(ScraperRun, run_id)
        if run:
            run.completed_at = datetime.utcnow()
            run.status = status
            run.sources_scraped = str(stats.get("sources_scraped", 0))
            run.new_entries_added = str(stats.get("new_entries_added", 0))
            run.error_message = error_msg
            await db.commit()

    return {"run_id": run_id, "status": status, **stats}
