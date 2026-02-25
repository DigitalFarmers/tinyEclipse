"""
Deep Content Scraper v2 — WordPress REST API + WooCommerce + Structured Knowledge Extraction.

Instead of just scraping HTML, this:
1. Discovers ALL content via WordPress REST API (pages, posts, products, menus)
2. Extracts structured knowledge points (locations, contacts, hours, prices)
3. Scrapes WooCommerce products with full details
4. Builds rich, queryable knowledge base per tenant
5. Falls back to sitemap + HTML scraping for non-WordPress sites
"""
from __future__ import annotations
import re
import json
import logging
from urllib.parse import urljoin

import httpx
import trafilatura
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "TinyEclipse/2.0 (Deep Content Indexer)"}
TIMEOUT = 20.0


# ─── WordPress REST API Discovery ───

async def discover_wp_content(base_url: str) -> dict:
    """
    Discover all content via WordPress REST API.
    Returns dict with pages, posts, products, categories, menus.
    """
    base_url = base_url.rstrip("/")
    api_base = f"{base_url}/wp-json/wp/v2"
    wc_base = f"{base_url}/wp-json/wc/store/v1"
    result = {"pages": [], "posts": [], "products": [], "categories": [], "is_wordpress": False, "is_woocommerce": False}

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, headers=HEADERS) as client:
        # Check if WordPress
        try:
            r = await client.get(f"{base_url}/wp-json/")
            if r.status_code == 200:
                result["is_wordpress"] = True
                wp_info = r.json()
                result["site_name"] = wp_info.get("name", "")
                result["site_description"] = wp_info.get("description", "")
            else:
                return result
        except Exception:
            return result

        # Fetch all pages (up to 100)
        try:
            r = await client.get(f"{api_base}/pages", params={"per_page": 100, "status": "publish"})
            if r.status_code == 200:
                result["pages"] = r.json()
                logger.info(f"[deep-scrape] Found {len(result['pages'])} WP pages")
        except Exception as e:
            logger.warning(f"[deep-scrape] Failed to fetch pages: {e}")

        # Fetch all posts (up to 100)
        try:
            r = await client.get(f"{api_base}/posts", params={"per_page": 100, "status": "publish"})
            if r.status_code == 200:
                result["posts"] = r.json()
                logger.info(f"[deep-scrape] Found {len(result['posts'])} WP posts")
        except Exception as e:
            logger.warning(f"[deep-scrape] Failed to fetch posts: {e}")

        # Fetch categories
        try:
            r = await client.get(f"{api_base}/categories", params={"per_page": 100})
            if r.status_code == 200:
                result["categories"] = r.json()
        except Exception:
            pass

        # Check WooCommerce Store API
        try:
            r = await client.get(f"{wc_base}/products", params={"per_page": 100})
            if r.status_code == 200:
                result["is_woocommerce"] = True
                result["products"] = r.json()
                logger.info(f"[deep-scrape] Found {len(result['products'])} WooCommerce products")
        except Exception:
            # Try legacy WC REST API
            try:
                r = await client.get(f"{base_url}/wp-json/wc/v3/products", params={"per_page": 100})
                if r.status_code == 200:
                    result["is_woocommerce"] = True
                    result["products"] = r.json()
            except Exception:
                pass

    return result


# ─── Content Extraction from WP API ───

def extract_wp_page_content(page: dict) -> dict:
    """Extract clean content from a WordPress REST API page/post object."""
    title = page.get("title", {}).get("rendered", "") or ""
    raw_content = page.get("content", {}).get("rendered", "") or ""
    excerpt = page.get("excerpt", {}).get("rendered", "") or ""
    slug = page.get("slug", "")
    link = page.get("link", "")

    # Clean HTML to text
    soup = BeautifulSoup(raw_content, "html.parser")

    # Extract structured elements before stripping HTML
    structured = extract_structured_data(soup, raw_content)

    # Clean text
    clean_text = soup.get_text(separator="\n", strip=True)
    clean_excerpt = BeautifulSoup(excerpt, "html.parser").get_text(strip=True)
    clean_title = BeautifulSoup(title, "html.parser").get_text(strip=True)

    return {
        "title": clean_title,
        "content": clean_text,
        "excerpt": clean_excerpt,
        "url": link,
        "slug": slug,
        "structured": structured,
        "type": page.get("type", "page"),
    }


