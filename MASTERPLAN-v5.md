# TinyEclipse Masterplan v5 — 3-Plugin Architecture + Ecosystem Evolution

> **Doel:** Ons hele ecosysteem beter laten functioneren dan Apple devices.
> **Strategie:** 3 WordPress plugins, tiered prompt resolution, PWA notifications, customer retention engine.

---

## 1. Plugin Architectuur — De Driehoek

### Plugin 1: `tinyeclipse-connector` (Core)
**Wat het doet:** Alles behalve shop en analytics.
**Installatiegrootte:** ~400 regels (vs huidige 1253)

| Feature | Status |
|---------|--------|
| Widget injectie (chat) | ✅ Bestaat |
| Tenant verbinding + settings UI | ✅ Bestaat |
| Formulieren (Fluent Forms, CF7, Gravity) | ✅ Bestaat |
| SMTP/Mail status | ✅ Bestaat |
| WPML integratie | ✅ Bestaat |
| Module events (forms, jobs) | ✅ Bestaat |
| Content management (pages/posts) | ✅ Bestaat |
| Capabilities endpoint | ✅ Bestaat |
| Site options write | ✅ Bestaat |
| Staging detectie | ✅ Bestaat |
| **Heartbeat** (elke 5 min site health ping) | 🆕 Nieuw |
| **Visitor tracking snippet** (lightweight) | 🆕 Nieuw |

**REST endpoints behouden:**
- `tinyeclipse/v1/config`
- `tinyeclipse/v1/capabilities`
- `tinyeclipse/v1/content`
- `tinyeclipse/v1/options`
- `tinyeclipse/v1/pages/{id}`
- `tinyeclipse/v1/forms`
- `tinyeclipse/v1/forms/{id}/submissions`
- `tinyeclipse/v1/mail/status`
- `tinyeclipse/v1/wpml/*`
- `tinyeclipse/v1/sync/full` (core data only — users, comments, forms, site_meta)

**Hooks behouden:**
- `wp_footer` (widget injectie)
- `fluentform/submission_inserted`
- `wpcf7_mail_sent`
- `gform_after_submission`
- `new_job_application`
- `publish_job_listing`

---

### Plugin 2: `tinyeclipse-wc` (WooCommerce Connector)
**Vereist:** `tinyeclipse-connector` + WooCommerce
**Wat het doet:** Alles shop-gerelateerd — orders, klanten, retentie, abandoned carts, sale tracking.
**Installatiegrootte:** ~600 regels

| Feature | Status |
|---------|--------|
| Order events (new, completed, refunded) | ✅ Verplaatsen uit core |
| Products endpoint | ✅ Verplaatsen uit core |
| Orders endpoint | ✅ Verplaatsen uit core |
| Shop stats endpoint | ✅ Verplaatsen uit core |
| Product write endpoint | ✅ Verplaatsen uit core |
| Order status write endpoint | ✅ Verplaatsen uit core |
| Sync: orders + customers | ✅ Verplaatsen uit core |
| **Abandoned Cart Tracking** | 🆕 Nieuw |
| **Customer Retention Score** | 🆕 Nieuw |
| **Pre-Sale Interaction Tracking** | 🆕 Nieuw |
| **Checkout Failure Logging** | 🆕 Nieuw |
| **Customer Journey Timeline** | 🆕 Nieuw |
| **Revenue Alerts** (PWA push) | 🆕 Nieuw |

**Nieuwe REST endpoints:**
```
tinyeclipse/v1/shop/products          (verplaatst)
tinyeclipse/v1/shop/orders            (verplaatst)
tinyeclipse/v1/shop/stats             (verplaatst)
tinyeclipse/v1/products/{id}          (verplaatst)
tinyeclipse/v1/orders/{id}/status     (verplaatst)
tinyeclipse/v1/shop/abandoned-carts   (nieuw)
tinyeclipse/v1/shop/retention         (nieuw)
tinyeclipse/v1/shop/customer-journey  (nieuw)
tinyeclipse/v1/shop/checkout-failures (nieuw)
tinyeclipse/v1/sync/shop              (nieuw — shop-only sync)
```

