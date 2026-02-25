from __future__ import annotations
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.embedding import Embedding
from app.services.embeddings import generate_embedding


async def retrieve_relevant_chunks(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    query: str,
    top_k: int = 5,
    similarity_threshold: float = 0.3,
) -> list[dict]:
    """Retrieve the most relevant text chunks for a query within a tenant's scope.

    Uses pgvector cosine distance for similarity search.
    Returns list of dicts with chunk_text, similarity, source_id, metadata.
    """
    query_embedding = await generate_embedding(query)

    # pgvector cosine distance: <=> operator (lower = more similar)
    # Convert to similarity: 1 - distance
    stmt = (
        select(
            Embedding.id,
            Embedding.chunk_text,
            Embedding.source_id,
            Embedding.metadata_,
            (1 - Embedding.embedding.cosine_distance(query_embedding)).label("similarity"),
        )
        .where(Embedding.tenant_id == tenant_id)
        .where(
            (1 - Embedding.embedding.cosine_distance(query_embedding)) >= similarity_threshold
        )
        .order_by(Embedding.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "chunk_text": row.chunk_text,
            "source_id": str(row.source_id),
            "metadata": row.metadata_,
            "similarity": float(row.similarity),
        }
        for row in rows
    ]


def build_context(chunks: list[dict]) -> str:
    """Build a context string from retrieved chunks for the LLM prompt."""
    if not chunks:
        return ""

    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        source_title = chunk.get("metadata", {}).get("source_title", "Unknown")
        context_parts.append(
            f"[Source {i}: {source_title}]\n{chunk['chunk_text']}"
        )

    return "\n\n---\n\n".join(context_parts)