def extract_wc_product_content(product: dict) -> dict:
    """Extract rich content from a WooCommerce product."""
    name = product.get("name", "")
    description = product.get("description", "") or product.get("short_description", "")
    price = product.get("price", "") or product.get("prices", {}).get("price", "")
    regular_price = product.get("regular_price", "") or ""
    sale_price = product.get("sale_price", "") or ""
    categories = [c.get("name", "") for c in product.get("categories", [])]
    images = [img.get("src", "") for img in product.get("images", [])]
    permalink = product.get("permalink", "") or product.get("link", "")
    sku = product.get("sku", "")
    stock_status = product.get("stock_status", "") or product.get("is_in_stock", "")

    # Clean HTML
    clean_desc = BeautifulSoup(description, "html.parser").get_text(separator="\n", strip=True) if description else ""
    clean_name = BeautifulSoup(name, "html.parser").get_text(strip=True) if "<" in name else name

    # Format price
    price_str = ""
    if price:
        # WC Store API returns price in cents
        try:
            if isinstance(price, str) and len(price) > 2:
                price_str = f"€{int(price) / 100:.2f}"
            else:
                price_str = f"€{price}"
        except (ValueError, TypeError):
            price_str = str(price)

    # Build rich content string
    content_parts = [f"Product: {clean_name}"]
    if price_str:
        content_parts.append(f"Prijs: {price_str}")
    if regular_price and sale_price:
        content_parts.append(f"Normale prijs: €{regular_price}, Actieprijs: €{sale_price}")
    if categories:
        content_parts.append(f"Categorie: {', '.join(categories)}")
    if sku:
        content_parts.append(f"SKU: {sku}")
    if stock_status:
        stock_label = "Op voorraad" if stock_status in ("instock", True) else "Niet op voorraad"
        content_parts.append(f"Beschikbaarheid: {stock_label}")
    if clean_desc:
        content_parts.append(f"\n{clean_desc}")

    return {
        "title": f"Product: {clean_name}",
        "content": "\n".join(content_parts),
        "url": permalink,
        "type": "product",
        "structured": {
            "product_name": clean_name,
            "price": price_str,
            "categories": categories,
            "sku": sku,
        },
    }


# ─── Structured Data Extraction ───

def extract_structured_data(soup: BeautifulSoup, raw_html: str) -> dict:
    """
    Extract structured knowledge points from HTML:
    - Addresses / locations
    - Phone numbers
    - Email addresses
    - Opening hours
    - Social media links
    """
    text = soup.get_text(separator=" ", strip=True)
    data = {}

    # Phone numbers (Belgian/international formats)
    phones = re.findall(r'(?:\+32|0)\s*(?:\d[\s.-]*){8,9}', text)
    if phones:
        data["phones"] = [re.sub(r'\s+', ' ', p.strip()) for p in phones[:5]]

    # Email addresses
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    if emails:
        data["emails"] = list(set(emails))[:5]

    # Addresses (look for Belgian patterns: street + number + postcode + city)
    address_patterns = [
        r'(?:[A-Z][a-zéèêë]+(?:straat|laan|weg|plein|lei|steenweg|dreef|singel|boulevard|baan)\s+\d+[a-zA-Z]?\s*,?\s*\d{4}\s+[A-Z][a-zéèêë]+)',
        r'(?:\d{4}\s+[A-Z][a-zéèêë]+(?:\s+\([^)]+\))?)',
    ]
    addresses = []
    for pattern in address_patterns:
        found = re.findall(pattern, text)
        addresses.extend(found)
    if addresses:
        data["addresses"] = addresses[:5]

    # Opening hours patterns
    hour_patterns = [
        r'(?:ma(?:andag)?|di(?:nsdag)?|wo(?:ensdag)?|do(?:nderdag)?|vr(?:ijdag)?|za(?:terdag)?|zo(?:ndag)?)\s*(?:[-–:])\s*(?:ma(?:andag)?|di(?:nsdag)?|wo(?:ensdag)?|do(?:nderdag)?|vr(?:ijdag)?|za(?:terdag)?|zo(?:ndag)?)?\s*:?\s*\d{1,2}[:.h]\d{2}\s*[-–]\s*\d{1,2}[:.h]\d{2}',
        r'\d{1,2}[:.h]\d{2}\s*[-–]\s*\d{1,2}[:.h]\d{2}',
    ]
    hours = []
    for pattern in hour_patterns:
        found = re.findall(pattern, text, re.IGNORECASE)
        hours.extend(found)
    if hours:
        data["opening_hours"] = hours[:10]

    # Social media links
    social_links = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        for platform in ["facebook.com", "instagram.com", "twitter.com", "linkedin.com", "tiktok.com", "youtube.com"]:
            if platform in href:
                social_links.append({"platform": platform.split(".")[0], "url": href})
                break
    if social_links:
        data["social_media"] = social_links[:6]

    # Google Maps / location embeds
    iframes = soup.find_all("iframe")
    for iframe in iframes:
        src = iframe.get("src", "")
        if "google.com/maps" in src or "maps.google" in src:
            data["has_google_maps"] = True
            break

    return data


