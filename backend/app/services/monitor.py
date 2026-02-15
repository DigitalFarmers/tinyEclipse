"""
TinyEclipse Monitoring Service
24/7/365 monitoring for all tenant sites:
- Uptime (HTTP response)
- SSL certificate validity + expiry
- SMTP (mail server reachability)
- DNS resolution
- Security headers (HSTS, CSP, X-Frame, etc.)
- Forms detection + validation
- Performance (TTFB, load time)
- Content change detection
"""
import asyncio
import hashlib
import logging
import ssl
import socket
import time
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monitor import (
    MonitorCheck, MonitorResult, Alert,
    CheckType, CheckStatus, AlertSeverity,
)

logger = logging.getLogger(__name__)

REQUIRED_SECURITY_HEADERS = [
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "content-security-policy",
    "referrer-policy",
    "permissions-policy",
]


async def check_uptime(target: str, config: dict) -> dict:
    """Check if site is reachable and measure response time."""
    timeout = config.get("timeout", 10)
    expected_status = config.get("expected_status", 200)
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
            start = time.monotonic()
            resp = await client.get(target, timeout=timeout)
            elapsed_ms = int((time.monotonic() - start) * 1000)

            status = CheckStatus.ok
            if resp.status_code != expected_status:
                status = CheckStatus.warning
            if resp.status_code >= 500:
                status = CheckStatus.critical

            return {
                "status": status,
                "response_ms": elapsed_ms,
                "details": {
                    "status_code": resp.status_code,
                    "content_length": len(resp.content),
                    "final_url": str(resp.url),
                    "redirects": len(resp.history),
                },
            }
    except httpx.TimeoutException:
        return {"status": CheckStatus.critical, "response_ms": timeout * 1000, "error": "Timeout", "details": {"timeout": timeout}}
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {}}


async def check_ssl(target: str, config: dict) -> dict:
    """Check SSL certificate validity and expiry."""
    try:
        hostname = target.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        port = 443

        ctx = ssl.create_default_context()
        loop = asyncio.get_event_loop()

        def _get_cert():
            with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
                s.settimeout(10)
                s.connect((hostname, port))
                return s.getpeercert()

        cert = await loop.run_in_executor(None, _get_cert)

        not_after_str = cert.get("notAfter", "")
        not_after = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days_left = (not_after - datetime.now(timezone.utc)).days

        issuer = dict(x[0] for x in cert.get("issuer", []))
        subject = dict(x[0] for x in cert.get("subject", []))

        status = CheckStatus.ok
        if days_left < 7:
            status = CheckStatus.critical
        elif days_left < 30:
            status = CheckStatus.warning

        return {
            "status": status,
            "response_ms": None,
            "details": {
                "valid": True,
                "days_until_expiry": days_left,
                "expires": not_after.isoformat(),
                "issuer": issuer.get("organizationName", "Unknown"),
                "subject": subject.get("commonName", hostname),
                "san": [x[1] for x in cert.get("subjectAltName", [])],
            },
        }
    except ssl.SSLCertVerificationError as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": f"SSL verification failed: {e}", "details": {"valid": False}}
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {"valid": False}}


async def check_smtp(target: str, config: dict) -> dict:
    """Check if SMTP server is reachable."""
    try:
        host = target.split(":")[0] if ":" in target else target
        port = int(target.split(":")[1]) if ":" in target else 25

        loop = asyncio.get_event_loop()

        def _check():
            start = time.monotonic()
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(10)
            s.connect((host, port))
            banner = s.recv(1024).decode("utf-8", errors="replace").strip()
            s.close()
            elapsed = int((time.monotonic() - start) * 1000)
            return banner, elapsed

        banner, elapsed_ms = await loop.run_in_executor(None, _check)

        status = CheckStatus.ok if banner.startswith("220") else CheckStatus.warning

        return {
            "status": status,
            "response_ms": elapsed_ms,
            "details": {"banner": banner, "host": host, "port": port},
        }
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {"host": target}}


async def check_dns(target: str, config: dict) -> dict:
    """Check DNS resolution."""
    try:
        hostname = target.replace("https://", "").replace("http://", "").split("/")[0]
        loop = asyncio.get_event_loop()

        start = time.monotonic()
        result = await loop.run_in_executor(None, socket.getaddrinfo, hostname, None)
        elapsed_ms = int((time.monotonic() - start) * 1000)

        ips = list(set(r[4][0] for r in result))

        return {
            "status": CheckStatus.ok,
            "response_ms": elapsed_ms,
            "details": {"hostname": hostname, "ips": ips, "records": len(ips)},
        }
    except socket.gaierror as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": f"DNS resolution failed: {e}", "details": {"hostname": target}}
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {}}


