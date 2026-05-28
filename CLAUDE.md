# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Run tests:
```bash
cd backend
pytest
# or a single test
pytest tests/test_api.py::test_capture_flow
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # dev server at localhost:3000, proxies /api/* to localhost:8000
npm run build      # production build (runs icon generation first)
npm run start      # serve production build (PWA enabled)
npm run lint       # ESLint
```

### Docker Compose (all services)
```bash
docker compose up --build
```

## Architecture

### Stack
- **Backend**: FastAPI + SQLAlchemy 2.0 (async-compatible sync sessions) + Pydantic v2
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS (dark theme with `canopy-*` colors) + TypeScript
- **Database**: SQLite by default (`data/canopy.db`); PostgreSQL (pgvector) when using Docker Compose
- **Deployment**: Backend → Fly.io; Frontend → GitHub Pages (static export)

### Backend layout (`backend/app/`)
| File | Role |
|------|------|
| `main.py` | FastAPI app entry point — registers all routers, startup hook, `/api/export` and `/api/data` (delete-all) endpoints |
| `models.py` | SQLAlchemy ORM: `Person`, `Tag`, `Interaction`, `Task`, `Setting`, `User`, `AuthSession` |
| `schemas.py` | Pydantic request/response models mirroring the ORM |
| `services.py` | All business logic — list/create/update/delete for every entity |
| `database.py` | Engine setup, `get_db` dependency, `init_db` (create_all + manual migration) |
| `config.py` | `pydantic-settings` config — reads `DATABASE_URL`, `CORS_ORIGINS`, `AUTH_REQUIRED` from env |
| `constants.py` | `RELATIONSHIP_TYPES`, `DIMENSION_KEYS` (`urgency`, `reversibility`, `visibility`, `effort`, `growth_value`, `operational_cost`) |
| `auth_utils.py` | Password hashing (PBKDF2-SHA256, 260k iterations), session token creation/validation, 30-day expiry |
| `deps/auth.py` | Auth FastAPI dependencies: `optional_user`, `require_user`, `optional_auth_user` |
| `export_crypto.py` | Passphrase-based XOR+PBKDF2-SHA256+HMAC encryption for data export blobs |
| `dimensions_utils.py` | Parse/serialize `Task.dimensions_json` (a JSON string storing 0–1 floats per dimension) |
| `routers/` | `auth`, `interactions`, `people`, `search`, `settings`, `sync`, `tasks` |

**No Alembic migrations.** Schema is managed by `Base.metadata.create_all` at startup with a manual `_migrate_sqlite()` function in `database.py` for additive column changes.

### Frontend layout (`frontend/src/`)
| Path | Role |
|------|------|
| `lib/api.ts` | Central typed API client — all fetch calls go through this, reads `NEXT_PUBLIC_API_URL` for production |
| `app/layout.tsx` | Root layout — mounts `Nav` and `AmbientBackground` |
| `app/page.tsx` | Dashboard (summary stats + recent interactions) |
| `app/capture/` | Quick-capture form |
| `app/timeline/` | Chronological interaction list |
| `app/people/` | Entity list with interaction counts |
| `app/tasks/` | Task list with dimension sliders |
| `app/dimensions/` | Configure saved dimension presets |
| `app/search/` | Full-text search across interactions and people |
| `app/login/` | Auth (register / login) |
| `components/Nav.tsx` | Navigation bar |
| `lib/dimensions.ts` | Dimension label/key helpers (mirrors `constants.py`) |

Pages are all client components that call `api.*` in `useEffect`. No global state library.

### Auth
- `AUTH_REQUIRED=false` by default (local dev). Set `AUTH_REQUIRED=true` in production (already set in `fly.toml`).
- Token stored in `localStorage` as `canopy_auth_token` and sent as `Authorization: Bearer <token>`.
- `optional_auth_user` dependency enforces auth only when `AUTH_REQUIRED=true`; most write endpoints use this.
- **WebAuthn passkey / biometric sign-in**: `POST /api/auth/webauthn/register/begin|complete` (requires Bearer token) and `/login/begin|complete` (public). Credentials in `webauthn_credentials`; challenges in `webauthn_challenges` (2-min TTL). Frontend: `src/lib/usePasskey.ts` hook + `PasskeyBanner`.

### Frontend build modes
- `npm run dev` — local with API proxy (`next.config.ts` rewrites `/api/*` → `localhost:8000`)
- `GITHUB_PAGES=true npm run build` — static export (`out/`), `basePath=/canopy`, PWA disabled, no rewrites
- `npm run build` + `npm run start` — standalone output, PWA service worker enabled

### Tests
Backend tests in `backend/tests/test_api.py` use `TestClient` with an in-memory SQLite database. The `DATABASE_URL` env var is set to `sqlite:///:memory:` at the top of the test file before any imports.

### Config env vars
| Variable | Default | Effect |
|----------|---------|--------|
| `DATABASE_URL` | `sqlite:///./data/canopy.db` | SQLAlchemy connection string |
| `CORS_ORIGINS` | comma-separated list | Allowed origins; split on comma in `config.py` |
| `AUTH_REQUIRED` | `false` | Enforce Bearer token on write endpoints |
| `NEXT_PUBLIC_API_URL` | _(none — uses proxy in dev)_ | Frontend API base URL for GitHub Pages / production |

## Key invariants

**User data isolation.** Every entity (`Person`, `Interaction`, `Task`) has a `user_id` foreign key. All service queries filter by `user_id`. In anonymous mode (`AUTH_REQUIRED=false`, no token), `user_id=None` is used — all anonymous data is shared globally across any unauthenticated request.

**Tags are global.** `Tag` records have no `user_id` and are shared across all users. `get_or_create_tags` uses a global uniqueness check on `Tag.name`.

**Settings are namespaced.** The `Setting` table uses a composite primary key (`key`). When a user is authenticated, keys are stored as `{user_id}:{key}` (e.g., `1:dimensions`). Anonymous keys use the bare key name.

**Two export endpoints.** `GET /api/export` returns a plain JSON dump for the current user. `POST /api/sync/export` (body: `{passphrase}`) returns the same payload encrypted with XOR-stream + PBKDF2 + HMAC. `POST /api/sync/import` merges a decrypted blob, deduplicating people by name, interactions by `(occurred_at, first 50 chars of observation)`, and tasks by title.
