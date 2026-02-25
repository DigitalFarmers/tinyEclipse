"""
Sector Intelligence — AI-driven sector detection and Hub configuration.

Analyzes a tenant's site capabilities, detected modules, and content to determine:
1. Business sector (horeca, retail, IT, creative, agriculture, etc.)
2. Active offering types (products, services, rentals, bookings, portfolio, packages)
3. Recommended Hub blocks and dashboard configuration
4. Sector-specific AI recommendations

Used during onboarding and periodically to keep the Hub perfectly tailored.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict

from app.models.site_module import ModuleType

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# SECTOR DEFINITIONS
# ═══════════════════════════════════════════════════════════════

SECTORS = {
    "horeca": {
        "label": "Horeca & Voeding",
        "keywords": ["restaurant", "café", "bakkerij", "chocolat", "traiteur", "catering",
                      "bistro", "brasserie", "eetcafé", "foodtruck", "ijssalon", "patisserie",
                      "menu", "reserveer", "tafel", "gerecht", "wijn", "bier"],
        "typical_modules": [ModuleType.shop, ModuleType.booking, ModuleType.packages],
        "recommended_blocks": ["products", "orders", "bookings", "faq", "business"],
        "icon": "UtensilsCrossed",
    },
    "retail": {
        "label": "Retail & Webshop",
        "keywords": ["winkel", "shop", "webshop", "product", "bestellen", "winkelmand",
                      "collectie", "merk", "fashion", "kleding", "accessoires", "cadeau",
                      "korting", "aanbieding", "seizoen", "nieuw binnen"],
        "typical_modules": [ModuleType.shop, ModuleType.giftcard],
        "recommended_blocks": ["products", "orders", "packages", "faq", "business"],
        "icon": "ShoppingBag",
    },
    "dienstverlening": {
        "label": "Dienstverlening",
        "keywords": ["dienst", "service", "advies", "consultancy", "begeleiding", "coaching",
                      "training", "opleiding", "tarief", "uurprijs", "offerte", "aanvraag",
                      "expertise", "oplossing", "strategie", "implementatie"],
        "typical_modules": [ModuleType.services, ModuleType.forms],
        "recommended_blocks": ["services", "forms", "faq", "business", "projects"],
        "icon": "Briefcase",
    },
    "it_tech": {
        "label": "IT & Technologie",
        "keywords": ["software", "development", "website", "app", "hosting", "cloud",
                      "security", "data", "api", "platform", "saas", "digital", "tech",
                      "programmeer", "developer", "code", "server"],
        "typical_modules": [ModuleType.services, ModuleType.portfolio, ModuleType.forms],
        "recommended_blocks": ["services", "projects", "forms", "faq", "business"],
        "icon": "Monitor",
    },
    "creatief": {
        "label": "Creatief & Ambacht",
        "keywords": ["design", "fotograf", "video", "kunst", "ambacht", "hout", "metaal",
                      "atelier", "studio", "creatief", "handgemaakt", "maatwer", "realisatie",
                      "portfolio", "project", "interieur", "architect", "grafisch"],
        "typical_modules": [ModuleType.portfolio, ModuleType.services],
        "recommended_blocks": ["projects", "services", "forms", "faq", "business"],
        "icon": "Palette",
    },
    "bouw": {
        "label": "Bouw & Renovatie",
        "keywords": ["bouw", "renovatie", "aannemer", "verbouwing", "dakwerk", "elektriciteit",
                      "loodgieter", "schilder", "isolatie", "ruwbouw", "afwerking", "werf",
                      "offerte", "project", "realisatie", "woning"],
        "typical_modules": [ModuleType.portfolio, ModuleType.services, ModuleType.forms],
        "recommended_blocks": ["projects", "services", "forms", "faq", "business"],
        "icon": "HardHat",
    },
    "gezondheid": {
        "label": "Gezondheid & Welzijn",
        "keywords": ["dokter", "arts", "tandarts", "kinesist", "psycholoog", "therapeut",
                      "apotheek", "wellness", "spa", "massage", "yoga", "fitness",
                      "afspraak", "consultatie", "behandeling", "gezondheid"],
        "typical_modules": [ModuleType.booking, ModuleType.services],
        "recommended_blocks": ["bookings", "services", "faq", "business"],
        "icon": "Heart",
    },
    "landbouw": {
        "label": "Landbouw & Hoeve",
        "keywords": ["boerderij", "hoeve", "landbouw", "bio", "seizoen", "oogst", "groente",
                      "fruit", "vlees", "zuivel", "hoevewinkel", "pluk", "veld", "akker",
                      "dier", "paard", "kwekerij", "tuin"],
        "typical_modules": [ModuleType.shop, ModuleType.booking],
        "recommended_blocks": ["products", "orders", "bookings", "business"],
        "icon": "Sprout",
    },
    "verhuur": {
        "label": "Verhuur & Evenementen",
        "keywords": ["verhuur", "huren", "feestzaal", "tent", "materiaal", "evenement",
                      "party", "trouw", "receptie", "locatie", "beschikbaar", "borgsom",
                      "reserveer", "boek", "kalender"],
        "typical_modules": [ModuleType.rental, ModuleType.booking],
        "recommended_blocks": ["rentals", "bookings", "faq", "business"],
        "icon": "Key",
    },
    "onderwijs": {
        "label": "Onderwijs & Training",
        "keywords": ["school", "opleiding", "cursus", "workshop", "les", "trainer",
                      "leerling", "student", "inschrijv", "programma", "certificaat",
                      "academie", "instituut", "kennis"],
        "typical_modules": [ModuleType.booking, ModuleType.forms],
        "recommended_blocks": ["bookings", "forms", "faq", "business"],
        "icon": "GraduationCap",
    },
    "overig": {
        "label": "Overig",
        "keywords": [],
        "typical_modules": [],
        "recommended_blocks": ["forms", "faq", "business"],
        "icon": "Globe",
    },
}

# Mapping from ModuleType to offering block name
MODULE_TO_BLOCK = {
    ModuleType.shop: "products",
    ModuleType.services: "services",
    ModuleType.rental: "rentals",
    ModuleType.booking: "bookings",
    ModuleType.portfolio: "projects",
    ModuleType.packages: "packages",
    ModuleType.jobs: "jobs",
    ModuleType.forms: "forms",
    ModuleType.giftcard: "giftcards",
}

# All possible Hub blocks
ALL_BLOCKS = [
    "products", "services", "rentals", "bookings", "projects",
    "packages", "jobs", "orders", "forms", "faq", "business",
]


# ═══════════════════════════════════════════════════════════════
# SECTOR PROFILE
# ═══════════════════════════════════════════════════════════════

def analyze_sector(
    site_name: str,
    site_content: str,
    detected_modules: List[Dict],
    capabilities: Optional[Dict] = None,
) -> Dict:
    """
    Analyze a tenant's site to determine sector, offering types, and recommended blocks.

    Args:
        site_name: The site/business name
        site_content: Concatenated text from homepage + key pages
        detected_modules: List of detected modules from module_detector
        capabilities: WP capabilities response (plugins, theme, etc.)

    Returns:
        SectorProfile dict with sector, confidence, offering_types, recommended_blocks, etc.
    """
    content_lower = (site_name + " " + site_content).lower()

    # Score each sector by keyword matches
    sector_scores: Dict[str, float] = {}
    for sector_key, sector_def in SECTORS.items():
        if sector_key == "overig":
            continue
        score = 0.0
        matched_keywords = []
        for kw in sector_def["keywords"]:
            if kw in content_lower:
                score += 1.0
                matched_keywords.append(kw)
        # Bonus for module alignment
        active_module_types = {d.get("module_type") for d in detected_modules}
        for typical in sector_def["typical_modules"]:
            if typical.value in active_module_types:
                score += 2.0
        if score > 0:
            sector_scores[sector_key] = score

    # Pick best sector
    if sector_scores:
        best_sector = max(sector_scores, key=sector_scores.get)
        best_score = sector_scores[best_sector]
        max_possible = len(SECTORS[best_sector]["keywords"]) + len(SECTORS[best_sector]["typical_modules"]) * 2
        confidence = min(best_score / max(max_possible * 0.3, 1), 1.0)
    else:
        best_sector = "overig"
        confidence = 0.1

    sector_def = SECTORS[best_sector]

    # Determine offering types from detected modules
    offering_types = []
    active_module_types = {d.get("module_type") for d in detected_modules}
    for mod_type, block_name in MODULE_TO_BLOCK.items():
        if mod_type.value in active_module_types:
            offering_types.append(block_name)

    # Build recommended blocks: sector defaults + detected modules
    recommended_blocks = list(sector_def["recommended_blocks"])
    for ot in offering_types:
        if ot not in recommended_blocks:
            recommended_blocks.append(ot)
    # Always include orders if shop or booking is active
    if ("products" in recommended_blocks or "bookings" in recommended_blocks) and "orders" not in recommended_blocks:
        recommended_blocks.append("orders")
    # Always include faq and business
    for must_have in ["faq", "business"]:
        if must_have not in recommended_blocks:
            recommended_blocks.append(must_have)

    # Determine business model
    business_model = _detect_business_model(content_lower, capabilities)

    # Build recommended actions
    recommended_actions = _build_recommended_actions(
        detected_modules, capabilities, recommended_blocks
    )

    return {
        "sector": best_sector,
        "sector_label": sector_def["label"],
        "sector_icon": sector_def["icon"],
        "confidence": round(confidence, 2),
        "business_model": business_model,
        "offering_types": offering_types,
        "recommended_blocks": recommended_blocks,
        "recommended_actions": recommended_actions,
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "scores": {k: round(v, 1) for k, v in sorted(sector_scores.items(), key=lambda x: -x[1])[:5]},
    }


def _detect_business_model(content: str, capabilities: Optional[Dict]) -> str:
    """Detect B2B, B2C, local, national, international."""
    signals = {
        "b2b": ["bedrijven", "zakelijk", "b2b", "onderneming", "btw", "factuur", "offerte aanvragen"],
        "b2c": ["particulier", "consument", "b2c", "bestellen", "winkelwagen", "cadeau"],
        "local": ["regio", "buurt", "lokaal", "omgeving", "dichtbij", "afhalen"],
        "national": ["heel belgië", "nationaal", "levering", "verzending", "heel nederland"],
        "international": ["international", "worldwide", "shipping", "export", "global"],
    }
    detected = []
    for model, keywords in signals.items():
        for kw in keywords:
            if kw in content:
                detected.append(model)
                break

    if "b2b" in detected and "b2c" in detected:
        biz = "b2b_b2c"
    elif "b2b" in detected:
        biz = "b2b"
    else:
        biz = "b2c"

    if "international" in detected:
        scope = "international"
    elif "national" in detected:
        scope = "national"
    else:
        scope = "local"

    return f"{biz}_{scope}"


def _build_recommended_actions(
    detected_modules: List[Dict],
    capabilities: Optional[Dict],
    recommended_blocks: List[str],
) -> List[Dict]:
    """Build a list of recommended setup actions for the tenant."""
    actions = []

    # Always recommend business profile setup
    actions.append({
        "key": "setup_business_profile",
        "label": "Bedrijfsprofiel instellen",
        "description": "Vul je bedrijfsnaam, adres, openingsuren en contactgegevens in.",
        "priority": "high",
        "block": "business",
    })

    # FAQ if no FAQ content detected
    actions.append({
        "key": "add_faq",
        "label": "FAQ's toevoegen",
        "description": "Voeg veelgestelde vragen toe zodat je AI assistent ze kan beantwoorden.",
        "priority": "high",
        "block": "faq",
    })

    # SEO actions
    actions.append({
        "key": "optimize_seo",
        "label": "SEO optimaliseren",
        "description": "Controleer meta descriptions, OpenGraph tags en interne links.",
        "priority": "medium",
        "block": "seo",
    })

    # Module-specific actions
    active_types = {d.get("module_type") for d in detected_modules}

    if "shop" in active_types and "products" in recommended_blocks:
        actions.append({
            "key": "review_products",
            "label": "Producten controleren",
            "description": "Bekijk je producten, prijzen en voorraad in de Hub.",
            "priority": "medium",
            "block": "products",
        })

    if "booking" in active_types or "bookings" in recommended_blocks:
        actions.append({
            "key": "setup_bookings",
            "label": "Boekingen instellen",
            "description": "Configureer je beschikbaarheid en boekingsregels.",
            "priority": "medium",
            "block": "bookings",
        })

    if "services" in recommended_blocks:
        actions.append({
            "key": "add_services",
            "label": "Diensten toevoegen",
            "description": "Voeg je diensten toe met prijzen en beschrijvingen.",
            "priority": "medium",
            "block": "services",
        })

    if "projects" in recommended_blocks:
        actions.append({
            "key": "add_portfolio",
            "label": "Portfolio aanvullen",
            "description": "Voeg je beste projecten en realisaties toe.",
            "priority": "medium",
            "block": "projects",
        })

    return actions


def get_sector_for_display(sector_key: str) -> dict:
    """Get sector info for frontend display."""
    sector = SECTORS.get(sector_key, SECTORS["overig"])
    return {
        "key": sector_key,
        "label": sector["label"],
        "icon": sector["icon"],
    }


def get_all_sectors() -> list[dict]:
    """Get all available sectors for manual selection."""
    return [
        {"key": k, "label": v["label"], "icon": v["icon"]}
        for k, v in SECTORS.items()
    ]