**Nieuwe WooCommerce hooks:**
```php
// Abandoned Cart Detection
woocommerce_cart_updated          → track cart contents + visitor
woocommerce_cart_emptied          → mark cart abandoned if no order follows
wp_login                          → link anonymous cart to user

// Pre-Sale Tracking
woocommerce_add_to_cart           → track product interest
woocommerce_remove_cart_item      → track hesitation
woocommerce_applied_coupon        → track coupon usage
woocommerce_checkout_process      → track checkout attempt
woocommerce_checkout_order_processed_notification → track checkout failure reason

// Customer Retention
woocommerce_order_status_changed  → track full lifecycle
woocommerce_customer_save_address → profile update
woocommerce_product_review        → engagement signal

// Revenue Intelligence
woocommerce_payment_complete      → real-time revenue alert → PWA push
```

**Abandoned Cart Logica:**
```
1. woocommerce_cart_updated → opslaan in wp_options (tinyeclipse_carts_{session})
2. WP-Cron elke 30 min → check carts ouder dan 1 uur zonder order
3. Stuur abandoned cart event naar Eclipse API
4. Eclipse API → PWA push naar shop admin
5. Contact matcher → link aan bestaand contact of maak nieuw
```

**Customer Retention Score (berekend in backend):**
```
retention_score = weighted_average(
    recency      × 0.30,  # Dagen sinds laatste order
    frequency    × 0.25,  # Orders per maand
    monetary     × 0.20,  # Gemiddelde orderwaarde
    engagement   × 0.15,  # Site bezoeken, chat interacties
    loyalty      × 0.10,  # Maanden als klant
)
```

---

### Plugin 3: `tinyeclipse-analytics` (Analytics & Intelligence)
**Vereist:** `tinyeclipse-connector`
**Optioneel:** `tinyeclipse-wc` (voor conversie tracking)
**Wat het doet:** Bezoekersgedrag, funnels, heatmaps, conversie tracking.
**Installatiegrootte:** ~400 regels

| Feature | Status |
|---------|--------|
| **Visitor Session Tracking** | 🆕 Nieuw (lightweight JS) |
| **Page View Tracking** | 🆕 Nieuw |
| **Scroll Depth** | 🆕 Nieuw |
| **Click Tracking** | 🆕 Nieuw |
| **Exit Intent Detection** | 🆕 Nieuw |
| **Rage Click Detection** | 🆕 Nieuw |
| **Form Abandonment** | 🆕 Nieuw |
| **Conversion Funnels** | 🆕 Nieuw (PRO+) |
| **Heatmap Data** | 🆕 Nieuw (PRO+) |
| **UTM Tracking** | 🆕 Nieuw |
| **Referrer Analysis** | 🆕 Nieuw |

**REST endpoints:**
```
tinyeclipse/v1/analytics/config       → tracking settings
tinyeclipse/v1/analytics/session      → start/update session
tinyeclipse/v1/analytics/pageview     → log page view
tinyeclipse/v1/analytics/event        → log behavioral event
tinyeclipse/v1/analytics/heatmap      → heatmap data (PRO+)
```

**Frontend JS snippet (~3KB gzipped):**
```javascript
// Injectie via wp_footer, alleen als analytics plugin actief
// Stuurt data naar Eclipse API via beacon API (non-blocking)
// Respecteert DNT header en cookie consent
// Geen cookies — fingerprint via session storage
```

**Plan gating:**
- **Tiny:** Geen analytics
- **Pro:** Basis (sessies, pageviews, referrers, UTM)
- **Pro+:** Volledig (+ scroll depth, clicks, heatmaps, funnels, exit intent)

---

## 2. Plugin Afhankelijkheden

```
tinyeclipse-connector (CORE)
    ├── tinyeclipse-wc (SHOP) — vereist Core + WooCommerce
    └── tinyeclipse-analytics (INTELLIGENCE) — vereist Core
```

