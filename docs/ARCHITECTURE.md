# Architecture

## Implementation status (v0.1)

| Layer | Status |
|-------|--------|
| Next.js UI (capture, timeline, people, search, dimensions, tasks) | Shipped |
| FastAPI + SQLAlchemy (SQLite local / Postgres via `DATABASE_URL`) | Shipped |
| Person `relationship` + editable defaults | Shipped |
| Global dimension defaults (`/api/settings/dimensions`) | Shipped |
| Per-task dimension values (`Task` entity, `/api/tasks`) | Shipped |
| Auth register/login (bearer token, 30-day session) | Shipped |
| Optional auth gate (`AUTH_REQUIRED=true`) | Shipped |
| Encrypted export/import (`/api/sync/*`, XOR+PBKDF2+HMAC) | Shipped |
| Cross-device sync (same backend, same credentials) | Shipped |
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

Stack:
- Python / FastAPI
- SQLAlchemy 2.0 (sync sessions)
- No migrations — schema via `Base.metadata.create_all` at startup; additive column changes applied by `_migrate_sqlite()` in `database.py`

Responsibilities:
- ingestion
- APIs
- scoring
- pattern processing
- retrieval orchestration

---

# Database

## Structured Storage

Default: **SQLite** (`data/canopy.db`) — zero-config for local and single-user hosted use.

Production: **PostgreSQL** — set `DATABASE_URL` env var to any Postgres connection string (Neon, Render, self-hosted). Docker Compose brings up pgvector-enabled Postgres for local production-shaped dev.

Stores:
- entities (Person, Tag)
- interactions
- tasks
- settings
- users / auth sessions

## Semantic Layer (v0.2 — planned)

pgvector column on `interaction_embeddings` table, local embedding model hook, semantic `/api/search` mode. SQLite builds will stub vector storage; Postgres + pgvector in Compose for production-shaped dev.

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

## Authentication

- Register/login issues a 30-day bearer token stored client-side in `localStorage`.
- **WebAuthn passkey / biometric sign-in**: `POST /api/auth/webauthn/register/begin|complete` (requires Bearer token) and `/login/begin|complete` (public). Credentials stored in `webauthn_credentials` table (public key + sign_count); challenges in `webauthn_challenges` (2-min TTL, single-use). `PasskeyBanner` post-login prompt; `usePasskey` hook in frontend.
- `optional_auth_user` dependency validates `Authorization: Bearer …` when present; most write endpoints use this.
- `AUTH_REQUIRED=false` by default (local dev). Set `AUTH_REQUIRED=true` in production — already set in `render.yaml`.
- Cross-device sync works by logging in with the same credentials on any device pointing at the same backend.

## Encrypted export format

`POST /api/sync/export` accepts a user passphrase (never stored server-side). Returns a blob encrypted with XOR stream cipher + PBKDF2-SHA256 key derivation + HMAC (Python stdlib only, no server key storage):

- `format`: `canopy-encrypted-export`
- `salt`, `nonce`, `iterations`, `ciphertext`, `mac`

`POST /api/sync/import` decrypts the blob and merges it into the current user's data, deduplicating people by name, interactions by `(occurred_at, first 50 chars of observation)`, and tasks by title.