"""Embedding-based deduplication for knowledge base entries."""

import json
import logging
import math

from app.services.ai_service import get_openai_embed_client

logger = logging.getLogger(__name__)

_EMBED_MODEL = "text-embedding-3-small"
_DUP_THRESHOLD = 0.92


async def get_embedding(text: str) -> list[float]:
    """Return embedding vector for text using OpenAI text-embedding-3-small."""
    client = get_openai_embed_client()
    response = await client.embeddings.create(
        model=_EMBED_MODEL,
        input=text[:8000],
    )
    return response.data[0].embedding


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def embedding_from_db(raw: str | None) -> list[float] | None:
    """Deserialise embedding stored as JSON string in SQLite."""
    if not raw:
        return None
    try:
        result = json.loads(raw)
        if not isinstance(result, list):
            return None
        return result
    except Exception:
        return None


def embedding_to_db(vec: list[float]) -> str:
    """Serialise embedding for storage in SQLite TEXT column."""
    return json.dumps(vec)


def is_duplicate(
    vec: list[float],
    existing_embeddings: list[tuple[str, list[float]]],
) -> bool:
    """Return True if vec is a near-duplicate of any entry in existing_embeddings.

    Caller must supply the pre-computed embedding vector so it can be reused
    for storage — avoids a second API call per accepted entry.
    """
    for _q, existing_vec in existing_embeddings:
        if _cosine_similarity(vec, existing_vec) >= _DUP_THRESHOLD:
            return True
    return False