# ─── Knowledge Point Generator ───

def generate_knowledge_points(pages_data: list[dict], site_name: str = "") -> list[dict]:
    """
    Generate structured knowledge point sources from extracted data.
    These are high-value, concise facts that the AI can quickly retrieve.
    """
    points = []

    # Aggregate all structured data
    all_phones = set()
    all_emails = set()
    all_addresses = []
    all_hours = []
    all_social = []

    for page in pages_data:
        structured = page.get("structured", {})
        for phone in structured.get("phones", []):
            all_phones.add(phone)
        for email in structured.get("emails", []):
            all_emails.add(email)
        all_addresses.extend(structured.get("addresses", []))
        all_hours.extend(structured.get("opening_hours", []))
        all_social.extend(structured.get("social_media", []))

    # Contact Knowledge Point
    if all_phones or all_emails:
        contact_parts = [f"Contactgegevens van {site_name}:"]
        if all_phones:
            contact_parts.append(f"Telefoonnummer(s): {', '.join(all_phones)}")
        if all_emails:
            contact_parts.append(f"E-mailadres(sen): {', '.join(all_emails)}")
        points.append({
            "title": f"Contactgegevens {site_name}",
            "content": "\n".join(contact_parts),
            "type": "knowledge_point",
        })

    # Location Knowledge Point
    if all_addresses:
        location_parts = [f"Locatie(s) en adres(sen) van {site_name}:"]
        for addr in list(set(all_addresses))[:5]:
            location_parts.append(f"- {addr}")
        points.append({
            "title": f"Locaties {site_name}",
            "content": "\n".join(location_parts),
            "type": "knowledge_point",
        })

    # Opening Hours Knowledge Point
    if all_hours:
        hours_parts = [f"Openingsuren van {site_name}:"]
        for h in list(set(all_hours))[:10]:
            hours_parts.append(f"- {h}")
        points.append({
            "title": f"Openingsuren {site_name}",
            "content": "\n".join(hours_parts),
            "type": "knowledge_point",
        })

    # Social Media Knowledge Point
    if all_social:
        seen = set()
        social_parts = [f"Social media van {site_name}:"]
        for s in all_social:
            key = s["platform"]
            if key not in seen:
                seen.add(key)
                social_parts.append(f"- {s['platform'].title()}: {s['url']}")
        points.append({
            "title": f"Social Media {site_name}",
            "content": "\n".join(social_parts),
            "type": "knowledge_point",
        })

    return points


# ─── Main Deep Scrape Orchestrator ───

