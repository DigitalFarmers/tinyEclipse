"""
Widget Self-Detection Service — Checks if the TinyEclipse widget is correctly
installed and loading on all active tenant sites.

Performs lightweight HTML inspection:
1. Fetches the homepage of each tenant domain
2. Looks for the widget script tag (widget.js + data-tenant)
3. Verifies the tenant_id matches
4. Reports status per tenant
"""
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

import httpx
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.models.tenant import Tenant, TenantStatus

logger = logging.getLogger(__name__)

WIDGET_MARKERS = [
    "tinyeclipse",
    "widget.js",
    "data-tenant",
]

TIMEOUT = 10


async def check_widget_on_site(domain: str, tenant_id: str) -> Dict[str, Any]:
    """Check a single site for the TinyEclipse widget."""
    url = f"https://{domain}"
    result = {
        "domain": domain,
        "tenant_id": tenant_id,
        "url": url,
        "status": "unknown",
        "widget_found": False,
        "tenant_match": False,
        "script_tag": None,
        "error": None,
        "response_time_ms": None,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=TIMEOUT,
            verify=False,
        ) as client:
            start = asyncio.get_event_loop().time()
            resp = await client.get(url, headers={
                "User-Agent": "TinyEclipse-WidgetCheck/1.0",
                "Accept": "text/html",
            })
            elapsed = (asyncio.get_event_loop().time() - start) * 1000
            result["response_time_ms"] = round(elapsed)

            if resp.status_code >= 400:
                result["status"] = "site_error"
                result["error"] = f"HTTP {resp.status_code}"
                return result

            html = resp.text.lower()

            # Check for widget script
            has_widget_js = "widget.js" in html and "tinyeclipse" in html
            has_data_tenant = "data-tenant" in html

            if has_widget_js and has_data_tenant:
                result["widget_found"] = True

                # Check if the correct tenant_id is embedded
                if tenant_id.lower() in html:
                    result["tenant_match"] = True
                    result["status"] = "ok"
                else:
                    result["status"] = "wrong_tenant"
                    result["error"] = "Widget found but tenant_id doesn't match"
            elif has_widget_js:
                result["widget_found"] = True
                result["status"] = "missing_tenant_attr"
                result["error"] = "Widget script found but missing data-tenant attribute"
            else:
                result["status"] = "not_installed"
                result["error"] = "Widget script not found in page HTML"

            # Try to extract the actual script tag for debugging
            import re
            match = re.search(
                r'<script[^>]*tinyeclipse[^>]*widget[^>]*>',
                resp.text,
                re.IGNORECASE,
            )
            if not match:
                match = re.search(
                    r'<script[^>]*widget[^>]*tinyeclipse[^>]*>',
                    resp.text,
                    re.IGNORECASE,
                )
            if match:
                result["script_tag"] = match.group(0)

    except httpx.TimeoutException:
        result["status"] = "timeout"
        result["error"] = f"Site did not respond within {TIMEOUT}s"
    except httpx.ConnectError:
        result["status"] = "unreachable"
        result["error"] = "Could not connect to site"
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)[:200]

    return result


async def check_all_widgets(db: AsyncSession, tenant_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    """Check widget installation across all active tenants (or a subset)."""
    query = (
        select(Tenant)
        .where(and_(
            Tenant.status == TenantStatus.active,
            Tenant.domain.isnot(None),
            Tenant.domain != "",
        ))
        .options(noload("*"))
    )

    if tenant_ids:
        uuids = [uuid.UUID(tid) for tid in tenant_ids]
        query = query.where(Tenant.id.in_(uuids))

    result = await db.execute(query)
    tenants = result.scalars().all()

    if not tenants:
        return {"total": 0, "results": [], "summary": {}}

    # Run checks concurrently with a semaphore to limit parallelism
    sem = asyncio.Semaphore(5)

    async def bounded_check(t):
        async with sem:
            return await check_widget_on_site(t.domain, str(t.id))

    tasks = [bounded_check(t) for t in tenants]
    checks = await asyncio.gather(*tasks)

    # Build summary
    summary = {
        "ok": 0,
        "not_installed": 0,
        "wrong_tenant": 0,
        "missing_tenant_attr": 0,
        "site_error": 0,
        "timeout": 0,
        "unreachable": 0,
        "error": 0,
    }
    for c in checks:
        status = c.get("status", "unknown")
        if status in summary:
            summary[status] += 1
        else:
            summary["error"] += 1

    return {
        "total": len(checks),
        "healthy": summary["ok"],
        "issues": len(checks) - summary["ok"],
        "summary": summary,
        "results": sorted(checks, key=lambda x: (x["status"] != "ok", x["domain"])),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
