from typing import List

import httpx
import trafilatura
from bs4 import BeautifulSoup


async def scrape_url(url: str) -> dict:
    """Scrape a URL and extract clean text content.

    Returns dict with: title, content, url
    """
    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        headers={"User-Agent": "TinyEclipse/1.0 (Content Indexer)"},
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text

    # Extract title
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else url

    # Extract clean text using trafilatura
    content = trafilatura.extract(
        html,
        include_comments=False,
        include_tables=True,
        no_fallback=False,
    )

    if not content:
        # Fallback: extract text from body
        body = soup.find("body")
        content = body.get_text(separator="\n", strip=True) if body else ""

    return {
        "title": title,
        "content": content or "",
        "url": url,
    }


async def scrape_sitemap(base_url: str, max_pages: int = 50) -> List[str]:
    """Try to discover pages from a sitemap.xml.

    Returns list of URLs found.
    """
    urls = []
    sitemap_urls = [
        f"{base_url.rstrip('/')}/sitemap.xml",
        f"{base_url.rstrip('/')}/sitemap_index.xml",
    ]

    async with httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=True,
        headers={"User-Agent": "TinyEclipse/1.0 (Content Indexer)"},
    ) as client:
        for sitemap_url in sitemap_urls:
            try:
                response = await client.get(sitemap_url)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, "html.parser")
                    for loc in soup.find_all("loc"):
                        url = loc.get_text(strip=True)
                        if url and url not in urls:
                            urls.append(url)
                        if len(urls) >= max_pages:
                            break
                if urls:
                    break
            except Exception:
                continue

    return urls[:max_pages]
