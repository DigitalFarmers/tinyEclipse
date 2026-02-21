# TinyEclipse Plugin Deployment Guide

## 📦 ZIP Packages (ready to upload)

| Plugin | File | Size |
|--------|------|------|
| Core Connector v5.0.0 | `tinyeclipse-connector.zip` | 66 KB |
| WooCommerce v1.0.0 | `tinyeclipse-wc.zip` | 8 KB |
| Analytics v1.0.0 | `tinyeclipse-analytics.zip` | 8 KB |

---

## 🚀 Staging Deployment (staging.chocotale.online)

### Step 1: Backup
- Take a full backup of staging (DB + files) via hosting panel or WP plugin

### Step 2: Deactivate Old Plugin
- Go to **Plugins → Installed Plugins**
- Deactivate the old `TinyEclipse Connector` (v4.x or `eclipse-ai-connector`)
- Do NOT delete it yet — the new connector will migrate its data

### Step 3: Upload & Activate (in this order!)
1. **tinyeclipse-connector.zip** — Upload via Plugins → Add New → Upload Plugin → Activate
   - This creates 6 DB tables and migrates `eclipse_ai_*` options/data automatically
   - Verify: Go to **Eclipse** menu → Dashboard should load
2. **tinyeclipse-wc.zip** — Upload & Activate
   - Requires WooCommerce to be active
   - Verify: Eclipse menu should show "Shop" submenu item
3. **tinyeclipse-analytics.zip** — Upload & Activate
   - Creates `wp_tinyeclipse_analytics` table
   - Verify: Eclipse menu should show "Analytics" submenu item

### Step 4: Configure
- Go to **Eclipse → Settings**
- Verify **Site ID** / **Tenant ID** is set (should auto-migrate)
- Verify **Hub API Key** is set
- Check connection status shows ✅

### Step 5: Verify Modules
- **Eclipse → Security** — Run scan, check score
- **Eclipse → SEO** — Run audit
- **Eclipse → Mail** — Check SMTP config
- **Eclipse → Tokens** — Verify balance loads
- Visit frontend — chat bubble should appear
- Open browser console — analytics tracker should log pageview

### Step 6: Delete Old Plugin
- Once everything works, delete the old `eclipse-ai-connector` plugin
- Old DB tables are preserved (migration copied data, didn't delete originals)

---

## 🔄 Production Migration (chocotale.be)

### Pre-flight
- [ ] Staging fully tested and working
- [ ] All modules show correct data
- [ ] Chat widget loads on frontend
- [ ] Analytics tracking confirmed in browser console
- [ ] WooCommerce order events firing (test order)
- [ ] REST API responds: `https://staging.chocotale.online/wp-json/tinyeclipse/v1/health`

### Production Steps
1. **Backup** chocotale.be (full DB + files)
2. **Deactivate** old connector on production
3. **Upload & activate** the same 3 ZIPs in order: connector → wc → analytics
4. **Verify** settings migrated (Site ID, Hub API Key)
5. **Test** each module from Eclipse dashboard
6. **Confirm** Hub connection: check Eclipse Hub shows the site as connected
7. **Delete** old plugin once confirmed

### Rollback Plan
- If anything breaks: deactivate new plugins, reactivate old connector
- Old data is never deleted during migration — only copied

---

## 🔑 Important URLs

| Resource | URL |
|----------|-----|
| Staging | https://staging.chocotale.online |
| Production | https://chocotale.be |
| Eclipse Hub | https://tinyeclipse.digitalfarmers.be |
| API | https://api.tinyeclipse.digitalfarmers.be |
| Health Check | `/wp-json/tinyeclipse/v1/health` |
| REST Namespace | `/wp-json/tinyeclipse/v1/` |

---

## ⚠️ Notes
- **Activation order matters**: connector first, then wc, then analytics
- The connector exposes global helpers (`tinyeclipse_get_tenant_id()`, `tinyeclipse_send_event()`) that the other plugins depend on
- Analytics uses NO cookies — fully GDPR compliant
- WC plugin gracefully deactivates if WooCommerce is removed
- All 3 plugins have `uninstall.php` for clean removal
