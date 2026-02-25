"""
Product Intelligence Service — Analyzes WooCommerce products for completeness,
ingredient tracking, description quality, and provides actionable overviews.

Designed for shops like Chocotale where knowing every product inside-out is critical
for the AI chatbot to give confident answers.
"""
import re
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict

import httpx

logger = logging.getLogger(__name__)

# ─── Ingredient Detection Patterns ───

_INGREDIENT_HEADERS = re.compile(
    r"(ingredi[eë]nt(?:en|s)?|samenstelling|composition|bestanddelen|inhoud|"
    r"ingredients?|zutaten|ingrédients?|bevat|contains|allergen(?:en|s)?)",
    re.IGNORECASE,
)

_NUTRITION_HEADERS = re.compile(
    r"(voedingswaarde|nutritional?\s*(?:value|info|facts)?|"
    r"nährwert|valeur\s*nutritive|calorieën|calories|kcal|kJ)",
    re.IGNORECASE,
)

_ALLERGEN_KEYWORDS = [
    "gluten", "melk", "milk", "lait", "soja", "soy", "noten", "nuts", "noix",
    "ei", "egg", "oeuf", "pinda", "peanut", "arachide", "sesam", "sesame",
    "lupine", "lupin", "mosterd", "mustard", "moutarde", "selderij", "celery",
    "céleri", "vis", "fish", "poisson", "schaaldieren", "shellfish",
    "crustacés", "weekdieren", "molluscs", "mollusques", "sulfiet", "sulfite",
    "lactose", "tarwe", "wheat", "blé", "cacao", "cocoa", "cacaobutter",
    "cocoa butter", "beurre de cacao", "kakaobutter",
]

_WEIGHT_PATTERN = re.compile(r"\b\d+\s*(?:g|gr|gram|kg|ml|cl|l|oz|lb)\b", re.IGNORECASE)
_PERCENTAGE_PATTERN = re.compile(r"\b\d+(?:[.,]\d+)?\s*%", re.IGNORECASE)


@dataclass
class ProductAnalysis:
    """Analysis result for a single product."""
    id: int
    name: str
    sku: str = ""
    price: str = ""
    stock_status: str = ""
    stock_quantity: Optional[int] = None
    image: str = ""
    permalink: str = ""
    categories: List[str] = field(default_factory=list)

    # Completeness
    has_description: bool = False
    has_short_description: bool = False
    has_ingredients: bool = False
    has_nutrition: bool = False
    has_allergens: bool = False
    has_weight: bool = False
    has_images: bool = False
    has_price: bool = False
    has_sku: bool = False
    has_categories: bool = False

    # Extracted data
    ingredients_text: str = ""
    allergens_found: List[str] = field(default_factory=list)
    weight_info: str = ""
    description_length: int = 0
    description_word_count: int = 0

    # Quality score 0-100
    completeness_score: int = 0
    quality_grade: str = "F"
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


