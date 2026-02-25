import uuid
import asyncio
from datetime import datetime
from functools import lru_cache
from typing import List

from sentence_transformers import SentenceTransformer
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.embedding import Embedding
from app.models.source import Source, SourceStatus

settings = get_settings()


@lru_cache()
def _get_model() -> SentenceTransformer:
    """Lazy-load the embedding model once."""
    return SentenceTransformer(settings.embedding_model)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks by character count."""
    if not text or not text.strip():
        return []

    words = text.split()
    chunks = []
    current_chunk: List[str] = []
    current_length = 0

    for word in words:
        current_chunk.append(word)
        current_length += len(word) + 1

        if current_length >= chunk_size:
            chunks.append(" ".join(current_chunk))
            # Keep overlap words
            overlap_words = current_chunk[-overlap:] if overlap > 0 else []
            current_chunk = overlap_words
            current_length = sum(len(w) + 1 for w in current_chunk)

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


async def generate_embedding(text: str) -> list[float]:
    """Generate embedding vector for a text string using local model."""
    model = _get_model()
    # Run in executor to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    vector = await loop.run_in_executor(None, lambda: model.encode(text).tolist())
    return vector


async def ingest_source(db: AsyncSession, source: Source) -> int:
    """Ingest a source: chunk text, generate embeddings, store in DB.
    Returns the number of chunks created."""
    if not source.content:
        source.status = SourceStatus.failed
        await db.flush()
        return 0

    try:
        # Delete existing embeddings for this source
        await db.execute(
            delete(Embedding).where(Embedding.source_id == source.id)
        )

        chunks = chunk_text(source.content)
        count = 0

        for i, chunk in enumerate(chunks):
            vector = await generate_embedding(chunk)
            emb = Embedding(
                id=uuid.uuid4(),
                tenant_id=source.tenant_id,
                source_id=source.id,
                chunk_text=chunk,
                embedding=vector,
                metadata_={"chunk_index": i, "source_title": source.title},
            )
            db.add(emb)
            count += 1

        source.status = SourceStatus.indexed
        source.last_indexed_at = datetime.now()
        await db.flush()
        return count

    except Exception as e:
        source.status = SourceStatus.failed
        await db.flush()
        raise e