async def deep_scrape_site(domain: str) -> dict:
    """
    Full deep scrape of a site. Returns all content ready for indexing.

    Returns:
    {
        "domain": str,
        "is_wordpress": bool,
        "is_woocommerce": bool,
        "pages": [{"title", "content", "url", "type", "structured"}],
        "products": [{"title", "content", "url", "type", "structured"}],
        "knowledge_points": [{"title", "content", "type"}],
        "stats": {"pages": int, "posts": int, "products": int, "knowledge_points": int}
    }
    """
    base_url = f"https://{domain}" if not domain.startswith("http") else domain
    base_url = base_url.rstrip("/")

    logger.info(f"[deep-scrape] Starting deep scrape for {domain}")

    # Step 1: Try WordPress REST API
    wp_data = await discover_wp_content(base_url)

    all_pages = []
    all_products = []

    if wp_data["is_wordpress"]:
        site_name = wp_data.get("site_name", domain)
        logger.info(f"[deep-scrape] WordPress detected: {site_name}")

        # Process pages
        for page in wp_data["pages"]:
            extracted = extract_wp_page_content(page)
            if extracted["content"] and len(extracted["content"].strip()) > 30:
                all_pages.append(extracted)

        # Process posts
        for post in wp_data["posts"]:
            extracted = extract_wp_page_content(post)
            if extracted["content"] and len(extracted["content"].strip()) > 30:
                extracted["type"] = "post"
                all_pages.append(extracted)

        # Process WooCommerce products
        if wp_data["is_woocommerce"]:
            for product in wp_data["products"]:
                extracted = extract_wc_product_content(product)
                if extracted["content"]:
                    all_products.append(extracted)

    else:
        site_name = domain
        # Fallback: sitemap + HTML scraping
        logger.info(f"[deep-scrape] Not WordPress, falling back to sitemap scraping")
        from app.services.scraper import scrape_sitemap, scrape_url

        urls = await scrape_sitemap(base_url, max_pages=100)
        if not urls:
            urls = [base_url]

        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, headers=HEADERS) as client:
            for url in urls[:100]:
                try:
                    r = await client.get(url)
                    if r.status_code != 200:
                        continue
                    html = r.text
                    soup = BeautifulSoup(html, "html.parser")
                    title_tag = soup.find("title")
                    title = title_tag.get_text(strip=True) if title_tag else url

                    content = trafilatura.extract(html, include_comments=False, include_tables=True, no_fallback=False)
                    if not content:
                        body = soup.find("body")
                        content = body.get_text(separator="\n", strip=True) if body else ""

                    if content and len(content.strip()) > 30:
                        structured = extract_structured_data(soup, html)
                        all_pages.append({
                            "title": title,
                            "content": content,
                            "url": url,
                            "type": "page",
                            "structured": structured,
                        })
                except Exception as e:
                    logger.warning(f"[deep-scrape] Failed {url}: {e}")
                    continue

    # Step 2: Also scrape important pages that WP API might miss (contact, about, etc.)
    important_slugs = [
        "/contact", "/over-ons", "/about", "/about-us", "/locatie", "/location",
        "/openingsuren", "/opening-hours", "/faq", "/veelgestelde-vragen",
        "/team", "/ons-team", "/franchise", "/franchising", "/vestigingen",
    ]
    existing_urls = {p.get("url", "").rstrip("/").lower() for p in all_pages}

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, headers=HEADERS) as client:
        for slug in important_slugs:
            url = f"{base_url}{slug}"
            if url.rstrip("/").lower() in existing_urls:
                continue
            try:
                r = await client.get(url)
                if r.status_code == 200:
                    html = r.text
                    soup = BeautifulSoup(html, "html.parser")
                    title_tag = soup.find("title")
                    title = title_tag.get_text(strip=True) if title_tag else slug.strip("/")

                    content = trafilatura.extract(html, include_comments=False, include_tables=True, no_fallback=False)
                    if not content:
                        body = soup.find("body")
                        content = body.get_text(separator="\n", strip=True) if body else ""

                    if content and len(content.strip()) > 30:
                        structured = extract_structured_data(soup, html)
                        all_pages.append({
                            "title": title,
                            "content": content,
                            "url": url,
                            "type": "page",
                            "structured": structured,
                        })
                        logger.info(f"[deep-scrape] Found important page: {slug}")
            except Exception:
                continue

    # Step 3: Generate knowledge points
    knowledge_points = generate_knowledge_points(all_pages + all_products, site_name)

    stats = {
        "pages": len([p for p in all_pages if p["type"] == "page"]),
        "posts": len([p for p in all_pages if p["type"] == "post"]),
        "products": len(all_products),
        "knowledge_points": len(knowledge_points),
        "total_content_items": len(all_pages) + len(all_products) + len(knowledge_points),
    }

    logger.info(f"[deep-scrape] Completed for {domain}: {stats}")

    return {
        "domain": domain,
        "site_name": site_name if wp_data["is_wordpress"] else domain,
        "is_wordpress": wp_data["is_wordpress"],
        "is_woocommerce": wp_data.get("is_woocommerce", False),
        "pages": all_pages,
        "products": all_products,
        "knowledge_points": knowledge_points,
        "stats": stats,
    }