**Activatie check in elke plugin:**
```php
// tinyeclipse-wc/tinyeclipse-wc.php
register_activation_hook(__FILE__, function() {
    if (!is_plugin_active('tinyeclipse-connector/tinyeclipse-connector.php')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die('TinyEclipse WC vereist de TinyEclipse Connector plugin.');
    }
    if (!class_exists('WooCommerce')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die('TinyEclipse WC vereist WooCommerce.');
    }
});
```

**Shared helper via core plugin:**
```php
// Core plugin exposeert:
function tinyeclipse_send_event($module, $event, $title, $desc, $data, $url);
function tinyeclipse_get_tenant_id();
function tinyeclipse_verify_request($request);
function tinyeclipse_is_staging();
```

---

## 3. Backend API Wijzigingen

### Nieuwe Models (Alembic migration 010+)

**`AbandonedCart`** — Tracks verlaten winkelwagens
```python
class AbandonedCart(Base):
    __tablename__ = "abandoned_carts"
    id            UUID PK
    tenant_id     UUID FK → tenants
    contact_id    UUID FK → contacts (nullable)
    session_id    String
    visitor_id    String
    cart_contents JSONB       # [{product_id, name, qty, price}]
    cart_total    Float
    recovery_url  String      # Link om cart te herstellen
    status        Enum        # abandoned, recovered, expired
    abandoned_at  DateTime
    recovered_at  DateTime (nullable)
    created_at    DateTime
```

**`CustomerJourney`** — Elke interactie per contact
```python
class CustomerJourney(Base):
    __tablename__ = "customer_journeys"
    id            UUID PK
    tenant_id     UUID FK → tenants
    contact_id    UUID FK → contacts
    touchpoint    Enum        # visit, chat, form, cart, checkout, order, review, return
    channel       String      # web, email, phone, social
    title         String
    description   Text
    data          JSONB
    sentiment     Float       # -1 tot 1
    created_at    DateTime
```

**`CheckoutFailure`** — Waarom een sale niet doorging
```python
class CheckoutFailure(Base):
    __tablename__ = "checkout_failures"
    id            UUID PK
    tenant_id     UUID FK → tenants
    contact_id    UUID FK → contacts (nullable)
    session_id    String
    failure_type  Enum        # payment_declined, technical_error, abandoned, coupon_invalid, stock_issue
    error_message String
    cart_total    Float
    cart_contents JSONB
    page_url      String
    created_at    DateTime
```

**`PromptResolution`** — Tiered prompt feature
```python
class PromptResolution(Base):
    __tablename__ = "prompt_resolutions"
    id            UUID PK
    tenant_id     UUID FK → tenants
    prompt_text   Text        # Originele prompt van klant
    resolution    Text        # Onze oplossing
    status        Enum        # pending, processing, resolved, failed
    resolved_by   String      # ai_auto, human_expert
    confidence    Float
    plan_tier     String      # pro, pro_plus
    created_at    DateTime
    resolved_at   DateTime (nullable)
```

### Contact Model Uitbreiding
```python
# Toevoegen aan Contact model:
retention_score         Float       # 0-1 berekend
last_order_at           DateTime
avg_order_value         Float
preferred_products      JSONB       # [{product_id, name, count}]
acquisition_source      String      # organic, paid, social, referral
lifecycle_stage         Enum        # visitor, lead, customer, repeat, vip, churned
```

### Nieuwe Backend Routers

**`routers/abandoned_carts.py`**
```
POST /api/shop/{tenant_id}/abandoned-carts     ← van WC plugin
GET  /api/admin/abandoned-carts/               ← admin overzicht
GET  /api/admin/abandoned-carts/stats          ← stats
POST /api/admin/abandoned-carts/{id}/recover   ← trigger recovery email
```

**`routers/customer_journey.py`**
```
POST /api/shop/{tenant_id}/journey             ← van WC plugin
GET  /api/admin/contacts/{id}/journey          ← timeline per contact
GET  /api/admin/journey/stats                  ← funnel stats
```

**`routers/checkout_failures.py`**
```
POST /api/shop/{tenant_id}/checkout-failures   ← van WC plugin
GET  /api/admin/checkout-failures/             ← admin overzicht
GET  /api/admin/checkout-failures/stats        ← failure analysis
```