async def check_security_headers(target: str, config: dict) -> dict:
    """Check security headers on the site."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
            start = time.monotonic()
            resp = await client.get(target, timeout=10)
            elapsed_ms = int((time.monotonic() - start) * 1000)

        headers_lower = {k.lower(): v for k, v in resp.headers.items()}
        results = {}
        missing = []
        present = []

        for h in REQUIRED_SECURITY_HEADERS:
            if h in headers_lower:
                results[h] = {"present": True, "value": headers_lower[h]}
                present.append(h)
            else:
                results[h] = {"present": False}
                missing.append(h)

        score = len(present) / len(REQUIRED_SECURITY_HEADERS) * 100

        status = CheckStatus.ok
        if score < 50:
            status = CheckStatus.critical
        elif score < 80:
            status = CheckStatus.warning

        return {
            "status": status,
            "response_ms": elapsed_ms,
            "details": {
                "score": round(score, 1),
                "present": present,
                "missing": missing,
                "headers": results,
            },
        }
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {}}


async def check_forms(target: str, config: dict) -> dict:
    """Detect forms on the site — supports FluentForms, WPForms, CF7, Gravity Forms.
    Scans homepage + common form pages (contact, offerte, etc.) + sitemap pages."""
    import re

    pages_to_scan = config.get("pages", [])
    common_slugs = ["contact", "contacteer-ons", "offerte", "bestellen", "aanvraag", "quote", "booking", "reserveren"]

    try:
        base = target.rstrip("/")
        async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=15) as client:
            start = time.monotonic()

            # Build list of pages to scan
            scan_urls = [base]
            for slug in common_slugs:
                scan_urls.append(f"{base}/{slug}/")
            for page in pages_to_scan:
                scan_urls.append(page if page.startswith("http") else f"{base}/{page.strip('/')}/")

            all_forms = []
            pages_scanned = 0
            form_plugins = set()

            for url in scan_urls:
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    pages_scanned += 1
                    html = resp.text

                    # Detect form plugins
                    html_lower = html.lower()
                    if "fluentform" in html_lower or "ff-el-group" in html_lower:
                        form_plugins.add("FluentForms")
                    if "wpforms" in html_lower:
                        form_plugins.add("WPForms")
                    if "wpcf7" in html_lower:
                        form_plugins.add("ContactForm7")
                    if "gform_wrapper" in html_lower:
                        form_plugins.add("GravityForms")

                    # Extract FluentForms form IDs
                    ff_ids = re.findall(r'data-form[_-]id=["\'](\d+)', html, re.I)
                    for fid in ff_ids:
                        all_forms.append({"plugin": "FluentForms", "form_id": fid, "page": url})

                    # Count standard <form> tags
                    form_tags = re.findall(r'<form[^>]*>', html, re.I)
                    for ft in form_tags:
                        action = re.search(r'action=["\']([^"\']*)', ft, re.I)
                        all_forms.append({
                            "plugin": "html",
                            "action": action.group(1) if action else "none",
                            "page": url,
                        })

                    # Security checks on forms
                    has_csrf = "csrf" in html_lower or "_token" in html_lower or "nonce" in html_lower or "_wpnonce" in html_lower
                    has_captcha = "captcha" in html_lower or "recaptcha" in html_lower or "hcaptcha" in html_lower or "turnstile" in html_lower
                    has_honeypot = "honeypot" in html_lower or "ff_hp" in html_lower

                    if ff_ids or form_tags:
                        for form in all_forms:
                            if form["page"] == url:
                                form["csrf"] = has_csrf
                                form["captcha"] = has_captcha
                                form["honeypot"] = has_honeypot

                except Exception:
                    continue

            elapsed_ms = int((time.monotonic() - start) * 1000)

            # Deduplicate forms
            unique_forms = []
            seen = set()
            for f in all_forms:
                key = f"{f.get('plugin')}:{f.get('form_id', f.get('action', ''))}:{f['page']}"
                if key not in seen:
                    seen.add(key)
                    unique_forms.append(f)

            # Determine status
            status = CheckStatus.ok
            issues = []
            forms_without_csrf = [f for f in unique_forms if not f.get("csrf", True)]
            forms_without_captcha = [f for f in unique_forms if not f.get("captcha", True)]

            if forms_without_csrf:
                issues.append(f"{len(forms_without_csrf)} form(s) without CSRF/nonce protection")
                status = CheckStatus.warning
            if forms_without_captcha:
                issues.append(f"{len(forms_without_captcha)} form(s) without CAPTCHA")

            return {
                "status": status,
                "response_ms": elapsed_ms,
                "details": {
                    "forms_found": len(unique_forms),
                    "pages_scanned": pages_scanned,
                    "form_plugins": list(form_plugins),
                    "forms": unique_forms[:20],
                    "issues": issues,
                },
            }
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {}}


async def check_performance(target: str, config: dict) -> dict:
    """Measure page load performance (TTFB, total time, size)."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
            start = time.monotonic()
            resp = await client.get(target, timeout=30)
            total_ms = int((time.monotonic() - start) * 1000)

        size_kb = len(resp.content) / 1024

        status = CheckStatus.ok
        if total_ms > 5000:
            status = CheckStatus.critical
        elif total_ms > 2000:
            status = CheckStatus.warning

        return {
            "status": status,
            "response_ms": total_ms,
            "details": {
                "total_time_ms": total_ms,
                "size_kb": round(size_kb, 1),
                "status_code": resp.status_code,
                "redirects": len(resp.history),
            },
        }
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {}}


