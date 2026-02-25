"""
Module Detector — Auto-detect active modules on a tenant's WordPress site.

Scans the site for known patterns:
- Jobs: /vacatures, /jobs, FluentForms job forms
- Shop: WooCommerce, /shop, /winkel, /product
- Giftcard: /cadeaubon, /giftcard
- Forms: FluentForms, Contact Form 7, Gravity Forms
- Blog: /blog, WordPress posts
- Booking: /reserveren, /boeken
- Mail: checked via DirectAdmin API (separate)
"""
from __future__ import annotations
from typing import Optional, List, Dict
import logging
from datetime import datetime, timezone

import httpx

from app.models.site_module import ModuleType

logger = logging.getLogger(__name__)

# Detection patterns per module type
DETECTION_PATTERNS: dict[ModuleType, dict] = {
    ModuleType.jobs: {
        "paths": ["/vacatures", "/jobs", "/careers", "/werken-bij", "/solliciteren"],
        "html_markers": [
            "job-listing", "vacature", "solliciteer", "apply-now",
            "fluentform", "ff-el-group", "job-board",
        ],
        "label": "Vacatures",
    },
    ModuleType.shop: {
        "paths": ["/shop", "/winkel", "/product", "/winkelmand", "/cart", "/checkout"],
        "html_markers": [
            "woocommerce", "product-price", "add-to-cart", "wc-block",
            "shop-page", "product_cat",
        ],
        "label": "Webshop",
    },
    ModuleType.giftcard: {
        "paths": ["/cadeaubon", "/giftcard", "/gift-card", "/cadeaukaart"],
        "html_markers": [
            "giftcard", "cadeaubon", "gift-card", "voucher",
        ],
        "label": "Cadeaubonnen",
    },
    ModuleType.forms: {
        "paths": ["/contact", "/aanvraag", "/offerte", "/inschrijven"],
        "html_markers": [
            "fluentform", "ff-el-group", "wpcf7", "contact-form-7",
            "gform_wrapper", "gravity-form", "wpforms",
        ],
        "label": "Formulieren",
    },
    ModuleType.blog: {
        "paths": ["/blog", "/nieuws", "/news", "/artikelen"],
        "html_markers": [
            "blog-post", "entry-content", "post-content", "article-list",
            "wp-block-post", "hentry",
        ],
        "label": "Blog",
    },
    ModuleType.booking: {
        "paths": ["/reserveren", "/boeken", "/booking", "/afspraak", "/workshop"],
        "html_markers": [
            "booking-form", "reservation", "amelia-booking",
            "wc-bookings", "appointment",
        ],
        "label": "Reserveringen",
    },
    ModuleType.forum: {
        "paths": ["/forum", "/community", "/discussie"],
        "html_markers": [
            "bbpress", "forum-topic", "buddypress", "community-forum",
        ],
        "label": "Forum",
    },
    ModuleType.services: {
        "paths": ["/diensten", "/services", "/aanbod", "/tarieven", "/onze-diensten"],
        "html_markers": [
            "service-list", "dienst", "tarief", "uurprijs", "offerte",
            "service-item", "onze-diensten", "service-card",
        ],
        "label": "Diensten",
    },
    ModuleType.rental: {
        "paths": ["/verhuur", "/rental", "/huren", "/beschikbaarheid", "/te-huur"],
        "html_markers": [
            "rental", "verhuur", "huren", "beschikbaar", "borgsom",
            "rental-item", "te-huur", "availability-calendar",
        ],
        "label": "Verhuur",
    },
    ModuleType.portfolio: {
        "paths": ["/portfolio", "/projecten", "/realisaties", "/werk", "/gallery", "/ons-werk"],
        "html_markers": [
            "portfolio", "project-item", "realisatie", "gallery", "showcase",
            "portfolio-grid", "project-card", "case-study",
        ],
        "label": "Portfolio",
    },
    ModuleType.packages: {
        "paths": ["/pakketten", "/arrangementen", "/bundels", "/aanbiedingen"],
        "html_markers": [
            "package", "arrangement", "bundel", "pakket",
            "package-card", "pricing-table", "bundle",
        ],
        "label": "Pakketten",
    },
}


async def detect_modules(domain: str) -> list[dict]:
    """
    Scan a domain and detect which modules are active.
    Returns a list of detected modules with type, name, and confidence.
    """
    detected = []
    base_url = f"https://{domain}"

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        # First, fetch the homepage to check for global markers
        homepage_html = ""
        try:
            r = await client.get(base_url)
            if r.status_code == 200:
                homepage_html = r.text.lower()
        except Exception as e:
            logger.warning(f"Could not fetch homepage for {domain}: {e}")

        for module_type, patterns in DETECTION_PATTERNS.items():
            confidence = 0.0
            found_paths = []
            found_markers = []

            # Check paths
            for path in patterns["paths"]:
                try:
                    r = await client.head(base_url + path)
                    if r.status_code == 200:
                        confidence += 0.4
                        found_paths.append(path)
                        break  # One path match is enough
                except Exception:
                    continue

            # Check HTML markers on homepage
            for marker in patterns["html_markers"]:
                if marker in homepage_html:
                    confidence += 0.2
                    found_markers.append(marker)
                    if confidence >= 0.6:
                        break

            # If we found a path, also check that page's HTML
            if found_paths:
                try:
                    r = await client.get(base_url + found_paths[0])
                    if r.status_code == 200:
                        page_html = r.text.lower()
                        for marker in patterns["html_markers"]:
                            if marker in page_html:
                                confidence += 0.2
                                if marker not in found_markers:
                                    found_markers.append(marker)
                                if confidence >= 0.8:
                                    break
                except Exception:
                    pass

            if confidence >= 0.4:
                detected.append({
                    "module_type": module_type.value,
                    "name": patterns["label"],
                    "confidence": min(confidence, 1.0),
                    "found_paths": found_paths,
                    "found_markers": found_markers[:5],
                    "auto_detected": True,
                })

    return detected


async def detect_mail_modules(domain: str, mailboxes: Optional[List[str]] = None) -> Optional[Dict]:
    """
    Detect mail module. This requires mailbox info (from DirectAdmin API or manual config).
    """
    if not mailboxes:
        return None

    return {
        "module_type": ModuleType.mail.value,
        "name": "E-mail",
        "confidence": 1.0,
        "auto_detected": False,
        "config": {
            "mailboxes": mailboxes,
            "domain": domain,
        },
    }
