"""Consent management — hard block without consent."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
from app.models.consent import Consent
from app.models.tenant import Tenant

router = APIRouter(prefix="/api/consent", tags=["consent"])


class ConsentRequest(BaseModel):
    tenant_id: str
    session_id: str
    accepted: bool
    terms_version: str = "1.0"


class ConsentCheckResponse(BaseModel):
    has_consent: bool
    terms_version: Optional[str] = None


@router.post("/")
async def record_consent(
    request: Request,
    body: ConsentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Record user consent for AI services."""
    tenant_uuid = uuid.UUID(body.tenant_id)

    # Verify tenant exists
    tenant = await get_tenant_safe(db, body.tenant_id)

    # Get client info
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    consent = Consent(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        session_id=body.session_id,
        accepted=body.accepted,
        ip_address=ip_address,
        user_agent=user_agent,
        terms_version=body.terms_version,
    )
    db.add(consent)
    await db.flush()

    return {"status": "recorded", "accepted": body.accepted}


@router.get("/check", response_model=ConsentCheckResponse)
async def check_consent(
    tenant_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check if a session has given consent."""
    tenant_uuid = uuid.UUID(tenant_id)

    result = await db.execute(
        select(Consent)
        .where(Consent.tenant_id == tenant_uuid)
        .where(Consent.session_id == session_id)
        .where(Consent.accepted == True)
        .order_by(Consent.created_at.desc())
        .limit(1)
    )
    consent = result.scalar_one_or_none()

    return ConsentCheckResponse(
        has_consent=consent is not None,
        terms_version=consent.terms_version if consent else None,
    )
