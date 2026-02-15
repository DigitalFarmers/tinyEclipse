# TinyEclipse Integrations

Connect any website to TinyEclipse — AI Chat, Visitor Tracking, Proactive Help & 24/7 Monitoring.

## WordPress (Plugin)

1. Download `wordpress/tinyeclipse-connector/` folder
2. Upload to `wp-content/plugins/tinyeclipse-connector/`
3. Activate in WordPress → Plugins
4. Go to WordPress → TinyEclipse
5. Enter your Tenant ID (from Eclipse HUB)
6. Configure colors, language, position
7. Enable → Save

## Next.js / React

1. Copy `nextjs/TinyEclipse.tsx` to your `components/` folder
2. Add to your layout:

```tsx
import { TinyEclipse } from '@/components/TinyEclipse';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <TinyEclipse
        tenantId="your-tenant-id"
        color="#6C3CE1"
        name="My AI"
        lang="nl"
      />
    </>
  );
}
```

## Any Website (Universal Embed)

Add this before `</body>`:

```html
<script src="https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js"
  data-tenant="YOUR_TENANT_ID"
  data-api="https://api.tinyeclipse.digitalfarmers.be"
  data-color="#6C3CE1"
  data-name="AI Assistant"
  data-lang="nl"
  data-position="bottom-right"
  async></script>
```

## Configuration Options

| Attribute | Default | Description |
|---|---|---|
| `data-tenant` | (required) | Your Tenant ID from Eclipse HUB |
| `data-api` | `https://api.tinyeclipse.digitalfarmers.be` | API endpoint |
| `data-color` | `#6C3CE1` | Theme color (hex) |
| `data-name` | `AI Assistant` | Name shown in chat header |
| `data-lang` | `nl` | Language: `nl`, `en`, `fr` |
| `data-position` | `bottom-right` | Widget position |

## Domain Migration

When moving a site to a new domain, use the API:

```bash
curl -X PATCH "https://api.tinyeclipse.digitalfarmers.be/api/admin/tenants/TENANT_ID/domain?domain=newdomain.com" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

All monitoring, analytics, and AI data are preserved automatically.
