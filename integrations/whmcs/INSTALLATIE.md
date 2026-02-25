# TinyEclipse WHMCS Addon — Installatie Handleiding

## Locatie op je PC

```
/Users/motouzani/BUILDS/tinyEclipse/integrations/whmcs/modules/addons/tinyeclipse/tinyeclipse.php
```

---

## Stap 1: Bestanden uploaden naar WHMCS

Er zijn **2 bestanden** die je moet uploaden:

| Bestand | Doel | WHMCS locatie |
|---------|------|---------------|
| `tinyeclipse.php` (addon) | Addon module: config, admin, provisioning | `modules/addons/tinyeclipse/tinyeclipse.php` |
| `tinyeclipse.php` (hooks) | Globale hooks: Command Center op product pagina | `includes/hooks/tinyeclipse.php` |

### Lokale bestanden op je Mac:

```
integrations/whmcs/modules/addons/tinyeclipse/tinyeclipse.php  ← Addon module
integrations/whmcs/includes/hooks/tinyeclipse.php               ← Globale hooks
```

### Upload via SCP:

```bash
# Addon module
scp /Users/motouzani/BUILDS/tinyEclipse/integrations/whmcs/modules/addons/tinyeclipse/tinyeclipse.php \
    root@WHMCS-SERVER:/pad/naar/whmcs/modules/addons/tinyeclipse/tinyeclipse.php

# Hooks file (BELANGRIJK — zonder dit werkt Command Center niet op product pagina!)
scp /Users/motouzani/BUILDS/tinyEclipse/integrations/whmcs/includes/hooks/tinyeclipse.php \
    root@WHMCS-SERVER:/pad/naar/whmcs/includes/hooks/tinyeclipse.php
```

### Of via FileZilla / SFTP:
1. Upload `modules/addons/tinyeclipse/tinyeclipse.php` → WHMCS `modules/addons/tinyeclipse/`
2. Upload `includes/hooks/tinyeclipse.php` → WHMCS `includes/hooks/`

### Rechten:
```bash
chown www-data:www-data /pad/naar/whmcs/modules/addons/tinyeclipse/tinyeclipse.php
chown www-data:www-data /pad/naar/whmcs/includes/hooks/tinyeclipse.php
chmod 644 /pad/naar/whmcs/modules/addons/tinyeclipse/tinyeclipse.php
chmod 644 /pad/naar/whmcs/includes/hooks/tinyeclipse.php
```

> **WAAROM 2 bestanden?** WHMCS laadt addon module bestanden alleen op de addon-pagina zelf.
> De hooks file in `includes/hooks/` laadt op **elke** pagina — zo verschijnt het Command Center
> ook op `clientarea.php?action=productdetails&id=X`.

---

## Stap 2: Addon activeren in WHMCS

1. Log in op je **WHMCS Admin Panel** (bijv. `https://whmcs.jouwdomein.nl/admin`)
2. Ga naar **Setup** (bovenaan menu)
3. Klik op **Addon Modules**
4. Zoek **TinyEclipse** in de lijst
5. Klik op **Activate** (het groene vinkje)

---

## Stap 3: Addon configureren

Na activatie verschijnt er een **Configure** knop naast TinyEclipse:

| Veld | Waarde | Uitleg |
|------|--------|--------|
| **API URL** | `https://api.tinyeclipse.digitalfarmers.be` | Jouw TinyEclipse backend URL |
| **Portal URL** | `https://tinyeclipse.digitalfarmers.be/portal` | Waar klanten naartoe gaan |
| **Admin API Key** | `te-admin-bN5cF8hJ3kM6pS9u` | De admin key van je backend |
| **SSO Secret** | *(zie stap 4)* | Moet matchen met je backend |

Klik **Save Changes**.

---

## Stap 4: SSO instellen (Single Sign-On)

### Wat is SSO?

SSO = Single Sign-On. Dit betekent dat een klant die ingelogd is in WHMCS
**automatisch** wordt ingelogd in het TinyEclipse portal zonder apart in te loggen.