async def check_content_change(target: str, config: dict) -> dict:
    """Detect if page content has changed (hash comparison)."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
            resp = await client.get(target, timeout=15)

        content_hash = hashlib.sha256(resp.text.encode()).hexdigest()
        previous_hash = config.get("last_hash", "")

        changed = previous_hash != "" and previous_hash != content_hash

        return {
            "status": CheckStatus.warning if changed else CheckStatus.ok,
            "response_ms": None,
            "details": {
                "current_hash": content_hash,
                "previous_hash": previous_hash,
                "changed": changed,
            },
        }
    except Exception as e:
        return {"status": CheckStatus.critical, "response_ms": None, "error": str(e), "details": {}}


# Dispatcher
CHECK_RUNNERS = {
    CheckType.uptime: check_uptime,
    CheckType.ssl: check_ssl,
    CheckType.smtp: check_smtp,
    CheckType.dns: check_dns,
    CheckType.security_headers: check_security_headers,
    CheckType.forms: check_forms,
    CheckType.performance: check_performance,
    CheckType.content_change: check_content_change,
}


async def run_check(check: MonitorCheck) -> dict:
    """Run a single monitoring check."""
    runner = CHECK_RUNNERS.get(check.check_type)
    if not runner:
        return {"status": CheckStatus.unknown, "response_ms": None, "error": f"Unknown check type: {check.check_type}", "details": {}}
    return await runner(check.target, check.config)


async def execute_check_and_store(db: AsyncSession, check: MonitorCheck) -> MonitorResult:
    """Execute a check, store the result, update the check status, and create alerts if needed."""
    result_data = await run_check(check)

    result = MonitorResult(
        id=uuid.uuid4(),
        check_id=check.id,
        tenant_id=check.tenant_id,
        status=result_data["status"],
        response_ms=result_data.get("response_ms"),
        details=result_data.get("details", {}),
        error=result_data.get("error"),
    )
    db.add(result)

    # Update check status
    check.last_status = result_data["status"]
    check.last_checked_at = datetime.now(timezone.utc)
    check.last_response_ms = result_data.get("response_ms")

    if result_data["status"] in (CheckStatus.critical, CheckStatus.warning):
        check.consecutive_failures += 1
    else:
        check.consecutive_failures = 0

    # Update content_change hash in config
    if check.check_type == CheckType.content_change and "current_hash" in result_data.get("details", {}):
        check.config = {**check.config, "last_hash": result_data["details"]["current_hash"]}

    # Create alert if 3+ consecutive failures
    if check.consecutive_failures >= 3:
        severity = AlertSeverity.critical if result_data["status"] == CheckStatus.critical else AlertSeverity.warning
        alert = Alert(
            id=uuid.uuid4(),
            tenant_id=check.tenant_id,
            check_id=check.id,
            severity=severity,
            title=f"{check.check_type.value.upper()} issue: {check.target}",
            message=result_data.get("error", f"Check failed {check.consecutive_failures} times in a row. Details: {result_data.get('details', {})}"),
        )
        db.add(alert)
        logger.warning(f"[alert] {severity.value}: {alert.title} for tenant {check.tenant_id}")

    await db.flush()
    return result


async def setup_default_checks(db: AsyncSession, tenant_id: uuid.UUID, domain: str):
    """Create default monitoring checks for a new tenant."""
    url = f"https://{domain}" if not domain.startswith("http") else domain
    hostname = domain.replace("https://", "").replace("http://", "").split("/")[0]

    defaults = [
        (CheckType.uptime, url, 5, {}),
        (CheckType.ssl, url, 60, {}),
        (CheckType.dns, hostname, 30, {}),
        (CheckType.security_headers, url, 60, {}),
        (CheckType.forms, url, 60, {}),
        (CheckType.performance, url, 15, {}),
        (CheckType.content_change, url, 60, {}),
    ]

    for check_type, target, interval, config in defaults:
        check = MonitorCheck(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            check_type=check_type,
            target=target,
            interval_minutes=interval,
            config=config,
        )
        db.add(check)

    await db.flush()
    logger.info(f"[monitor] Created {len(defaults)} default checks for tenant {tenant_id} ({domain})")


async def run_due_checks(db: AsyncSession):
    """Find and execute all checks that are due."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(MonitorCheck).where(
            and_(
                MonitorCheck.enabled == True,
                MonitorCheck.last_checked_at == None,  # Never checked
            )
        )
    )
    never_checked = result.scalars().all()

    result2 = await db.execute(
        select(MonitorCheck).where(
            MonitorCheck.enabled == True,
            MonitorCheck.last_checked_at != None,
        )
    )
    previously_checked = [
        c for c in result2.scalars().all()
        if (now - c.last_checked_at).total_seconds() >= c.interval_minutes * 60
    ]

    due_checks = never_checked + previously_checked
    logger.info(f"[monitor] Running {len(due_checks)} due checks")

    results = []
    for check in due_checks:
        try:
            r = await execute_check_and_store(db, check)
            results.append(r)
        except Exception as e:
            logger.error(f"[monitor] Error running check {check.id}: {e}")

    await db.commit()
    return results