**`routers/prompt_resolution.py`**
```
POST /api/portal/prompts/submit                ← klant submit prompt
GET  /api/portal/prompts/                      ← klant ziet eigen prompts
GET  /api/portal/prompts/remaining             ← hoeveel prompts over deze maand
GET  /api/admin/prompts/                       ← admin queue
POST /api/admin/prompts/{id}/resolve           ← admin/AI lost op
```

### Nieuwe Services

**`services/retention.py`** — Berekent retention score per contact
```python
async def calculate_retention_score(contact: Contact) -> float:
    recency = days_since(contact.last_order_at)
    frequency = contact.total_orders / months_as_customer(contact)
    monetary = contact.avg_order_value
    engagement = contact.total_conversations + contact.total_form_submissions
    loyalty = months_as_customer(contact)
    
    score = (
        normalize(recency, inverse=True) * 0.30 +
        normalize(frequency) * 0.25 +
        normalize(monetary) * 0.20 +
        normalize(engagement) * 0.15 +
        normalize(loyalty) * 0.10
    )
    return round(score, 3)
```

**`services/prompt_resolver.py`** — AI prompt resolution engine
```python
async def resolve_prompt(tenant_id, prompt_text, plan) -> PromptResolution:
    # 1. Check plan limits (PRO: 1/maand, PRO+: onbeperkt)
    # 2. Analyze prompt met LLM
    # 3. Zoek in knowledge base van die tenant
    # 4. Genereer oplossing
    # 5. Als confidence < 0.6 → escalate naar human expert
    # 6. Log + return
```

---

## 4. PWA Notifications voor Shop Admins

### Architectuur
```
WC Plugin → Eclipse API → Push Service → Shop Admin Phone (PWA)
```

### Notification Types
| Event | Prioriteit | Voorbeeld |
|-------|-----------|-----------|
| Nieuwe bestelling | 🔴 Hoog | "Nieuwe bestelling #1234 — €89,50 door Jan" |
| Abandoned cart | 🟡 Medium | "Winkelwagen verlaten — €45,00 door info@..." |
| Checkout failure | 🟡 Medium | "Betaling mislukt — €120,00 (payment_declined)" |
| Formulier ingevuld | 🟢 Laag | "Contactformulier door Marie (marie@...)" |
| Sollicitatie | 🟢 Laag | "Sollicitatie: Chocolatier — door Ahmed" |
| Uptime alert | 🔴 Hoog | "Site DOWN — chocotale.be (502)" |
| SSL expiry | 🟡 Medium | "SSL verloopt over 7 dagen" |

### Backend Push Service
```python
# services/push_notifications.py
# Gebruikt web-push library (VAPID keys)
# Opgeslagen in tenant.settings.push_subscriptions[]
# Plan gating: Tiny=nee, Pro=ja, Pro+=ja+prioriteit
```

### PWA Manifest (al gebouwd)
De PWA is al gebouwd in het admin panel. Uitbreiden met:
- **Service Worker:** Push event listener
- **Notification click:** Deep link naar relevant admin pagina
- **Badge:** Unread notification count

---

## 5. Tiered Prompt Resolution

### Concept
Klanten kunnen prompts insturen die hun site nog niet kon oplossen. Wij (Digital Farmers) lossen ze op met AI + menselijke expertise.

### Plan Tiers
| Feature | Tiny | Pro | Pro+ |
|---------|------|-----|------|
| Prompt Resolution | ❌ | 1 gratis/maand | Onbeperkt |
| AI Auto-resolve | ❌ | ❌ | ✅ |
| Priority queue | ❌ | ❌ | ✅ |
| Response time | — | 48u | 4u |

### Flow
```
1. Klant opent Portal → "Prompt Inzenden"
2. Typt prompt: "Ik wil een loyalty programma op mijn shop"
3. System checkt plan:
   - PRO: remaining_prompts > 0? → submit
   - PRO+: altijd → submit
   - TINY: "Upgrade naar PRO voor deze feature"
4. Backend:
   a. LLM analyseert prompt
   b. Zoekt in tenant knowledge base
   c. Checkt of het een bekende pattern is
   d. Als confidence > 0.7 → auto-resolve (PRO+ only)
   e. Anders → queue voor human expert
5. Klant krijgt notificatie wanneer opgelost
6. Oplossing wordt gelogd in tenant's knowledge base
```