### Hoe werkt het?

```
Klant logt in op WHMCS
       ↓
Klant klikt "⚡ Website Dashboard" in sidebar
       ↓
WHMCS maakt een beveiligde link aan met:
  - tenant_id (welke site)
  - timestamp (wanneer)
  - signature (HMAC-SHA256 bewijs dat WHMCS de link maakte)
       ↓
TinyEclipse Portal checkt de signature
  → klopt? → klant is ingelogd
  → klopt niet of verlopen? → toegang geweigerd
```

### SSO Secret instellen:

**A. Zoek je APP_SECRET_KEY in de backend:**

```bash
# SSH naar je Dokploy server (51.89.23.93)
# Zoek de APP_SECRET_KEY environment variable van je backend app
# Dit staat in Dokploy → Projects → TinyEclipse → Backend → Environment
```

Of check in je `.env` bestand:
```bash
grep APP_SECRET_KEY /pad/naar/backend/.env
```

**B. Kopieer die waarde naar WHMCS:**

1. Ga naar WHMCS Admin → Setup → Addon Modules → TinyEclipse → Configure
2. Plak de waarde in het **SSO Secret** veld
3. Save Changes

> **BELANGRIJK**: De SSO Secret in WHMCS MOET exact dezelfde waarde zijn als
> APP_SECRET_KEY in je TinyEclipse backend. Anders werkt SSO niet!

---

## Stap 5: Testen

### Test 1: Admin overzicht
1. Ga in WHMCS Admin naar **Addons** → **TinyEclipse**
2. Je moet een overzicht zien van gekoppelde sites
3. Onderaan staat "Hub Status" met het aantal tenants

### Test 2: SSO testen
1. Log in als een klant in het WHMCS Client Area
2. In de linker sidebar moet je zien: **⚡ Website Dashboard**
3. Klik erop → je wordt doorgestuurd naar het TinyEclipse Portal
4. Je bent automatisch ingelogd (geen apart wachtwoord nodig)

### Test 3: Auto-provisioning
1. Maak een test-order aan in WHMCS voor een TinyEclipse product
2. Check of er automatisch een tenant wordt aangemaakt in Eclipse
3. Bekijk de WHMCS Activity Log voor "TinyEclipse: Provisioned tenant..."

---

## Veelvoorkomende problemen

### "Hub Status" toont "Kan Hub niet bereiken"
- Check of de API URL correct is
- Check of de Admin API Key klopt
- Test: `curl -H "X-Admin-Key: te-admin-bN5cF8hJ3kM6pS9u" https://api.tinyeclipse.digitalfarmers.be/api/admin/tenants/`

### SSO link werkt niet
- Check of SSO Secret exact matcht met APP_SECRET_KEY
- SSO links verlopen na 5 minuten — klik opnieuw
- Check of de Portal URL correct is

### Geen "Website Dashboard" in client sidebar
- De klant moet gekoppeld zijn aan een tenant (via provisioning of handmatig)
- Check of `mod_tinyeclipse_links` tabel bestaat: `SELECT * FROM mod_tinyeclipse_links;`

### Auto-provisioning werkt niet
- WHMCS moet de hooks kunnen uitvoeren
- Check WHMCS Admin → Utilities → Activity Log voor errors
- De product naam moet "pro" of "pro+" bevatten voor plan detectie

---

## Handmatig een klant koppelen

Als auto-provisioning niet werkt, kun je handmatig koppelen:

```sql
INSERT INTO mod_tinyeclipse_links (client_id, tenant_id, domain, plan, status)
VALUES (1401, 'e71307b8-a263-4a0f-bdb5-64060fcd84d1', 'chocotale.online', 'pro', 'active');
```

Vervang:
- `1401` → WHMCS client ID
- `e71307b8-...` → TinyEclipse tenant ID
- `chocotale.online` → domein
- `pro` → plan (tiny/pro/pro_plus)
