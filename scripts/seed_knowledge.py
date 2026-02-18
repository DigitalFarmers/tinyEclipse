#!/usr/bin/env python3
"""Seed Chocotale knowledge base by scraping key pages."""
import asyncio
import httpx

API = "https://api.tinyeclipse.digitalfarmers.be"
KEY = "te-admin-bN5cF8hJ3kM6pS9u"
TID = "e71307b8-a263-4a0f-bdb5-64060fcd84d1"
HEADERS = {"X-Admin-Key": KEY, "Content-Type": "application/json"}

PAGES = [
    ("homepage", "https://staging.chocotale.online/"),
    ("about-us", "https://staging.chocotale.online/about-us/"),
    ("contact", "https://staging.chocotale.online/contact/"),
    ("shop", "https://staging.chocotale.online/shop/"),
    ("franchising", "https://staging.chocotale.online/franchising/"),
    ("workshops", "https://staging.chocotale.online/workshops/"),
    ("faq-miscellaneous", "https://staging.chocotale.online/faq/miscallenous/"),
    ("faq-policies", "https://staging.chocotale.online/faq/our-policies/"),
    ("faq-about-us", "https://staging.chocotale.online/faq/about-us/"),
    ("faq-quality", "https://staging.chocotale.online/faq/quality/"),
    ("product-pistachio-garden", "https://staging.chocotale.online/product/pistachio-garden/"),
    ("product-green-velvet", "https://staging.chocotale.online/product/green-velvet/"),
    ("product-the-door-to-your-heart", "https://staging.chocotale.online/product/the-door-to-your-heart/"),
    ("product-angel-donut-box", "https://staging.chocotale.online/product/angel-donut-box/"),
    ("product-spice-field", "https://staging.chocotale.online/product/spice-field/"),
    ("product-pistachio-white-gold", "https://staging.chocotale.online/product/pistachio-garden-white-gold/"),
]


async def seed_page(client: httpx.AsyncClient, title: str, url: str) -> str:
    try:
        # Step 1: Create source
        r = await client.post(
            f"{API}/api/admin/sources/",
            headers=HEADERS,
            json={"tenant_id": TID, "type": "url", "url": url, "title": title},
            timeout=30,
        )
        if r.status_code != 201:
            return f"FAIL create {title}: {r.status_code}"
        sid = r.json().get("id")
        if not sid:
            return f"FAIL create {title}: no id"

        # Step 2: Trigger ingestion
        r2 = await client.post(
            f"{API}/api/admin/sources/{sid}/ingest",
            headers=HEADERS,
            timeout=30,
        )
        if r2.status_code == 200:
            return f"OK   {title}"
        return f"WARN {title}: ingest {r2.status_code}"
    except Exception as e:
        return f"ERR  {title}: {e}"


async def main():
    print(f"Seeding {len(PAGES)} pages for Chocotale...\n")
    async with httpx.AsyncClient() as client:
        # Run 3 at a time to avoid overwhelming the server
        sem = asyncio.Semaphore(3)

        async def limited(title, url):
            async with sem:
                return await seed_page(client, title, url)

        tasks = [limited(t, u) for t, u in PAGES]
        results = await asyncio.gather(*tasks)

    for r in results:
        print(r)
    print(f"\nDone! {sum(1 for r in results if r.startswith('OK'))}/{len(PAGES)} succeeded")


if __name__ == "__main__":
    asyncio.run(main())