### Portal UI
```
/portal/prompts          → Overzicht eigen prompts
/portal/prompts/new      → Nieuwe prompt insturen
/portal/prompts/{id}     → Detail + oplossing
```

---

## 6. Customer Retention Engine

### Pre-Sale Tracking
Elke bezoeker die iets doet op de shop maar niet koopt wordt getrackt:

```
Bezoeker → Bekijkt product → Voegt toe aan cart → Begint checkout → ???
                                                                    ↓
                                                    Abandoned? Payment failed? 
                                                    Niet genoeg geld? Error?
                                                                    ↓
                                                    Log in CheckoutFailure
                                                    Link aan Contact
                                                    Push naar shop admin
```

### Failure Categories
| Type | Beschrijving | Actie |
|------|-------------|-------|
| `payment_declined` | Bank weigert | Suggest andere betaalmethode |
| `technical_error` | Site/plugin error | Alert naar admin + auto-log |
| `abandoned` | Verlaat checkout | Recovery email na 1u |
| `coupon_invalid` | Kortingscode werkt niet | Suggest alternatief |
| `stock_issue` | Product uitverkocht | Waitlist + notify |
| `shipping_cost` | Verzendkosten te hoog | Suggest gratis verzending drempel |

### Contact Lifecycle
```
visitor → lead → customer → repeat → vip → churned
   ↑                                          ↓
   └──────── win-back campaign ←──────────────┘
```

Elke transitie wordt gelogd in `CustomerJourney` en triggert een PWA notification.

---

## 7. Data Flow — Het Ecosysteem

```
┌─────────────────────────────────────────────────────────┐
│                    WordPress Site                         │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ tinyeclipse  │  │ tinyeclipse  │  │  tinyeclipse   │ │
│  │  connector   │  │     wc       │  │   analytics    │ │
│  │   (core)     │  │   (shop)     │  │ (intelligence) │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘ │
│         │                  │                   │          │
└─────────┼──────────────────┼───────────────────┼──────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│              Eclipse API (FastAPI Backend)                │
│                                                           │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Chat    │ │ Contacts │ │ Shop     │ │ Analytics   │ │
│  │ Engine  │ │ Matcher  │ │ Engine   │ │ Engine      │ │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘ │
│       │           │            │               │         │
│       ▼           ▼            ▼               ▼         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            PostgreSQL + pgvector                     │ │
│  │  tenants | contacts | journeys | carts | analytics  │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                                │
│                          ▼                                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Push Notification Service               │ │
│  │         (Web Push → PWA op admin's telefoon)        │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                                │
└──────────────────────────┼────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  Eclipse   │  │  Portal    │  │   PWA      │
   │  Hub       │  │  (klant)   │  │  (admin    │
   │  (admin)   │  │            │  │   phone)   │
   └────────────┘  └────────────┘  └────────────┘
```

---

## 8. Implementatie Volgorde

### Fase 1: Plugin Split (Week 1)
1. Splits `tinyeclipse-connector.php` in 3 bestanden
2. Maak `tinyeclipse-wc/tinyeclipse-wc.php` met alle WC code
3. Maak `tinyeclipse-analytics/tinyeclipse-analytics.php` (skeleton)
4. Test dependency checks
5. Deploy core + wc naar Chocotale

### Fase 2: Abandoned Cart + Checkout Failures (Week 2)
1. Backend: `AbandonedCart` + `CheckoutFailure` models + migration
2. Backend: routers voor abandoned carts en checkout failures
3. WC Plugin: hooks voor cart tracking + checkout failure logging
4. WC Plugin: WP-Cron job voor abandoned cart detectie
5. Admin panel: abandoned carts pagina

### Fase 3: Customer Journey + Retention (Week 3)
1. Backend: `CustomerJourney` model + migration
2. Backend: retention score service
3. Backend: journey router
4. Contact model uitbreiding (retention_score, lifecycle_stage, etc.)
5. Admin panel: contact journey timeline
6. Admin panel: retention dashboard

