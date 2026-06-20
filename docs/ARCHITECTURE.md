# Architecture

## Implementation status (v0.1)

| Layer | Status |
|-------|--------|
| Next.js UI (capture, timeline, people, search, dimensions, energy, chat) | Shipped |
| FastAPI + SQLAlchemy (SQLite local / Postgres via `DATABASE_URL`) | Shipped |
| Person `relationship` + editable defaults | Shipped |
| Global dimension defaults (`/api/settings/dimensions`) | Shipped |
| Dimension presets UI (`/dimensions`) — for future interaction scoring, not tasks | Shipped |
| Auth register/login (bearer token, 30-day session) | Shipped |
| Optional auth gate (`AUTH_REQUIRED=true`) | Shipped |
| Encrypted export/import (`/api/sync/*`) | Shipped |
| Plain JSON export (`GET /api/export`) | Shipped — Settings UI + `api.exportData()` |
| `InteractionCard` shared timeline row | Shipped — dashboard, timeline |
| `lib/dimensions.ts` shared constants | Shipped — `/dimensions` page |
| Cross-device sync (same backend, same credentials) | Shipped |
| pgvector / embeddings / local LLM | Planned (v0.2) |

**Tasks:** Intentionally **not** in Canopy — task management belongs in Circuit. See `DECISIONS.md`.

**Removed during 2026 cleanup (superseded):** `Nav.tsx`, `AmbientBackground.tsx` → `ShellLayout.tsx`.

**Restored (2026-06):** `TagInput` on capture/timeline.

**Terminal UX:** Conduit-only — sibling apps use `/chat` (native Groq agent), not terminal timeline views.

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
- Lightweight migrations via `Base.metadata.create_all` plus additive helpers in `database.py`. Local/Render startup runs this by default; Vercel should set `INIT_DB_ON_STARTUP=false` after the database is initialized to reduce cold-start work.

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

Production: **PostgreSQL** — set `DATABASE_URL` env var to any Postgres connection string (Neon, Render, self-hosted). Vercel deployments use Neon/PostgreSQL and must not rely on SQLite persistence. Docker Compose brings up pgvector-enabled Postgres for local production-shaped dev.

Stores:
- entities (Person, Tag)
- interactions
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
- **WebAuthn passkey / biometric sign-in**: `POST /api/auth/webauthn/register/begin|complete` (requires Bearer token) and `/login/begin|complete` (public). Credentials stored in `webauthn_credentials` table (public key + sign_count); challenges in `webauthn_challenges` (2-min TTL, single-use). `PasskeyBanner` post-login prompt; `usePasskey` hook in frontend. WebAuthn's native dependency stack is imported lazily inside these route handlers so ordinary API startup and non-passkey routes do not depend on local passkey runtime health.
- `optional_auth_user` dependency validates `Authorization: Bearer …` when present; most write endpoints use this.
- `AUTH_REQUIRED=false` by default (local dev). Set `AUTH_REQUIRED=true` in production.
- Cross-device sync works by logging in with the same credentials on any device pointing at the same backend.

## Data isolation and caching

- People and interactions are always filtered by `user_id`; interaction create/update also validates that every `participant_id` belongs to the current user before linking.
- Dynamic authenticated GET responses use `Cache-Control: no-store` to prevent stale browser views after writes. Stable metadata such as `/api/relationship-defaults` may be cached.
- `DELETE /api/data` is a user-scoped reset: it deletes only the current user's interactions, people, namespaced settings, and any tags left unused afterwards. It intentionally keeps the user account and current session.

## Encrypted export format

`POST /api/sync/export` accepts a user passphrase (never stored server-side). Returns a blob encrypted with XOR stream cipher + PBKDF2-SHA256 key derivation + HMAC (Python stdlib only, no server key storage):

- `format`: `canopy-encrypted-export`
- `salt`, `nonce`, `iterations`, `ciphertext`, `mac`

`POST /api/sync/import` decrypts the blob and merges it into the current user's data, deduplicating people by name and interactions by `(occurred_at, first 50 chars of observation)`.
