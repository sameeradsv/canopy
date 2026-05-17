# Architecture

## Implementation status (v0.1)

| Layer | Status |
|-------|--------|
| Next.js UI (capture, timeline, people, search, dimensions, tasks) | Shipped |
| FastAPI + SQLAlchemy (SQLite local / Postgres in Compose) | Shipped |
| Person `relationship` + editable defaults | Shipped |
| Global dimension defaults (`/api/settings/dimensions`) | Shipped |
| Per-task dimension values (`Task` entity, `/api/tasks`) | Shipped |
| Auth register/login (session token; sync not yet) | Scaffold |
| Optional auth gate (`AUTH_REQUIRED=true`) | Shipped |
| Encrypted export/import preview (`/api/sync/*`) | Scaffold |
| pgvector / embeddings / local LLM | Planned (v0.2) |

---

# High-Level Architecture

```text
UI Layer
   ↓
API Layer
   ↓
Structured Storage + Semantic Memory
   ↓
Pattern Detection / Processing
   ↓
Insights + Retrieval
```

---

# Frontend

Recommended:
- Next.js
- React
- TailwindCSS
- Tauri (optional desktop shell)

Responsibilities:
- quick capture
- dashboards
- contextual retrieval
- timelines
- lightweight visualization

---

# Backend

Recommended:
- Python
- FastAPI
- SQLAlchemy
- Alembic

Responsibilities:
- ingestion
- APIs
- scoring
- pattern processing
- retrieval orchestration

---

# Database

## Structured Storage
- PostgreSQL

Stores:
- entities
- interactions
- tasks
- contexts
- observations
- metadata

## Semantic Layer
- pgvector

Supports:
- semantic recall
- contextual similarity
- historical retrieval

---

# AI Layer

Initial:
- embeddings
- summarization
- tagging assistance

Later:
- local LLM inference
- contextual synthesis
- adaptive retrieval

---

# Security

Required:
- encrypted local database
- optional encrypted backup
- export/delete capability
- local-first processing

## Authentication (optional)

- Register/login issues a bearer token stored client-side (`localStorage`).
- `optional_user` / `optional_auth_user` dependencies validate `Authorization: Bearer …` when present.
- Set `AUTH_REQUIRED=true` in the backend environment to require a valid session for destructive routes (e.g. `DELETE /api/data`) and encrypted sync endpoints. When unset (default), the API remains open for local single-user use.
- Full cross-device sync is not implemented; auth prepares identity for a future sync layer.

## Encrypted export format

`POST /api/sync/export` accepts a user passphrase (never stored server-side). Response blob:

- `format`: `canopy-encrypted-export`
- `salt`, `nonce`, `iterations`, `ciphertext`, `mac` (PBKDF2-SHA256 key + stream cipher + HMAC; stdlib-only, no server key storage)

`POST /api/sync/import` decrypts and returns entity counts as a preview only; merge/conflict resolution is future work.

## Semantic layer (v0.2 — next)

Per `docs/ROADMAP.md` v0.2: add `interaction_embeddings` table with pgvector column, local embedding model hook, and `/api/search` semantic mode. SQLite dev builds can stub vector storage; Postgres + pgvector in Compose for production-shaped dev.