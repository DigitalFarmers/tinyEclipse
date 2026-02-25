"""
Cross-Site Sync API — manage product/stock/customer sync between sibling tenants.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.sync import SyncGroup, SyncMember, SyncLog, SyncDirection, SyncEntityType, SyncStatus
from app.models.tenant import Tenant
from app.models.client_account import ClientAccount

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/sync",
    tags=["admin-sync"],
    dependencies=[Depends(verify_admin_key)],
)


# ─── Pydantic Models ───

class SyncGroupCreate(BaseModel):
    client_account_id: str
    entity_type: str  # product, stock, customer
    name: str
    direction: str = "bidirectional"
    master_tenant_id: Optional[str] = None


class SyncMemberCreate(BaseModel):
    tenant_id: str
    remote_id: str
    sku: Optional[str] = None
    title: Optional[str] = None


class StockUpdate(BaseModel):
    tenant_id: str
    remote_id: str
    new_stock: int


# ─── Sync Groups ───

@router.get("/groups/{client_account_id}")
async def list_sync_groups(client_account_id: str, db: AsyncSession = Depends(get_db)):
    """List all sync groups for a client account."""
    result = await db.execute(
        select(SyncGroup).where(SyncGroup.client_account_id == uuid.UUID(client_account_id))
    )
    groups = result.scalars().all()
    return [
        {
            "id": str(g.id),
            "entity_type": g.entity_type.value,
            "name": g.name,
            "direction": g.direction.value,
            "master_tenant_id": str(g.master_tenant_id) if g.master_tenant_id else None,
            "enabled": g.enabled,
            "member_count": len(g.members),
            "members": [
                {
                    "id": str(m.id), "tenant_id": str(m.tenant_id),
                    "remote_id": m.remote_id, "sku": m.sku, "title": m.title,
                    "status": m.status.value,
                    "last_synced_at": m.last_synced_at.isoformat() if m.last_synced_at else None,
                }
                for m in g.members
            ],
            "created_at": g.created_at.isoformat(),
        }
        for g in groups
    ]


@router.post("/groups", status_code=201)
async def create_sync_group(body: SyncGroupCreate, db: AsyncSession = Depends(get_db)):
    """Create a new sync group."""
    group = SyncGroup(
        id=uuid.uuid4(),
        client_account_id=uuid.UUID(body.client_account_id),
        entity_type=SyncEntityType(body.entity_type),
        name=body.name,
        direction=SyncDirection(body.direction),
        master_tenant_id=uuid.UUID(body.master_tenant_id) if body.master_tenant_id else None,
    )
    db.add(group)
    await db.flush()
    logger.info(f"[sync] Created group '{body.name}' ({body.entity_type}) for client {body.client_account_id}")
    return {"id": str(group.id), "status": "created"}


@router.delete("/groups/{group_id}")
async def delete_sync_group(group_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a sync group and all its members."""
    group = await db.get(SyncGroup, uuid.UUID(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await db.delete(group)
    await db.flush()
    return {"status": "deleted"}


@router.patch("/groups/{group_id}/toggle")
async def toggle_sync_group(group_id: str, db: AsyncSession = Depends(get_db)):
    """Enable/disable a sync group."""
    group = await db.get(SyncGroup, uuid.UUID(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.enabled = not group.enabled
    await db.flush()
    return {"enabled": group.enabled}


# ─── Sync Members ───

@router.post("/groups/{group_id}/members", status_code=201)
async def add_sync_member(group_id: str, body: SyncMemberCreate, db: AsyncSession = Depends(get_db)):
    """Add a tenant's entity to a sync group."""
    group = await db.get(SyncGroup, uuid.UUID(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    member = SyncMember(
        id=uuid.uuid4(),
        group_id=uuid.UUID(group_id),
        tenant_id=uuid.UUID(body.tenant_id),
        remote_id=body.remote_id,
        sku=body.sku,
        title=body.title,
    )
    db.add(member)
    await db.flush()
    return {"id": str(member.id), "status": "added"}


@router.delete("/members/{member_id}")
async def remove_sync_member(member_id: str, db: AsyncSession = Depends(get_db)):
    """Remove a member from a sync group."""
    member = await db.get(SyncMember, uuid.UUID(member_id))
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.flush()
    return {"status": "removed"}


# ─── Stock Sync ───

@router.post("/stock-update")
async def propagate_stock_update(body: StockUpdate, db: AsyncSession = Depends(get_db)):
    """Receive a stock change from one tenant and propagate to all siblings in the sync group."""
    tid = uuid.UUID(body.tenant_id)

    # Find sync member for this tenant + remote_id
    result = await db.execute(
        select(SyncMember).where(and_(
            SyncMember.tenant_id == tid,
            SyncMember.remote_id == body.remote_id,
        ))
    )
    source_member = result.scalars().first()
    if not source_member:
        return {"status": "no_sync_group", "message": "Product not in any sync group"}

    group = await db.get(SyncGroup, source_member.group_id)
    if not group or not group.enabled:
        return {"status": "sync_disabled"}

    # Find sibling members
    siblings_result = await db.execute(
        select(SyncMember).where(and_(
            SyncMember.group_id == group.id,
            SyncMember.tenant_id != tid,
        ))
    )
    siblings = siblings_result.scalars().all()

    propagated = []
    for sibling in siblings:
        # Queue a stock update command for each sibling tenant
        from app.models.command_queue import CommandQueue
        cmd = CommandQueue(
            id=uuid.uuid4(),
            tenant_id=sibling.tenant_id,
            command_type="stock_update",
            payload={
                "product_id": sibling.remote_id,
                "new_stock": body.new_stock,
                "source_tenant_id": str(tid),
                "sync_group_id": str(group.id),
            },
            status="pending",
        )
        db.add(cmd)

        # Log it
        log = SyncLog(
            id=uuid.uuid4(),
            group_id=group.id,
            source_tenant_id=tid,
            target_tenant_id=sibling.tenant_id,
            entity_type=SyncEntityType.stock,
            action="stock_changed",
            changes={"remote_id": body.remote_id, "new_stock": body.new_stock},
            status=SyncStatus.pending,
        )
        db.add(log)

        sibling.status = SyncStatus.syncing
        propagated.append(str(sibling.tenant_id))

    source_member.local_data = {**source_member.local_data, "stock": body.new_stock}
    source_member.last_synced_at = datetime.now(timezone.utc)
    source_member.status = SyncStatus.synced

    await db.flush()

    logger.info(f"[sync] Stock update for product {body.remote_id}: {body.new_stock} → propagated to {len(propagated)} siblings")
    return {"status": "propagated", "siblings_updated": len(propagated), "target_tenants": propagated}


# ─── Auto-Detect Linkable Products ───

@router.get("/suggest/{client_account_id}")
async def suggest_sync_links(client_account_id: str, db: AsyncSession = Depends(get_db)):
    """Suggest products that could be linked across sites based on matching SKU."""
    caid = uuid.UUID(client_account_id)

    # Get all tenants for this client account
    tenants_result = await db.execute(
        select(Tenant).where(and_(
            Tenant.client_account_id == caid,
            Tenant.environment == "production",
        ))
    )
    tenants = tenants_result.scalars().all()

    if len(tenants) < 2:
        return {"suggestions": [], "message": "Need at least 2 production tenants to suggest sync links"}

    # Get already-linked remote_ids
    existing_result = await db.execute(
        select(SyncMember.remote_id, SyncMember.tenant_id).join(SyncGroup).where(
            SyncGroup.client_account_id == caid
        )
    )
    existing_links = {(str(r[1]), r[0]) for r in existing_result.all()}

    return {
        "tenants": [{"id": str(t.id), "name": t.name, "domain": t.domain} for t in tenants],
        "existing_links": len(existing_links),
        "message": "Use the WP plugin REST API to fetch products per tenant, then match by SKU/title"
    }


# ─── Sync Logs ───

@router.get("/logs/{group_id}")
async def get_sync_logs(group_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get sync operation logs for a group."""
    result = await db.execute(
        select(SyncLog).where(SyncLog.group_id == uuid.UUID(group_id))
        .order_by(SyncLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "source_tenant_id": str(l.source_tenant_id),
            "target_tenant_id": str(l.target_tenant_id),
            "entity_type": l.entity_type.value,
            "action": l.action,
            "changes": l.changes,
            "status": l.status.value,
            "error": l.error,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]


# ─── Dashboard Overview ───

@router.get("/dashboard/{client_account_id}")
async def sync_dashboard(client_account_id: str, db: AsyncSession = Depends(get_db)):
    """Overview of all sync groups, members, and recent activity."""
    caid = uuid.UUID(client_account_id)

    groups_result = await db.execute(
        select(SyncGroup).where(SyncGroup.client_account_id == caid)
    )
    groups = groups_result.scalars().all()

    # Recent logs across all groups
    group_ids = [g.id for g in groups]
    recent_logs = []
    if group_ids:
        logs_result = await db.execute(
            select(SyncLog).where(SyncLog.group_id.in_(group_ids))
            .order_by(SyncLog.created_at.desc()).limit(20)
        )
        recent_logs = logs_result.scalars().all()

    # Stats
    total_members = sum(len(g.members) for g in groups)
    synced = sum(1 for g in groups for m in g.members if m.status == SyncStatus.synced)
    conflicts = sum(1 for g in groups for m in g.members if m.status == SyncStatus.conflict)
    errors = sum(1 for g in groups for m in g.members if m.status == SyncStatus.error)

    return {
        "client_account_id": client_account_id,
        "stats": {
            "total_groups": len(groups),
            "total_members": total_members,
            "synced": synced,
            "conflicts": conflicts,
            "errors": errors,
        },
        "groups": [
            {
                "id": str(g.id), "name": g.name,
                "entity_type": g.entity_type.value,
                "direction": g.direction.value,
                "enabled": g.enabled,
                "members": [
                    {"tenant_id": str(m.tenant_id), "remote_id": m.remote_id,
                     "sku": m.sku, "title": m.title, "status": m.status.value}
                    for m in g.members
                ],
            }
            for g in groups
        ],
        "recent_logs": [
            {
                "action": l.action, "entity_type": l.entity_type.value,
                "status": l.status.value, "changes": l.changes,
                "created_at": l.created_at.isoformat(),
            }
            for l in recent_logs[:10]
        ],
    }