def _strip_html(html: str) -> str:
    """Remove HTML tags and decode entities."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"&#\d+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_ingredients(text: str) -> str:
    """Try to extract the ingredients section from product text."""
    lines = text.split("\n")
    capture = False
    captured = []
    for line in lines:
        stripped = line.strip()
        if _INGREDIENT_HEADERS.search(stripped):
            capture = True
            # If the header line also has content after colon
            parts = re.split(r"[:：]", stripped, maxsplit=1)
            if len(parts) > 1 and len(parts[1].strip()) > 5:
                captured.append(parts[1].strip())
            continue
        if capture:
            if not stripped or (len(stripped) < 3 and not stripped.endswith(",")):
                if captured:
                    break
                continue
            captured.append(stripped)

    if captured:
        return " ".join(captured)

    # Fallback: search for inline "Ingrediënten: ..." pattern
    match = re.search(
        r"(?:ingredi[eë]nt(?:en|s)?|samenstelling|composition)\s*[:：]\s*(.+?)(?:\.|$)",
        text, re.IGNORECASE
    )
    if match:
        return match.group(1).strip()

    return ""


def _find_allergens(text: str) -> List[str]:
    """Detect allergen keywords in text."""
    text_lower = text.lower()
    found = []
    for allergen in _ALLERGEN_KEYWORDS:
        if allergen.lower() in text_lower:
            found.append(allergen)
    return sorted(set(found))


def _analyze_product(raw: Dict[str, Any]) -> ProductAnalysis:
    """Analyze a single WooCommerce product dict."""
    name = raw.get("name", raw.get("title", ""))
    desc_html = raw.get("description", "")
    short_html = raw.get("short_description", "")
    full_text = _strip_html(f"{desc_html} {short_html}")

    desc_text = _strip_html(desc_html)
    short_text = _strip_html(short_html)

    price = str(raw.get("price", raw.get("regular_price", "")))
    sku = raw.get("sku", "")
    stock_status = raw.get("stock_status", "")
    stock_qty = raw.get("stock_quantity")
    images = raw.get("images", [])
    image_url = images[0].get("src", "") if images else raw.get("image", "")
    permalink = raw.get("permalink", raw.get("link", ""))
    cats = [c.get("name", "") for c in raw.get("categories", [])] if isinstance(raw.get("categories"), list) else []

    # Ingredient detection
    ingredients_text = _extract_ingredients(full_text)
    if not ingredients_text:
        # Also check in the raw HTML (sometimes structured in tables/divs)
        ingredients_text = _extract_ingredients(_strip_html(desc_html))

    has_ingredients = bool(ingredients_text and len(ingredients_text) > 5)
    has_nutrition = bool(_NUTRITION_HEADERS.search(full_text))
    allergens = _find_allergens(full_text)
    has_allergens = len(allergens) > 0
    weight_match = _WEIGHT_PATTERN.search(full_text)
    weight_info = weight_match.group(0) if weight_match else ""

    analysis = ProductAnalysis(
        id=raw.get("id", 0),
        name=name,
        sku=sku,
        price=price,
        stock_status=stock_status,
        stock_quantity=stock_qty,
        image=image_url,
        permalink=permalink,
        categories=cats,
        has_description=len(desc_text) > 20,
        has_short_description=len(short_text) > 10,
        has_ingredients=has_ingredients,
        has_nutrition=has_nutrition,
        has_allergens=has_allergens,
        has_weight=bool(weight_info),
        has_images=len(images) > 0 if isinstance(images, list) else bool(image_url),
        has_price=bool(price and price != "0" and price != ""),
        has_sku=bool(sku),
        has_categories=len(cats) > 0,
        ingredients_text=ingredients_text[:500],
        allergens_found=allergens,
        weight_info=weight_info,
        description_length=len(desc_text),
        description_word_count=len(desc_text.split()) if desc_text else 0,
    )

    # Calculate completeness score
    score = 0
    weights = {
        "has_description": 15,
        "has_short_description": 5,
        "has_ingredients": 20,
        "has_allergens": 10,
        "has_nutrition": 10,
        "has_weight": 5,
        "has_images": 10,
        "has_price": 10,
        "has_sku": 5,
        "has_categories": 10,
    }
    for field_name, weight in weights.items():
        if getattr(analysis, field_name):
            score += weight

    analysis.completeness_score = score

    # Grade
    if score >= 90:
        analysis.quality_grade = "A+"
    elif score >= 80:
        analysis.quality_grade = "A"
    elif score >= 65:
        analysis.quality_grade = "B"
    elif score >= 50:
        analysis.quality_grade = "C"
    elif score >= 35:
        analysis.quality_grade = "D"
    else:
        analysis.quality_grade = "F"

    # Issues and suggestions
    if not analysis.has_description:
        analysis.issues.append("Geen productomschrijving")
        analysis.suggestions.append("Voeg een gedetailleerde productomschrijving toe")
    elif analysis.description_word_count < 30:
        analysis.issues.append("Beschrijving te kort")
        analysis.suggestions.append("Breid de beschrijving uit naar minimaal 50 woorden")

    if not analysis.has_ingredients:
        analysis.issues.append("Ingrediënten ontbreken")
        analysis.suggestions.append("Voeg een ingrediëntenlijst toe in de beschrijving")

    if not analysis.has_allergens:
        analysis.issues.append("Geen allergeneninformatie")
        analysis.suggestions.append("Vermeld allergenen (verplicht voor voedingsproducten)")

    if not analysis.has_nutrition:
        analysis.issues.append("Voedingswaarde ontbreekt")
        analysis.suggestions.append("Voeg voedingswaarde-informatie toe")

    if not analysis.has_weight:
        analysis.issues.append("Gewicht/inhoud niet vermeld")
        analysis.suggestions.append("Vermeld het gewicht of de inhoud van het product")

    if not analysis.has_images:
        analysis.issues.append("Geen productafbeelding")
        analysis.suggestions.append("Voeg minimaal één productfoto toe")

    if not analysis.has_price:
        analysis.issues.append("Geen prijs ingesteld")

    if not analysis.has_sku:
        analysis.issues.append("Geen SKU/artikelnummer")

    return analysis


async def analyze_products(tenant_domain: str, tenant_id: str, limit: int = 200) -> Dict[str, Any]:
    """
    Fetch products from a WooCommerce site via the TinyEclipse WP plugin
    and analyze each for completeness.
    """
    headers = {"X-Tenant-Id": tenant_id}
    products_raw = []

    for ns in ["tinyeclipse/v1", "eclipse-ai/v1"]:
        url = f"https://{tenant_domain}/wp-json/{ns}/shop/products"
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                r = await client.get(url, headers=headers, params={"limit": limit})
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list):
                        products_raw = data
                    elif isinstance(data, dict) and "products" in data:
                        products_raw = data["products"]
                    elif isinstance(data, dict) and "items" in data:
                        products_raw = data["items"]
                    else:
                        products_raw = data if isinstance(data, list) else []
                    break
        except Exception as e:
            logger.warning(f"[product-intel] Failed {ns}: {e}")

    if not products_raw:
        return {
            "error": True,
            "detail": "Could not fetch products from WordPress",
            "products": [],
            "summary": {},
        }

    # Analyze each product
    analyses = [_analyze_product(p) for p in products_raw if isinstance(p, dict)]

    # Build summary
    total = len(analyses)
    with_ingredients = sum(1 for a in analyses if a.has_ingredients)
    without_ingredients = total - with_ingredients
    with_allergens = sum(1 for a in analyses if a.has_allergens)
    with_nutrition = sum(1 for a in analyses if a.has_nutrition)
    with_weight = sum(1 for a in analyses if a.has_weight)
    with_images = sum(1 for a in analyses if a.has_images)
    with_description = sum(1 for a in analyses if a.has_description)
    avg_score = round(sum(a.completeness_score for a in analyses) / max(total, 1), 1)

    # Grade distribution
    grade_dist = {}
    for a in analyses:
        grade_dist[a.quality_grade] = grade_dist.get(a.quality_grade, 0) + 1

    # Category breakdown
    cat_stats: Dict[str, Dict] = {}
    for a in analyses:
        for cat in (a.categories or ["Geen categorie"]):
            if cat not in cat_stats:
                cat_stats[cat] = {"total": 0, "with_ingredients": 0, "avg_score": 0, "scores": []}
            cat_stats[cat]["total"] += 1
            if a.has_ingredients:
                cat_stats[cat]["with_ingredients"] += 1
            cat_stats[cat]["scores"].append(a.completeness_score)

    for cat in cat_stats:
        scores = cat_stats[cat].pop("scores")
        cat_stats[cat]["avg_score"] = round(sum(scores) / len(scores), 1)
        cat_stats[cat]["completeness_pct"] = round(cat_stats[cat]["with_ingredients"] / cat_stats[cat]["total"] * 100, 1)

    # All unique allergens found
    all_allergens: Dict[str, int] = {}
    for a in analyses:
        for allergen in a.allergens_found:
            all_allergens[allergen] = all_allergens.get(allergen, 0) + 1

    # AI readiness score (how well can our chatbot answer about these products?)
    ai_readiness = 0
    if total > 0:
        desc_pct = with_description / total * 30
        ing_pct = with_ingredients / total * 30
        allerg_pct = with_allergens / total * 20
        img_pct = with_images / total * 10
        nutr_pct = with_nutrition / total * 10
        ai_readiness = round(desc_pct + ing_pct + allerg_pct + img_pct + nutr_pct)

    return {
        "products": [asdict(a) for a in analyses],
        "summary": {
            "total_products": total,
            "with_ingredients": with_ingredients,
            "without_ingredients": without_ingredients,
            "ingredients_pct": round(with_ingredients / max(total, 1) * 100, 1),
            "with_allergens": with_allergens,
            "with_nutrition": with_nutrition,
            "with_weight": with_weight,
            "with_images": with_images,
            "with_description": with_description,
            "avg_completeness": avg_score,
            "grade_distribution": grade_dist,
            "ai_readiness_score": ai_readiness,
            "category_breakdown": cat_stats,
            "allergens_overview": dict(sorted(all_allergens.items(), key=lambda x: -x[1])),
        },
    }
