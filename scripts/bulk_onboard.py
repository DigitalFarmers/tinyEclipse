#!/usr/bin/env python3
"""
TinyEclipse — Bulk Onboarding Script

Add all your websites at once. Each site gets:
1. A tenant created
2. Automatic site scraping + indexing
3. A ready-to-use embed snippet

Usage:
    python scripts/bulk_onboard.py --api http://localhost:8000 --key YOUR_ADMIN_KEY

Edit the SITES list below with your actual websites.
"""

import argparse
import json
import sys
import time
import httpx

# ============================================================
# EDIT THIS LIST — Add all your websites here
# ============================================================
SITES = [
    # WordPress sites
    {"name": "Klant Website 1", "domain": "www.klant1.nl", "plan": "pro", "whmcs_id": 1},
    {"name": "Klant Website 2", "domain": "www.klant2.nl", "plan": "pro", "whmcs_id": 2},
    # Internal projects
    {"name": "Intern Project Alpha", "domain": "alpha.internal.nl", "plan": "pro_plus", "whmcs_id": 100},
    # Add more sites below...
]


def create_tenant(client: httpx.Client, api_url: str, site: dict) -> dict:
    """Create a tenant for a site."""
    resp = client.post(
        f"{api_url}/api/admin/tenants",
        json={
            "whmcs_client_id": site["whmcs_id"],
            "name": site["name"],
            "plan": site["plan"],
            "domain": site["domain"],
        },
    )
    resp.raise_for_status()
    return resp.json()


def scrape_site(client: httpx.Client, api_url: str, tenant_id: str, domain: str) -> dict:
    """Trigger automatic site scraping."""
    url = f"https://{domain}" if not domain.startswith("http") else domain
    resp = client.post(
        f"{api_url}/api/admin/sources/scrape-site",
        params={"tenant_id": tenant_id, "url": url},
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()


def generate_embed_snippet(api_url: str, tenant_id: str) -> str:
    """Generate the embed snippet for a site."""
    return f"""<!-- TinyEclipse AI Widget -->
<script
  src="{api_url}/widget/v1/widget.js"
  data-tenant="{tenant_id}"
  data-api="{api_url}"
  async>
</script>"""


def main():
    parser = argparse.ArgumentParser(description="TinyEclipse Bulk Onboarding")
    parser.add_argument("--api", default="http://localhost:8000", help="Backend API URL")
    parser.add_argument("--key", required=True, help="Admin API key")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without executing")
    args = parser.parse_args()

    if not SITES:
        print("❌ No sites configured. Edit the SITES list in this script.")
        sys.exit(1)

    print(f"\n🚀 TinyEclipse Bulk Onboarding")
    print(f"   API: {args.api}")
    print(f"   Sites: {len(SITES)}")
    print(f"   Mode: {'DRY RUN' if args.dry_run else 'LIVE'}\n")

    if args.dry_run:
        for site in SITES:
            print(f"  [DRY] Would create tenant: {site['name']} ({site['domain']})")
            print(f"  [DRY] Would scrape: https://{site['domain']}")
            print()
        print("Run without --dry-run to execute.")
        return

    client = httpx.Client(
        headers={"X-Admin-Key": args.key, "Content-Type": "application/json"},
        timeout=30.0,
    )

    results = []
    errors = []

    for i, site in enumerate(SITES, 1):
        print(f"[{i}/{len(SITES)}] {site['name']} ({site['domain']})")

        # Step 1: Create tenant
        try:
            tenant = create_tenant(client, args.api, site)
            tenant_id = tenant["id"]
            print(f"  ✅ Tenant created: {tenant_id}")
        except httpx.HTTPStatusError as e:
            print(f"  ❌ Tenant creation failed: {e.response.text}")
            errors.append({"site": site["name"], "error": str(e)})
            continue
        except Exception as e:
            print(f"  ❌ Error: {e}")
            errors.append({"site": site["name"], "error": str(e)})
            continue

        # Step 2: Scrape site
        try:
            scrape_result = scrape_site(client, args.api, tenant_id, site["domain"])
            pages = scrape_result.get("sources_created", 0)
            print(f"  ✅ Scraping started: {pages} pages found")
        except Exception as e:
            print(f"  ⚠️  Scrape failed (can retry later): {e}")

        # Step 3: Generate embed snippet
        snippet = generate_embed_snippet(args.api, tenant_id)

        results.append({
            "name": site["name"],
            "domain": site["domain"],
            "tenant_id": tenant_id,
            "snippet": snippet,
        })

        print(f"  ✅ Ready!\n")
        time.sleep(1)  # Rate limit friendly

    # Summary
    print("\n" + "=" * 60)
    print(f"✅ Successfully onboarded: {len(results)}/{len(SITES)}")
    if errors:
        print(f"❌ Errors: {len(errors)}")
    print("=" * 60)

    # Output embed snippets
    if results:
        print("\n📋 EMBED SNIPPETS (copy-paste per site):\n")
        for r in results:
            print(f"--- {r['name']} ({r['domain']}) ---")
            print(r["snippet"])
            print()

        # Save to file
        output_file = "onboarding_results.json"
        with open(output_file, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Results saved to {output_file}")


if __name__ == "__main__":
    main()
