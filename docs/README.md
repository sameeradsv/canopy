# Canopy Docs

This directory is intentionally small. Current operational detail lives here; durable product decisions live in the root [DECISIONS.md](../DECISIONS.md).

## Current Product

Canopy is a personal contextual memory app for preserving meaningful observations about people, interactions, and recurring patterns. It is not a CRM, therapy product, task manager, or productivity game.

Shipped surfaces:

- Dashboard with summary stats, recent interactions, stale contacts, and weekly synthesis.
- Quick capture with people, tags, confidence, energy, duration, voice input, and AI suggestions.
- Timeline with edit/delete actions and shared `InteractionCard` rows.
- People list and relationship metadata.
- Search across people, interactions, and tags.
- Dimensions presets retained for possible future interaction scoring. Tasks belong in Circuit.
- Energy page combining Canopy interactions with Circuit and Chef timelines when configured.
- Patterns page with deterministic signals and on-demand Groq synthesis.
- Native Canopy chat at `/chat`, backed by Groq via `POST /api/ai/agent/chat`.
- Settings for appearance, AI classification, passkeys, encrypted/plain export, restore, and PWA notifications.

## Architecture

Backend:

- FastAPI, SQLAlchemy 2.0 sync sessions, Pydantic v2.
- SQLite by default at `data/canopy.db`.
- PostgreSQL via `DATABASE_URL` for hosted deployments.
- Schema setup is `Base.metadata.create_all` plus additive helpers in `backend/app/database.py`; there is no Alembic setup.
- `INIT_DB_ON_STARTUP=true` is convenient locally. Hosted/serverless deployments should initialize the database once, then set it to `false` to reduce cold-start work.

Frontend:

- Next.js 15 App Router, TypeScript, Tailwind/CSS variables.
- Client pages call the typed API client in `frontend/src/lib/api.ts`.
- Development uses relative `/api/*` requests and the Next rewrite proxy.
- GitHub Pages static export uses `NEXT_PUBLIC_API_URL` and `basePath=/canopy`.

Data model:

- `User`, `AuthSession`, WebAuthn tables.
- `Person`, `Interaction`, `PersonScore`.
- `Tag` is global and shared across users.
- `Setting` stores anonymous keys directly and authenticated keys as `{user_id}:{key}`.
- `PushSubscription` stores one enabled/disabled row per user device endpoint.

## Auth And Data Isolation

- `AUTH_REQUIRED=false` by default for local development.
- Production should set `AUTH_REQUIRED=true`.
- Password auth issues a 30-day bearer token stored as `canopy_auth_token`.
- WebAuthn passkey routes are available under `/api/auth/webauthn/*` and import native passkey dependencies lazily.
- People and interactions are always filtered by `user_id`.
- Interaction writes reject participant IDs owned by another user.
- Anonymous mode uses `user_id=None`; anonymous data is shared by all unauthenticated requests.
- Dynamic user-data GET responses use `Cache-Control: no-store`.

## Backup And Reset

- `GET /api/export` returns plain JSON for the authenticated user.
- `POST /api/sync/export` returns encrypted backup JSON. The current format uses AES-GCM with PBKDF2-derived key material; the passphrase is never stored server-side.
- `POST /api/sync/import` merges a decrypted backup and deduplicates people by name and interactions by `(occurred_at, first 50 chars of observation)`.
- `DELETE /api/data` clears only the current user's people, interactions, namespaced settings, and now-unused tags. It keeps the account and active session.

## AI

- `GROQ_API_KEY` enables classification, capture suggestions, synthesis, and chat.
- `/api/ai/patterns` is deterministic and does not require Groq.
- `/api/ai/synthesize` and `/api/ai/agent/chat` use Groq with fallback models in `services/canopy_agent.py`.
- Embeddings and pgvector semantic search remain deferred because Groq does not provide an embedding API here.

## Cross-App Energy

- `GET /api/sync/energy/timeline` returns signed interaction energy deltas for a day.
- `GET /api/sync/energy` returns the current Canopy energy state.
- Canopy starts local energy at `0.70` because it has no sleep data.
- The frontend energy page may override the combined line's opening balance with Circuit's `start_energy`.
- Circuit and Chef are fetched client-side using `NEXT_PUBLIC_CIRCUIT_API_URL` and `NEXT_PUBLIC_CHEF_API_URL`, passing Canopy's `canopy_auth_token` when signed in with Cortex.

## Notifications

Reflection reminders are documented in [notifications.md](notifications.md). The important operational point: cron success only means the HTTP job completed. Check the response JSON for delivered counts, and after this update the endpoint returns HTTP 502 when it attempted push delivery and every attempted delivery failed.

## Deployment Checklist

Backend environment:

- `DATABASE_URL`
- `AUTH_REQUIRED=true`
- `CORS_ORIGINS=https://sameeradsv.github.io`
- `INIT_DB_ON_STARTUP=false` after schema initialization
- `GROQ_API_KEY` if AI features are enabled
- `CORTEX_AUTH_URL` if shared Cortex auth is used
- `WEBAUTHN_RP_ID=sameeradsv.github.io`
- `WEBAUTHN_ORIGIN=https://sameeradsv.github.io`
- `WEBAUTHN_RP_NAME=canopy`
- Notification variables from [notifications.md](notifications.md), if reminders are enabled.

Schema initialization:

```powershell
cd backend
$env:DATABASE_URL="postgresql://..."
python -m app.database
```

Do not add localhost or `127.0.0.1` to committed CORS defaults. Local development origins belong in local environment files only.

## Deferred

- pgvector / embeddings.
- Ollama or local LLM mode.
- Tauri desktop shell.
- Encrypted automatic sync.
- Memory compression.
- Richer synthesis cadence UX.

## Product Principles

- Retrieval quality over storage quantity.
- Sparse, high-signal capture over exhaustive logging.
- Preserve uncertainty; avoid fixed identity judgments.
- Keep AI assistive and interpretable.
- Keep reminders quiet and opt-in.
- Keep tasks in Circuit, not Canopy.