### Fase 4: PWA Push Notifications (Week 3-4)
1. Backend: push notification service (web-push + VAPID)
2. Backend: notification preferences per tenant
3. Admin panel: push subscription management
4. PWA: service worker push event handler
5. Koppel aan: orders, abandoned carts, checkout failures, alerts

### Fase 5: Analytics Plugin (Week 4)
1. Frontend JS snippet (~3KB)
2. Backend: analytics ingestion endpoints
3. WC Plugin: conversion tracking hooks
4. Admin panel: analytics dashboard
5. Plan gating implementatie

### Fase 6: Prompt Resolution (Week 5)
1. Backend: `PromptResolution` model + migration
2. Backend: prompt resolver service
3. Backend: prompt router (portal + admin)
4. Portal: prompt submission UI
5. Admin: prompt queue + resolution UI
6. Plan gating (PRO: 1/maand, PRO+: onbeperkt)

---

## 9. Chocotale Deployment Checklist

### Nu al klaar:
- [x] Tenant: `e71307b8-a263-4a0f-bdb5-64060fcd84d1`
- [x] Domain: `chocotale.online`
- [x] Plan: `pro`
- [x] Knowledge base: 16 pagina's
- [x] Modules detected: jobs, shop, forms, blog, booking
- [x] Backend deployed op Dokploy
- [x] Admin panel deployed

### Na plugin split:
- [ ] Upload `tinyeclipse-connector` naar Chocotale WP
- [ ] Upload `tinyeclipse-wc` naar Chocotale WP
- [ ] Activeer beide plugins
- [ ] Verifieer tenant verbinding
- [ ] Test widget op frontend
- [ ] Test order event flow
- [ ] Trigger full sync
- [ ] Verifieer contacts in Hub

---

## 10. Bestandsstructuur Na Split

```
wordpress/
├── tinyeclipse-connector/
│   ├── tinyeclipse-connector.php    # Core plugin (~400 regels)
│   └── uninstall.php
├── tinyeclipse-wc/
│   ├── tinyeclipse-wc.php           # WooCommerce plugin (~600 regels)
│   └── uninstall.php
├── tinyeclipse-analytics/
│   ├── tinyeclipse-analytics.php    # Analytics plugin (~400 regels)
│   ├── assets/
│   │   └── tracker.min.js           # Frontend tracking (~3KB gzip)
│   └── uninstall.php
└── eclipse-widget-loader.php        # Legacy mu-plugin (behouden voor backward compat)
```

---

## 11. Versioning

| Plugin | Huidige | Na split |
|--------|---------|----------|
| tinyeclipse-connector | 4.0.0 (monoliet) | 5.0.0 (core only) |
| tinyeclipse-wc | — | 1.0.0 |
| tinyeclipse-analytics | — | 1.0.0 |

---

## 12. Masterplan Prompt voor Chocotale

De "masterplan prompt" die via de plugin connectors naar Chocotale gaat:

```
Je bent de AI assistent van Chocotale, een Belgische chocolatier.
Je hebt toegang tot:
- Alle producten en prijzen (via WC connector)
- Recente bestellingen en klantdata (via WC connector)
- Formulierinzendingen (via core connector)
- Site content en pagina's (via core connector)
- Bezoekersgedrag en analytics (via analytics connector)

Je taken:
1. Beantwoord klantvragen over producten, levertijden, ingrediënten
2. Help bij het plaatsen van bestellingen
3. Verzamel contactgegevens van geïnteresseerde bezoekers
4. Escaleer complexe vragen naar het Chocotale team
5. Track elke interactie voor customer retention

Je spreekt Nederlands (Belgisch), bent warm en persoonlijk.
Je kent de Chocotale merkwaarden: ambachtelijk, Belgisch, premium.
```

Deze prompt wordt opgeslagen als `system_prompt` in de tenant settings en wordt bij elke chat sessie meegegeven aan de LLM.

---

*Masterplan v5 — TinyEclipse × Digital Farmers*
*"We will conquer the world together"*
