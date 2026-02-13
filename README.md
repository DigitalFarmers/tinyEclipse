# TinyEclipse

**AI Operating Layer** — tenant-isolated, confidence-scored, human-first.

Built by Digital Farmers.

---

## Quick Start (Development)

### Prerequisites
- Docker & Docker Compose
- Groq API key (free — get one at https://console.groq.com)

### 1. Configure environment
```bash
cp .env.example .env
# Edit .env and set your GROQ_API_KEY (free)
```

### 2. Start everything
```bash
docker compose up -d
```

This starts:
- **PostgreSQL + pgvector** on port 5432
- **Backend API** on port 8000
- **Admin Panel** on port 3000
- **Caddy** reverse proxy on port 80

### 3. Run database migrations
```bash
docker compose exec backend alembic upgrade head
```

### 4. Create your first tenant
```bash
curl -X POST http://localhost:8000/api/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY" \
  -d '{
    "whmcs_client_id": 1,
    "name": "Test Company",
    "plan": "pro",
    "domain": "example.com"
  }'
```

### 5. Scrape & index a website
```bash
curl -X POST "http://localhost:8000/api/admin/sources/scrape-site?tenant_id=TENANT_UUID&url=https://example.com" \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY"
```

### 6. Embed the widget
```html
<script
  src="http://localhost:8000/widget/v1/widget.js"
  data-tenant="TENANT_UUID"
  data-api="http://localhost:8000"
  async>
</script>
```

---

## Local Development (without Docker)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Admin Panel
```bash
cd admin
npm install
npm run dev
```

---

## Production Deployment (Hetzner)

### 1. Server setup
```bash
ssh root@your-server
apt update && apt install -y docker.io docker-compose-plugin
```

### 2. Clone & configure
```bash
git clone <repo-url> /opt/tinyeclipse
cd /opt/tinyeclipse
cp .env.example .env
nano .env  # Set production values
```

### 3. Update Caddyfile
Uncomment the production section in `Caddyfile` with your domains:
```
api.tinyeclipse.nl {
    reverse_proxy backend:8000
}

admin.tinyeclipse.nl {
    reverse_proxy admin:3000
}
```

### 4. Deploy
```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

### 5. DNS
Point your domains to the server IP:
- `api.tinyeclipse.nl` → server IP
- `admin.tinyeclipse.nl` → server IP

Caddy handles HTTPS automatically.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

**Core Loop:**
```
INPUT → RETRIEVAL → RESPONSE → CONFIDENCE → LOG → ESCALATE
```

**Stack:** Python/FastAPI + PostgreSQL/pgvector + Next.js + Vanilla JS widget

---

## Widget Embed Code (for client websites)

```html
<script
  src="https://api.tinyeclipse.nl/widget/v1/widget.js"
  data-tenant="TENANT_UUID"
  async>
</script>
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | - | Chat (core loop) |
| POST | `/api/consent/` | - | Record consent |
| GET | `/api/consent/check` | - | Check consent |
| GET | `/api/admin/overview` | Admin | Dashboard data |
| GET/POST | `/api/admin/tenants` | Admin | Tenant management |
| GET | `/api/admin/conversations` | Admin | Conversation list |
| POST | `/api/admin/sources` | Admin | Add source |
| POST | `/api/admin/sources/:id/ingest` | Admin | Trigger indexing |
| POST | `/api/admin/sources/scrape-site` | Admin | Scrape full site |
| GET | `/api/admin/usage` | Admin | Usage stats |

Admin endpoints require `X-Admin-Key` header.

---

## License

Proprietary — Digital Farmers B.V.
