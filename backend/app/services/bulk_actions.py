"""
TinyEclipse Bulk Actions — Cross-domain operations at scale.
The agency power layer: operate across ALL sites of a client at once.

Key features:
- Reindex all knowledge bases for a client
- Copy/share knowledge sources between sibling domains
- Send commands to all WP sites at once
- Run security audits across all domains
- Resolve shared knowledge gaps with one answer
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

from sqlalchemy import select, func, and_, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_account import ClientAccount
from app.models.tenant import Tenant
from app.models.source import Source, SourceStatus, SourceType
from app.models.embedding import Embedding
from app.models.knowledge_gap import KnowledgeGap, GapStatus
from app.models.command_queue import CommandQueue, CommandStatus
from app.models.system_event import SystemEvent

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# BULK REINDEX — trigger knowledge reindex for all client domains
# ═══════════════════════════════════════════════════════════════

async def bulk_reindex(
    db: AsyncSession,
    client_account_id: uuid.UUID,
    tenant_ids: Optional[List[str]] = None,
) -> Dict:
    """Queue reindex commands for all (or selected) client domains."""
    tenants = await _get_client_tenants(db, client_account_id, tenant_ids)
    if not tenants:
        return {"error": "Geen domeinen gevonden"}

    results = []
    for t in tenants:
        # Count sources that need reindexing
        source_count = (await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )).scalar() or 0

        # Queue reindex command
        cmd = CommandQueue(
            id=uuid.uuid4(),
            tenant_id=t.id,
            command_type="knowledge_reindex",
            payload={"action": "reindex_all", "source_count": source_count},
            status=CommandStatus.pending,
            priority=3,
        )
        db.add(cmd)

        # Reset all sources to pending for re-ingestion
        await db.execute(
            update(Source)
            .where(and_(Source.tenant_id == t.id, Source.status == SourceStatus.indexed))
            .values(status=SourceStatus.pending)
        )

        # Log event
        try:
            from app.services.event_bus import emit
            await emit(
                db, domain="ai", action="bulk_reindex",
                title=f"Bulk reindex gestart voor {t.domain or t.name}",
                severity="info", tenant_id=t.id, source="bulk_actions",
                data={"source_count": source_count},
            )
        except Exception:
            pass

        results.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "sources_queued": source_count,
        })

    await db.flush()

    return {
        "action": "bulk_reindex",
        "domains_affected": len(results),
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════
# KNOWLEDGE TRANSFER — copy sources from one domain to another
# ═══════════════════════════════════════════════════════════════

async def transfer_knowledge(
    db: AsyncSession,
    from_tenant_id: uuid.UUID,
    to_tenant_id: uuid.UUID,
    source_types: Optional[List[str]] = None,
) -> Dict:
    """Copy knowledge sources from one domain to another sibling domain."""
    from_tenant = await db.get(Tenant, from_tenant_id)
    to_tenant = await db.get(Tenant, to_tenant_id)

    if not from_tenant or not to_tenant:
        return {"error": "Een of beide domeinen niet gevonden"}

    # Verify they're siblings (same client account)
    if from_tenant.client_account_id != to_tenant.client_account_id:
        return {"error": "Domeinen moeten onder dezelfde klant vallen"}

    # Get transferable sources
    query = select(Source).where(and_(
        Source.tenant_id == from_tenant_id,
        Source.status == SourceStatus.indexed,
    ))
    if source_types:
        query = query.where(Source.type.in_(source_types))

    sources_result = await db.execute(query)
    sources = sources_result.scalars().all()

    if not sources:
        return {"error": "Geen bronnen gevonden om te transfereren"}

    # Check for duplicates (don't copy if same title already exists)
    existing_titles_result = await db.execute(
        select(Source.title).where(Source.tenant_id == to_tenant_id)
    )
    existing_titles = set(r[0] for r in existing_titles_result.all())

    copied = []
    skipped = []
    for src in sources:
        if src.title in existing_titles:
            skipped.append(src.title)
            continue

        new_source = Source(
            id=uuid.uuid4(),
            tenant_id=to_tenant_id,
            title=f"[Transfer] {src.title}",
            type=src.type,
            content=src.content,
            url=src.url,
            status=SourceStatus.pending,  # Will need to be re-embedded
        )
        db.add(new_source)
        copied.append(src.title)

    await db.flush()

    # Log event
    try:
        from app.services.event_bus import emit
        await emit(
            db, domain="ai", action="knowledge_transfer",
            title=f"Kennistransfer: {len(copied)} bronnen van {from_tenant.domain} naar {to_tenant.domain}",
            severity="success", tenant_id=to_tenant_id, source="bulk_actions",
            data={"from": str(from_tenant_id), "copied": len(copied), "skipped": len(skipped)},
        )
    except Exception:
        pass

    return {
        "action": "knowledge_transfer",
        "from": {"tenant_id": str(from_tenant_id), "domain": from_tenant.domain},
        "to": {"tenant_id": str(to_tenant_id), "domain": to_tenant.domain},
        "copied": len(copied),
        "skipped": len(skipped),
        "copied_titles": copied[:20],
        "skipped_titles": skipped[:10],
    }


# ═══════════════════════════════════════════════════════════════
# BULK COMMAND — send a command to all client WP sites
# ═══════════════════════════════════════════════════════════════

async def bulk_command(
    db: AsyncSession,
    client_account_id: uuid.UUID,
    command_type: str,
    payload: Dict[str, Any],
    tenant_ids: Optional[List[str]] = None,
    priority: int = 5,
) -> Dict:
    """Send a command to all (or selected) client WP sites."""
    allowed_commands = [
        "deep_scan", "knowledge_sync", "cache_clear", "plugin_update",
        "security_scan", "heartbeat", "seo_audit", "translation_audit",
    ]
    if command_type not in allowed_commands:
        return {"error": f"Onbekend command type: {command_type}. Toegestaan: {', '.join(allowed_commands)}"}

    tenants = await _get_client_tenants(db, client_account_id, tenant_ids)
    if not tenants:
        return {"error": "Geen domeinen gevonden"}

    results = []
    for t in tenants:
        cmd = CommandQueue(
            id=uuid.uuid4(),
            tenant_id=t.id,
            command_type=command_type,
            payload={**payload, "bulk_action": True, "client_account_id": str(client_account_id)},
            status=CommandStatus.pending,
            priority=priority,
        )
        db.add(cmd)
        results.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "command_id": str(cmd.id),
        })

    await db.flush()

    # Log event
    try:
        from app.services.event_bus import emit
        await emit(
            db, domain="system", action="bulk_command",
            title=f"Bulk '{command_type}' naar {len(results)} sites",
            severity="info", source="bulk_actions",
            data={"command_type": command_type, "domains": len(results)},
        )
    except Exception:
        pass

    return {
        "action": "bulk_command",
        "command_type": command_type,
        "domains_affected": len(results),
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════
# BULK GAP RESOLVE — resolve a shared knowledge gap across domains
# ═══════════════════════════════════════════════════════════════

async def bulk_resolve_gap(
    db: AsyncSession,
    client_account_id: uuid.UUID,
    category: str,
    answer: str,
    resolved_by: str = "admin",
) -> Dict:
    """Resolve all open gaps of a category across all client domains."""
    tenants = await _get_client_tenants(db, client_account_id)
    if not tenants:
        return {"error": "Geen domeinen gevonden"}

    tenant_ids = [t.id for t in tenants]
    tenant_map = {t.id: t for t in tenants}

    # Find matching gaps
    gaps_result = await db.execute(
        select(KnowledgeGap).where(and_(
            KnowledgeGap.tenant_id.in_(tenant_ids),
            KnowledgeGap.status == GapStatus.open.value,
            KnowledgeGap.category == category,
        ))
    )
    gaps = gaps_result.scalars().all()

    if not gaps:
        return {"error": f"Geen open gaps gevonden in categorie '{category}'"}

    resolved = []
    for gap in gaps:
        gap.status = GapStatus.resolved.value
        gap.resolved_by = resolved_by
        gap.resolved_answer = answer
        gap.updated_at = datetime.now(timezone.utc)

        t = tenant_map.get(gap.tenant_id)
        resolved.append({
            "gap_id": str(gap.id),
            "tenant_name": t.name if t else "Unknown",
            "domain": t.domain if t else None,
            "question": gap.question[:100],
        })

    # Create knowledge source on each domain from the answer
    for t in tenants:
        tenant_gaps_in_cat = [g for g in gaps if g.tenant_id == t.id]
        if not tenant_gaps_in_cat:
            continue

        questions = "; ".join(g.question[:80] for g in tenant_gaps_in_cat[:5])
        new_source = Source(
            id=uuid.uuid4(),
            tenant_id=t.id,
            title=f"[Bulk] Antwoord op {category}: {questions[:200]}",
            type=SourceType.faq,
            content=answer,
            status=SourceStatus.pending,
        )
        db.add(new_source)

    await db.flush()

    # Log event
    try:
        from app.services.event_bus import emit
        await emit(
            db, domain="ai", action="bulk_gap_resolve",
            title=f"Bulk resolve: {len(resolved)} gaps in '{category}' over {len(tenants)} domeinen",
            severity="success", source="bulk_actions",
            data={"category": category, "gaps_resolved": len(resolved), "domains": len(tenants)},
        )
    except Exception:
        pass

    return {
        "action": "bulk_gap_resolve",
        "category": category,
        "gaps_resolved": len(resolved),
        "domains_affected": len(set(g["domain"] for g in resolved)),
        "resolved": resolved[:20],
    }


# ═══════════════════════════════════════════════════════════════
# AVAILABLE ACTIONS — list what bulk actions are possible
# ═══════════════════════════════════════════════════════════════

async def get_available_actions(
    db: AsyncSession,
    client_account_id: uuid.UUID,
) -> Dict:
    """Get available bulk actions with context for a client."""
    tenants = await _get_client_tenants(db, client_account_id)
    if not tenants:
        return {"error": "Geen domeinen gevonden", "actions": []}

    tenant_ids = [t.id for t in tenants]

    # Sources that could be reindexed
    total_sources = (await db.execute(
        select(func.count(Source.id)).where(Source.tenant_id.in_(tenant_ids))
    )).scalar() or 0

    # Open gaps by category
    gap_cats_result = await db.execute(
        select(KnowledgeGap.category, func.count(KnowledgeGap.id))
        .where(and_(
            KnowledgeGap.tenant_id.in_(tenant_ids),
            KnowledgeGap.status == GapStatus.open.value,
        ))
        .group_by(KnowledgeGap.category)
        .order_by(desc(func.count(KnowledgeGap.id)))
    )
    gap_categories = {row[0]: row[1] for row in gap_cats_result.all()}

    # Knowledge per domain (for transfer suggestions)
    source_per_domain = {}
    for t in tenants:
        cnt = (await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )).scalar() or 0
        source_per_domain[str(t.id)] = {"name": t.name, "domain": t.domain, "sources": cnt}

    # Pending commands
    pending_cmds = (await db.execute(
        select(func.count(CommandQueue.id)).where(and_(
            CommandQueue.tenant_id.in_(tenant_ids),
            CommandQueue.status == CommandStatus.pending,
        ))
    )).scalar() or 0

    actions = [
        {
            "action": "bulk_reindex",
            "label": "Alle bronnen herindexeren",
            "description": f"{total_sources} bronnen over {len(tenants)} domeinen opnieuw indexeren",
            "available": total_sources > 0,
            "context": {"total_sources": total_sources},
        },
        {
            "action": "bulk_command",
            "label": "Command naar alle sites",
            "description": f"Stuur een commando naar {len(tenants)} WordPress sites tegelijk",
            "available": True,
            "context": {
                "domain_count": len(tenants),
                "pending_commands": pending_cmds,
                "allowed_commands": ["deep_scan", "knowledge_sync", "cache_clear", "plugin_update", "security_scan", "heartbeat", "seo_audit", "translation_audit"],
            },
        },
        {
            "action": "knowledge_transfer",
            "label": "Kennis transfereren",
            "description": "Kopieer kennisbronnen van het ene domein naar het andere",
            "available": len(tenants) >= 2,
            "context": {"domains": list(source_per_domain.values())},
        },
        {
            "action": "bulk_gap_resolve",
            "label": "Gaps bulk-oplossen",
            "description": f"Los kennislacunes op over alle domeinen tegelijk",
            "available": len(gap_categories) > 0,
            "context": {"categories": gap_categories},
        },
    ]

    return {
        "client_account_id": str(client_account_id),
        "domain_count": len(tenants),
        "domains": [{"tenant_id": str(t.id), "name": t.name, "domain": t.domain} for t in tenants],
        "actions": actions,
    }


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

async def _get_client_tenants(
    db: AsyncSession,
    client_account_id: uuid.UUID,
    tenant_ids: Optional[List[str]] = None,
) -> List[Tenant]:
    """Get production tenants for a client, optionally filtered."""
    query = select(Tenant).where(Tenant.client_account_id == client_account_id)

    if tenant_ids:
        query = query.where(Tenant.id.in_([uuid.UUID(tid) for tid in tenant_ids]))

    result = await db.execute(query)
    tenants = result.scalars().all()

    # Filter to production only (unless explicitly selected)
    if not tenant_ids:
        tenants = [t for t in tenants if str(getattr(t, 'environment', 'production')) == 'production' or (hasattr(t.environment, 'value') and t.environment.value == 'production')]

    return tenants
