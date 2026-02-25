"""
Geo Enrichment Service — Makes Eclipse location & time aware.

On install/calibration, Eclipse learns about the business's:
- Exact location (city, province, country, postcode)
- Timezone and local time awareness
- Neighborhood context (what's nearby, landmarks, character)
- Regional knowledge (municipality info, population, culture)
- Distance context (delivery radius, customer proximity)
- Local business hours norms

This runs as a background enrichment task that builds deep local knowledge.
"""
import uuid
import logging
from typing import Optional, Dict
import httpx
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant

logger = logging.getLogger(__name__)


async def enrich_tenant_geo(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """
    Full geo enrichment for a tenant. Gathers location data from the site
    and builds a rich geo context that the AI can use.
    """
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        return {"error": "Tenant not found"}

    geo = dict(tenant.geo_context) if tenant.geo_context else {}
    domain = tenant.domain

    # Step 1: Try to get location from WordPress site (via connector)
    site_geo = await _fetch_site_location(tenant)
    if site_geo:
        geo.update(site_geo)

    # Step 2: If we have a city/country, enrich with regional knowledge
    city = geo.get("city")
    country = geo.get("country", "BE")
    postcode = geo.get("postcode")

    if city:
        geo["regional_context"] = _build_regional_context(city, country, postcode)

    # Step 3: Build timezone awareness
    tz = geo.get("timezone") or _guess_timezone(country)
    geo["timezone"] = tz
    geo["time_context"] = _build_time_context(tz)

    # Step 4: Build neighborhood description
    if city:
        geo["neighborhood_description"] = _build_neighborhood_desc(city, country, postcode, geo)

    # Step 5: Calculate calibration score
    score = _calculate_calibration_score(geo, tenant)

    # Save
    tenant.geo_context = geo
    tenant.calibration_score = score
    tenant.last_calibrated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(f"[geo-enrich] Tenant {tenant.name}: calibration={score:.0%}, city={city}, tz={tz}")

    return {
        "status": "enriched",
        "calibration_score": score,
        "city": city,
        "country": country,
        "timezone": tz,
        "context_keys": list(geo.keys()),
    }


async def _fetch_site_location(tenant: Tenant) -> Optional[Dict]:
    """Try to extract location info from the WordPress site via multiple endpoints."""
    if not tenant.domain:
        return None

    result = {}
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        # Try tinyeclipse/v1 connector
        try:
            url = f"https://{tenant.domain}/wp-json/tinyeclipse/v1/capabilities"
            r = await client.get(url, headers={"X-Tenant-Id": str(tenant.id)})
            if r.status_code == 200:
                data = r.json()
                if data.get("timezone"):
                    result["timezone"] = data["timezone"]
                if data.get("locale"):
                    result["locale"] = data["locale"]
                    locale = data["locale"]
                    if "_BE" in locale or "nl_BE" in locale:
                        result["country"] = "BE"
                    elif "_NL" in locale:
                        result["country"] = "NL"
                result["connector"] = "tinyeclipse/v1"
                result["wp_version"] = data.get("version")
                result["woocommerce"] = data.get("woocommerce", False)
                result["wpml"] = data.get("wpml", False)
                result["fluent_forms"] = data.get("fluent_forms", False)
        except Exception as e:
            logger.debug(f"[geo-enrich] tinyeclipse/v1 not available: {e}")

        # Try eclipse-ai/v1 agent (alternative connector)
        try:
            url = f"https://{tenant.domain}/wp-json/eclipse-ai/v1/hub/status"
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                result["agent_version"] = data.get("version")
                result["agent_site_name"] = data.get("site")
                result["agent_capabilities"] = data.get("capabilities", [])
                if not result.get("connector"):
                    result["connector"] = "eclipse-ai/v1"
                # Infer modules from capabilities
                caps = data.get("capabilities", [])
                if "orders" in caps or "products" in caps:
                    result["woocommerce"] = True
                if "translation" in caps:
                    result["wpml"] = True
                if "forms" in caps:
                    result["fluent_forms"] = True
                if "jobs" in caps:
                    result["has_jobs"] = True
        except Exception as e:
            logger.debug(f"[geo-enrich] eclipse-ai/v1 not available: {e}")

        # Try eclipse-ai/v1 health for site name
        try:
            url = f"https://{tenant.domain}/wp-json/eclipse-ai/v1/health"
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                if data.get("site") and not result.get("agent_site_name"):
                    result["agent_site_name"] = data["site"]
        except Exception:
            pass

    return result if result else None


def _guess_timezone(country: str) -> str:
    """Guess timezone from country code."""
    tz_map = {
        "BE": "Europe/Brussels",
        "NL": "Europe/Amsterdam",
        "FR": "Europe/Paris",
        "DE": "Europe/Berlin",
        "GB": "Europe/London",
        "US": "America/New_York",
    }
    return tz_map.get(country, "Europe/Brussels")


def _build_regional_context(city: str, country: str, postcode: Optional[str]) -> Dict:
    """Build regional knowledge based on city and country."""
    context = {
        "city": city,
        "country": country,
        "country_name": _country_name(country),
    }

    if postcode:
        context["postcode"] = postcode

    # Belgian city knowledge
    be_cities = {
        "antwerpen": {
            "province": "Antwerpen",
            "region": "Vlaanderen",
            "population": "~530.000",
            "character": "Havenstad, mode- en diamantcentrum, cultureel bruisend",
            "landmarks": ["Grote Markt", "Onze-Lieve-Vrouwekathedraal", "MAS Museum", "Meir winkelstraat", "Centraal Station"],
            "neighborhoods": ["Zuid", "Eilandje", "Borgerhout", "Deurne", "Berchem", "Merksem", "Hoboken", "Wilrijk"],
            "known_for": "Haven, diamanten, mode, Rubens, chocolade, bier",
            "transport": "Tram, bus, fiets, Centraal Station (internationaal)",
        },
        "gent": {
            "province": "Oost-Vlaanderen",
            "region": "Vlaanderen",
            "population": "~265.000",
            "character": "Studentenstad, historisch centrum, cultureel en creatief",
            "landmarks": ["Gravensteen", "Sint-Baafskathedraal", "Graslei", "Belfort"],
            "known_for": "Gentse Feesten, studentenleven, vegetarisch, kunst",
        },
        "brussel": {
            "province": "Brussels Hoofdstedelijk Gewest",
            "region": "Brussels",
            "population": "~1.200.000",
            "character": "Hoofdstad, internationaal, meertalig (NL/FR/EN)",
            "landmarks": ["Grote Markt", "Manneken Pis", "Atomium", "Europese wijk"],
            "known_for": "EU-hoofdstad, wafels, chocolade, comic strips, Art Nouveau",
        },
        "brugge": {
            "province": "West-Vlaanderen",
            "region": "Vlaanderen",
            "population": "~120.000",
            "character": "Middeleeuwse stad, UNESCO werelderfgoed, toeristische trekpleister",
            "landmarks": ["Markt", "Belfort", "Minnewater", "Begijnhof"],
            "known_for": "Chocolade, kant, bier, romantiek, grachten",
        },
        "leuven": {
            "province": "Vlaams-Brabant",
            "region": "Vlaanderen",
            "population": "~102.000",
            "character": "Universiteitsstad (KU Leuven), innovatief, jong",
            "landmarks": ["Stadhuis", "Oude Markt", "Groot Begijnhof"],
            "known_for": "KU Leuven, AB InBev, Oude Markt (langste toog)",
        },
        "mechelen": {
            "province": "Antwerpen",
            "region": "Vlaanderen",
            "population": "~87.000",
            "character": "Centraal gelegen, historisch, familievriendelijk",
            "landmarks": ["Sint-Romboutskathedraal", "Grote Markt", "Technopolis"],
            "known_for": "Centraal in Vlaanderen, Dossin Kazerne, Planckendael",
        },
        "hasselt": {
            "province": "Limburg",
            "region": "Vlaanderen",
            "population": "~78.000",
            "character": "Hoofdstad van Limburg, mode en smaak",
            "landmarks": ["Japanse Tuin", "Grote Markt", "Modemuseum"],
            "known_for": "Jenever, mode, Japanse Tuin, Corda Campus",
        },
    }

    city_lower = city.lower().strip()
    if city_lower in be_cities:
        context.update(be_cities[city_lower])

    # Dutch city knowledge
    nl_cities = {
        "amsterdam": {"province": "Noord-Holland", "character": "Hoofdstad, grachten, cultureel centrum", "known_for": "Grachten, musea, tolerantie"},
        "rotterdam": {"province": "Zuid-Holland", "character": "Havenstad, modern, architectuur", "known_for": "Haven, Erasmusbrug, architectuur"},
        "utrecht": {"province": "Utrecht", "character": "Historisch, studentenstad, centraal", "known_for": "Dom, grachten, centraal gelegen"},
    }
    if city_lower in nl_cities:
        context.update(nl_cities[city_lower])

    return context


def _build_time_context(tz: str) -> dict:
    """Build time awareness context."""
    import zoneinfo
    try:
        local_tz = zoneinfo.ZoneInfo(tz)
        now = datetime.now(local_tz)
        return {
            "timezone": tz,
            "current_hour": now.hour,
            "current_day": now.strftime("%A"),
            "current_date": now.strftime("%Y-%m-%d"),
            "is_weekend": now.weekday() >= 5,
            "is_business_hours": 9 <= now.hour <= 18 and now.weekday() < 5,
            "is_evening": now.hour >= 18,
            "is_night": now.hour >= 22 or now.hour < 7,
            "season": _get_season(now.month),
            "greeting_style": _get_greeting_style(now.hour),
        }
    except Exception:
        return {"timezone": tz}


def _build_neighborhood_desc(city: str, country: str, postcode: Optional[str], geo: Dict) -> str:
    """Build a natural language description of the business location."""
    parts = []
    regional = geo.get("regional_context", {})

    parts.append(f"Dit bedrijf is gevestigd in {city}")
    if regional.get("province"):
        parts.append(f"in de provincie {regional['province']}")
    if regional.get("region"):
        parts.append(f"({regional['region']})")
    parts.append(".")

    if regional.get("character"):
        parts.append(f"{city} is {regional['character']}.")

    if regional.get("known_for"):
        parts.append(f"De stad staat bekend om: {regional['known_for']}.")

    if regional.get("landmarks"):
        parts.append(f"Bekende plekken in de buurt: {', '.join(regional['landmarks'][:4])}.")

    if regional.get("transport"):
        parts.append(f"Bereikbaar via: {regional['transport']}.")

    return " ".join(parts)


def _calculate_calibration_score(geo: dict, tenant: Tenant) -> float:
    """
    Calculate how well Eclipse is calibrated for this tenant.
    Score 0.0 - 1.0 based on available context.
    """
    score = 0.0
    max_points = 0.0

    # Location awareness (40%)
    max_points += 0.40
    if geo.get("city"):
        score += 0.10
    if geo.get("country"):
        score += 0.05
    if geo.get("postcode"):
        score += 0.05
    if geo.get("timezone"):
        score += 0.05
    if geo.get("regional_context"):
        score += 0.10
    if geo.get("neighborhood_description"):
        score += 0.05

    # Knowledge base (30%)
    max_points += 0.30
    sources = tenant.sources if tenant.sources else []
    indexed = [s for s in sources if s.status == "indexed"]
    if len(indexed) >= 1:
        score += 0.05
    if len(indexed) >= 5:
        score += 0.10
    if len(indexed) >= 15:
        score += 0.10
    if len(indexed) >= 30:
        score += 0.05

    # Module awareness (15%)
    max_points += 0.15
    modules = tenant.site_modules if tenant.site_modules else []
    if len(modules) >= 1:
        score += 0.05
    if len(modules) >= 3:
        score += 0.05
    if len(modules) >= 5:
        score += 0.05

    # Business context (15%)
    max_points += 0.15
    settings = tenant.settings or {}
    if settings.get("business_type"):
        score += 0.05
    if settings.get("opening_hours"):
        score += 0.05
    if settings.get("contact_info"):
        score += 0.05

    return min(score / max_points, 1.0) if max_points > 0 else 0.0


def _country_name(code: str) -> str:
    names = {"BE": "België", "NL": "Nederland", "FR": "Frankrijk", "DE": "Duitsland", "GB": "Verenigd Koninkrijk", "US": "Verenigde Staten"}
    return names.get(code, code)


def _get_season(month: int) -> str:
    if month in (3, 4, 5):
        return "lente"
    elif month in (6, 7, 8):
        return "zomer"
    elif month in (9, 10, 11):
        return "herfst"
    return "winter"


def _get_greeting_style(hour: int) -> str:
    if hour < 6:
        return "nacht"
    elif hour < 12:
        return "goedemorgen"
    elif hour < 18:
        return "goedemiddag"
    elif hour < 22:
        return "goedenavond"
    return "nacht"
