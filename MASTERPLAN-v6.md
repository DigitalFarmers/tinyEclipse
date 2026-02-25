# MASTERPLAN v6 — TinyEclipse: The Gold Standard

> "Elke klant begrijpt zijn digitale omgeving. Elke AI-beslissing is uitlegbaar."

**Versie:** 6.0 — 24 februari 2026  
**Auteur:** Digital Farmers  
**Status:** Pillar 1 voltooid, Pillar 2-6 gepland

---

## Inhoudsopgave

1. [Huidige Status & Analyse](#1-huidige-status--analyse)
2. [Architectuur Overzicht](#2-architectuur-overzicht)
3. [Pillar 1: Foundation Stabilisatie](#3-pillar-1-foundation-stabilisatie) ✅
4. [Pillar 2: AI-Driven Priority Inbox](#4-pillar-2-ai-driven-priority-inbox)
5. [Pillar 3: Deep Analytics](#5-pillar-3-deep-analytics)
6. [Pillar 4: Cross-Site Sync Engine](#6-pillar-4-cross-site-sync-engine)
7. [Pillar 5: AI Cross-Site Intelligence](#7-pillar-5-ai-cross-site-intelligence)
8. [Pillar 6: WHMCS Deep Integration](#8-pillar-6-whmcs-deep-integration)
9. [Roadmap & Planning](#9-roadmap--planning)

---

## 1. Huidige Status & Analyse

### Wat werkt ✅

| Component | Status | Omvang |
|-----------|--------|--------|
| WP Plugin: tinyeclipse-connector v5.0.0 | Stabiel | ~4.400 regels |
| WP Plugin: tinyeclipse-wc v1.0.0 | Nu met Producten + Bestellingen pagina's | ~870 regels |
| WP Plugin: tinyeclipse-analytics v1.0.0 | Tracker werkt | ~670 regels |
| WP Plugin: site-intelligence | Deep scan + WPML | ~600 regels |
| Backend: FastAPI + 37 routers | Start clean, alle modellen correct | ~18.000 regels |
| Hub Admin: 26 pagina's | Dashboard, monitoring, alerts, chat, analytics | ~15.000 regels |
| Hub Portal: 25 pagina's | Klant-facing, modulair, plan-gated | ~12.000 regels |
| WHMCS API bridge | Client lookup + SSO | ~2.000 regels |
| Monitoring: 8 check types | Uptime, SSL, DNS, SMTP, headers, performance, forms, content | ~2.000 regels |

### Wat gefixed is (Pillar 1) ✅

| Fix | Bestand | Impact |
|-----|---------|--------|
| CommandQueue mapper error | `models/command_queue.py` | Backend start |
| SiteModule back_populates mismatch | `models/site_module.py` | Monitoring loop |
| Python 3.9 type annotations | `routers/change_requests.py` | Router loading |
| Tenant.modules → site_modules | `calibration.py`, `geo_enrichment.py` | Calibratie |
| AlertNotification → ProactiveAlert | `models/alerts.py` | Relationship fix |
| Models __init__.py imports | `models/__init__.py` | SQLAlchemy mapper |
| WPML-aware dashboard | `dashboard.php`, `tinyeclipse-connector.php` | Juiste page counts |
| Jobs module niet verlicht | `dashboard.php` | Module detectie |
| Acties knoppen fake | `dashboard.php` | Loading states + feedback |
| Producten pagina verloren | `tinyeclipse-wc.php` + nieuwe views | Permanent in sidebar |

### Wat nog ontbreekt ❌

- **Alert deduplicatie**: Zelfde alert vult de DB elke check cycle
- **AI alert classificatie**: Geen prioritering, geen auto-fix
- **Deep analytics**: Geen date range, geen geo, geen language bundling
- **Cross-site sync**: Geen product/voorraad/klant sync tussen sites
- **AI intelligence**: Geen patroonherkenning across sites
- **WHMCS addon**: Geen client area tile, geen auto-provisioning

### Tenants (Chocotale Group — WHMCS #1401)

| Domain | Environment | Tenant ID |
|--------|------------|-----------|
| chocotale.online | production | `e71307b8-a263-4a0f-bdb5-64060fcd84d1` |
| staging.chocotale.online | staging | `5782713d-2bb6-4e27-8e33-682baff510ed` |
| tuchochocolate.com | production | `754a5b7c-4ac3-4093-a83b-3dbc673670ba` |
| staging.tuchochocolate.com | staging | `1f7c78cb-bf19-49d9-a3b8-2f61c94cf912` |

---

## 2. Architectuur Overzicht

```
┌────────────────────────────────────────────────────────────┐
│                    WHMCS Billing Layer                      │
│  Auto-provisioning · Plan sync · Client area tile          │
└─────────────────────────┬──────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────┐
│               Eclipse Hub (Next.js PWA)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Admin Panel   │  │ Client Portal│  │ AI Priority Inbox│  │
│  │ 26 pages      │  │ 25 pages     │  │ Smart alerts     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────┬──────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────┐
│            Eclipse Backend (FastAPI + PostgreSQL)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Monitoring │ │AI Engine │ │Cross-Site│ │Command Queue │  │
│  │8 checks   │ │Classify  │ │Sync      │ │Auto-fix      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────┬──────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────┐
│             WordPress Sites (3-Plugin Architecture)         │
│  ┌─────────────────┐ ┌────────────┐ ┌─────────────────┐   │
│  │Connector v5.0.0 │ │WC v1.0.0   │ │Analytics v1.0.0 │   │
│  │Core + 12 modules│ │Products    │ │Visitor tracking  │   │
│  │Chat + AI + Sync │ │Orders      │ │Privacy-first     │   │
│  └─────────────────┘ └────────────┘ └─────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Pillar 1: Foundation Stabilisatie ✅

**Status: VOLTOOID**

Alle fixes zijn geïmplementeerd:

### Backend Fixes
- `CommandQueue` model: `sqlalchemy.Enum` → `enum.Enum` + alias
- `SiteModule.tenant` relationship: `back_populates="modules"` → `"site_modules"`
- `change_requests.py`: `str | None` → `Optional[str]` (Python 3.9)
- `calibration.py` + `geo_enrichment.py`: `tenant.modules` → `tenant.site_modules`
- `alerts.py`: `AlertNotification.alert` → relationship to `ProactiveAlert`
- `models/__init__.py`: imports voor `CommandQueue`, `AlertRule`, `ProactiveAlert`, `PushSubscription`, etc.

### WP Dashboard Fixes
- **WPML-aware counting**: Pagina/product/post tellers tonen nu alleen hoofdtaal + `×N talen`
- **Vertaal-synchronisatie panel**: Per-taal progress bars met ontbrekende vertalingen
- **Jobs module**: `AND` → `OR` zodat TinyEclipse_Jobs OF post_type=job_listing voldoende is
- **Acties knoppen**: Loading states, echte AJAX calls, resultaat feedback (niet meer "fake")

### WC Plugin Fixes
- **3 aparte menu items** i.p.v. 1 "WooCommerce" item:
  - 📦 **Producten** — volledig product overzicht met zoeken, filters, WPML vertaalstatus, voorraad badges
  - 🛒 **Bestellingen** — bestellingen met status tabs, klantinfo, omzet stats
  - 📊 **Shop Stats** — omzet dashboard
- **TINYECLIPSE_WC_DIR** constant toegevoegd
- View bestanden: `admin/views/products.php`, `admin/views/orders.php`

---

## 4. Pillar 2: AI-Driven Priority Inbox

> Van honderden alerts naar 3-5 acties die ertoe doen.

### 2.1 Alert Deduplicatie (Backend)
**Model: `Alert`** — Nieuwe velden:
- `dedup_key` (String, indexed) — hash van `check_id + title`
- `occurrence_count` (Integer, default=1)
- `last_seen_at` (DateTime)

**Service: `monitor.py`** — execute_check_and_store():
- Check of open alert met dezelfde `dedup_key` bestaat
- Zo ja: update `occurrence_count` + `last_seen_at`, geen nieuw record
- Zo nee: maak nieuw alert record

### 2.2 AI Alert Classificatie
**Nieuw service: `app/services/alert_intelligence.py`**
- Classificeer elke alert: `auto_fixable`, `needs_attention`, `informational`
- Priority score (0-100): severity × impact × recency × tenant_plan
- Auto-fix pipeline:
  - `security_headers` → stuur fix-commando naar WP plugin (.htaccess)
  - `ssl_warning` → log + notificatie
  - `uptime_critical` → directe escalatie
  - `performance_warning` → suppress bij < 3 opeenvolgend

### 2.3 Smart Alert Grouping
- Groepeer per `check_type × ClientAccount`
- "4 sites missen X-Frame-Options" → ÉÉN groep-alert
- Actie: "Fix alle 4 sites" (één klik) of individueel

### 2.4 Priority Inbox UI
Vervang huidige flat alert lijst met:
- **Priority Inbox** — top 3-5 AI-gerankte acties
- **Auto-resolved feed** — wat Eclipse automatisch heeft opgelost
- **Onderdrukt** — terugkerende bekende issues (configureerbaar)
- **Stats balk** — "23 issues auto-opgelost vandaag, 2 vereisen aandacht"

### 2.5 WP Plugin Auto-Fix Commands
Nieuwe commando types:
- `fix_security_headers` → HSTS, CSP, X-Frame in `.htaccess`
- `fix_file_permissions` → chmod gevoelige bestanden
- `fix_debug_mode` → WP_DEBUG uitzetten
- `fix_file_editor` → DISALLOW_FILE_EDIT activeren

---

## 5. Pillar 3: Deep Analytics

> Van oppervlakkige stats naar actionable intelligence.

### 3.1 Enhanced Analytics Backend
**Nieuw endpoint: `GET /api/admin/analytics/{tenant_id}/deep`**
- **Date range**: custom van/tot met presets (vandaag, 7d, 30d, 90d, YTD)
- **Dimensies**: groepeer per land, device, browser, taal, referrer, UTM
- **WPML page bundling**: `/chocolade-bonbons/` + `/en/chocolate-bonbons/` + `/fr/bonbons-chocolat/` = 1 content unit
- **Funnel tracking**: landing → browse → cart → checkout → purchase

### 3.2 Rich Analytics UI
- **Date range picker** met vergelijkingsperiode
- **Geo kaart** (land heat map)
- **Device/browser grafieken**
- **Taal distributie** (WPML-aware bundling)
- **Referrer breakdown** (Google, social, direct, email)
- **Top pagina's** met scroll depth, tijd op pagina, bounce rate
- **Session explorer** — klik een sessie voor volledig pad
- **Real-time teller** (live bezoekers)

### 3.3 Portal Analytics (Klant)
Vereenvoudigde versie:
- "Hoeveel bezoekers deze maand?"
- "Waar komen ze vandaan?"
- "Welke pagina's zijn populair?"
- "Hoe goed converteert mijn site?"

---

## 6. Pillar 4: Cross-Site Sync Engine

> Eén Eclipse, al je sites in perfecte harmonie.

### 4.1 Product Sync
**Nieuw service: `app/services/cross_site_sync.py`**
- Master product catalog op ClientAccount niveau
- `sync_group_id` linkt productversies tussen sites
- Detectie: zelfde SKU, vergelijkbare titel, matching afbeeldingen → auto-suggest link
- Sync: prijs, voorraad, beschrijving, afbeeldingen — per-site overrides mogelijk
- Richting: bidirectioneel of master→slave configureerbaar

### 4.2 Voorraad Sync
- Real-time voorraad niveau sync
- Order op Tucho → verlaag voorraad op Chocotale
- WP plugin stuurt `stock_changed` event → backend propageert naar sibling sites

### 4.3 Klant Deduplicatie
- Match per e-mail → unified klantprofiel
- "Jan Janssen kocht 3x op Chocotale, 1x op Tucho"

### 4.4 WP Plugin Sync Agent
**Nieuw class: `class-tinyeclipse-sync-agent.php`**
- Luistert naar sync commando's van Hub
- Past product/voorraad updates toe op lokaal WooCommerce
- Rapporteert succes/fout terug

### 4.5 Sync Dashboard
**Nieuw pagina: `/admin/sync`**
- Visueel diagram van verbonden sites
- Sync status per entity type
- Conflict resolutie UI (prijs verschilt → kies winnaar)
- Sync geschiedenis log

---

## 7. Pillar 5: AI Cross-Site Intelligence

> AI die patronen ziet over je hele digitale ecosysteem.

### 5.1 Patroon Detectie
**Nieuw service: `app/services/cross_site_intelligence.py`**
- "Product X verkoopt 50/maand op Tucho maar staat niet op Chocotale — toevoegen?"
- "Chocotale heeft 30% Franse bezoekers maar geen Franse vertalingen"
- "Beide sites hebben zelfde abandoned cart rate (23%) — checkout probleem?"
- "Klant overlap: 12% koopt op beide sites — loyaliteitsprogramma?"

### 5.2 AI Recommendations Engine
Actiegerichte aanbevelingen gescoord op geschatte omzet impact:
- **Product kansen** — ontbrekende producten, prijsverschillen, voorraad alerts
- **Traffic inzichten** — publiek verschillen, marketing kanaal gaps
- **Operationele alerts** — gedeelde kwetsbaarheden, update planning

### 5.3 Intelligence Dashboard
**Nieuw pagina: `/admin/insights/cross-site`**
- AI-gegenereerd wekelijks rapport per ClientAccount
- Actie-kaarten met "Toepassen" knoppen
- Omzet impact schattingen
- Trend vergelijkingen tussen sites

---

## 8. Pillar 6: WHMCS Deep Integration

> Naadloze brug tussen billing en operaties.

### 6.1 WHMCS Addon Module
**Nieuw: `whmcs/tinyeclipse_addon/`**
- "Eclipse Dashboard" tegel in WHMCS client area
- Toont: site status, scan score, open alerts, recente activiteit
- Eén-klik link naar volledig TinyEclipse portaal (SSO)

### 6.2 Auto-Provisioning
Wanneer WHMCS product wordt geactiveerd:
1. Maak Tenant in Eclipse backend
2. Genereer API key
3. Stuur welkom e-mail met setup instructies
4. Auto-setup standaard monitoring checks
5. Maak standaard knowledge base van WHMCS product beschrijving

### 6.3 Billing Sync
- Plan wijzigingen in WHMCS → auto-update tenant plan in Eclipse
- Gebruik limieten afgedwongen: berichten, pagina's, monitoring checks
- Upgrade prompts in portaal linken naar WHMCS upgrade pagina

### 6.4 Shop Manager Admin Account
- Dedicated `shopmanager@tinyeclipse.digitalfarmers.be` admin account
- Automatisch aangemaakt bij tenant provisioning
- Beperkte rechten: alleen Eclipse-gerelateerde functies
- SSO vanuit WHMCS client area

---

## 9. Roadmap & Planning

| Week | Pillar | Deliverables | Status |
|------|--------|-------------|--------|
| 1 | **P1: Foundation** | Backend fix, WPML dashboard, Producten pagina, Acties fix | ✅ DONE |
| 2-3 | **P2: Alert Intelligence** | Deduplicatie, AI classificatie, auto-fix, Priority Inbox UI | 🔲 NEXT |
| 3-4 | **P3: Deep Analytics** | Date range, geo, language bundling, funnel, real-time | 🔲 PLANNED |
| 4-6 | **P4: Cross-Site Sync** | Product sync, voorraad sync, klant dedup, sync dashboard | 🔲 PLANNED |
| 6-8 | **P5: AI Intelligence** | Patroon detectie, recommendations, intelligence dashboard | 🔲 PLANNED |
| 8-10 | **P6: WHMCS Deep** | Addon module, auto-provisioning, billing sync | 🔲 PLANNED |

### Deployment
- **Server:** 51.89.23.93 (Dokploy)
- **Backend:** `api.tinyeclipse.digitalfarmers.be`
- **Hub:** `tinyeclipse.digitalfarmers.be`
- **Admin:** `tinyeclipse.digitalfarmers.be/admin`
- **Portal:** `tinyeclipse.digitalfarmers.be/portal`

---

*TinyEclipse v6 — Digital Farmers © 2026*
