# TinyEclipse — Architecture

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Backend API** | Python 3.12 + FastAPI | Fast, async, typed, great for AI workloads |
| **Database** | PostgreSQL 16 + pgvector | Battle-tested, vector search built-in, tenant isolation via row-level |
| **Embeddings** | `all-MiniLM-L6-v2` (local) | Free, 384 dimensions, runs on CPU, no API key |
| **LLM** | Groq `llama-3.3-70b-versatile` | Free tier, extremely fast inference, OpenAI-compatible API |
| **Admin Panel** | Next.js 14 + Tailwind CSS + shadcn/ui | Modern, fast, dark-mode ready |
| **Chat Widget** | Vanilla JS + CSS | Zero dependencies, embeddable via `<script>` tag |
| **Infra** | Docker Compose | Hetzner-ready, single `docker compose up` |
| **Reverse Proxy** | Caddy | Auto HTTPS, simple config |

---

## Project Structure

```
tinyEclipse/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── main.py          # FastAPI app entry
│   │   ├── config.py        # Settings from env
│   │   ├── database.py      # DB connection + session
│   │   ├── models/          # SQLAlchemy models
│   │   │   ├── tenant.py
│   │   │   ├── conversation.py
│   │   │   ├── message.py
│   │   │   ├── source.py
│   │   │   ├── consent.py
│   │   │   └── usage_log.py
│   │   ├── routers/         # API endpoints
│   │   │   ├── chat.py      # /chat — core loop
│   │   │   ├── tenants.py   # tenant CRUD
│   │   │   ├── sources.py   # source ingestion
│   │   │   ├── admin.py     # admin endpoints
│   │   │   └── consent.py   # consent management
│   │   ├── services/        # Business logic
│   │   │   ├── rag.py       # RAG pipeline
│   │   │   ├── embeddings.py# Embedding generation
│   │   │   ├── llm.py       # LLM interaction
│   │   │   ├── confidence.py# Confidence scoring
│   │   │   └── escalation.py# Escalation logic
│   │   └── middleware/       # Rate limiting, auth, logging
│   │       ├── rate_limit.py
│   │       ├── auth.py
│   │       └── logging.py
│   ├── alembic/             # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── admin/                   # Next.js admin panel
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── widget/                  # Embeddable chat widget
│   ├── src/
│   │   ├── widget.js
│   │   └── widget.css
│   └── Dockerfile
├── docker-compose.yml
├── Caddyfile
├── .env.example
└── docs/
```

---

## Data Flow — Core Loop

```
User Message
    │
    ▼
[1] INPUT — /api/chat (validate tenant_id, check consent, rate limit)
    │
    ▼
[2] RETRIEVAL — Vector search in tenant-scoped embeddings (pgvector)
    │
    ▼
[3] RESPONSE — LLM generates answer using retrieved context + system prompt
    │
    ▼
[4] CONFIDENCE — Score response (0.0–1.0), check threshold
    │
    ▼
[5] LOG — Store message, response, sources, confidence, metadata
    │
    ▼
[6] ESCALATE — If confidence < threshold → flag for human review
    │
    ▼
Return Response to User
```

---

## Database Schema

### tenants
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| whmcs_client_id | INTEGER | Unique, root identity |
| name | VARCHAR(255) | Company name |
| plan | ENUM(tiny,pro,pro_plus) | Plan level |
| status | ENUM(active,suspended) | |
| domain | VARCHAR(255) | Primary domain |
| settings | JSONB | Custom config |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### sources
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| type | ENUM(url,pdf,faq,text) | Source type |
| url | TEXT | Source URL |
| title | VARCHAR(255) | |
| content | TEXT | Raw content |
| status | ENUM(pending,indexed,failed) | |
| last_indexed_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### embeddings
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| source_id | UUID | FK → sources |
| chunk_text | TEXT | Text chunk |
| embedding | VECTOR(384) | pgvector (all-MiniLM-L6-v2) |
| metadata | JSONB | |
| created_at | TIMESTAMP | |

### conversations
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| session_id | VARCHAR(255) | Browser session |
| channel | VARCHAR(50) | widget, api, admin |
| status | ENUM(active,closed,escalated) | |
| created_at | TIMESTAMP | |

### messages
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| conversation_id | UUID | FK → conversations |
| tenant_id | UUID | FK → tenants (denormalized for isolation) |
| role | ENUM(user,assistant,system) | |
| content | TEXT | |
| confidence | FLOAT | 0.0–1.0 |
| sources_used | JSONB | Array of source IDs |
| escalated | BOOLEAN | |
| created_at | TIMESTAMP | |

### consents
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| session_id | VARCHAR(255) | |
| accepted | BOOLEAN | |
| ip_address | VARCHAR(45) | |
| user_agent | TEXT | |
| terms_version | VARCHAR(20) | |
| created_at | TIMESTAMP | |

### usage_logs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| tokens_in | INTEGER | |
| tokens_out | INTEGER | |
| model | VARCHAR(50) | |
| endpoint | VARCHAR(100) | |
| created_at | TIMESTAMP | |

---

## Tenant Isolation Strategy

- Every table includes `tenant_id`
- Every query filters by `tenant_id`
- Embeddings are scoped: vector search always includes `WHERE tenant_id = ?`
- System prompts are selected by tenant plan level
- Rate limits are per-tenant
- No shared state between tenants

---

## API Endpoints (Day Zero)

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Core chat endpoint |
| POST | `/api/consent` | Record consent |
| GET | `/api/consent/check` | Check consent status |

### Admin (authenticated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/tenants` | List tenants |
| POST | `/api/admin/tenants` | Create tenant |
| GET | `/api/admin/tenants/:id` | Tenant detail |
| PATCH | `/api/admin/tenants/:id` | Update tenant |
| GET | `/api/admin/conversations` | List conversations |
| GET | `/api/admin/conversations/:id` | Conversation detail |
| POST | `/api/admin/sources` | Add source |
| POST | `/api/admin/sources/:id/ingest` | Trigger ingestion |
| GET | `/api/admin/usage` | Usage overview |

---

## Confidence Scoring

```
confidence = weighted_average(
    retrieval_similarity  × 0.4,   # How relevant were the retrieved chunks
    source_coverage       × 0.3,   # How many sources supported the answer
    answer_coherence      × 0.3    # LLM self-assessment
)

if confidence < 0.6 → escalate
if confidence < 0.3 → refuse to answer, redirect to human
```

---

## Widget Embed Code

```html
<script
  src="https://api.tinyeclipse.nl/widget/v1/widget.js"
  data-tenant="TENANT_UUID"
  data-position="bottom-right"
  async>
</script>
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/tinyeclipse

# Groq (free tier)
GROQ_API_KEY=gsk_...
GROQ_CHAT_MODEL=llama-3.3-70b-versatile

# Embeddings (local, no key needed)
EMBEDDING_MODEL=all-MiniLM-L6-v2

# App
APP_SECRET_KEY=...
ADMIN_API_KEY=...
CORS_ORIGINS=https://admin.tinyeclipse.nl

# Rate Limits
RATE_LIMIT_PER_MINUTE=20
RATE_LIMIT_PER_DAY=500

# Confidence
CONFIDENCE_ESCALATE_THRESHOLD=0.6
CONFIDENCE_REFUSE_THRESHOLD=0.3
```
