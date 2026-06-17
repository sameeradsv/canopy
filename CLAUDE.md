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
- **Deployment**: Backend → Render; Frontend → GitHub Pages (static export); Database → Neon (PostgreSQL)

### Backend layout (`backend/app/`)
| File | Role |
|------|------|
| `main.py` | FastAPI app entry point — registers all routers, startup hook, `/api/export` and `/api/data` (delete-all) endpoints |
| `models.py` | SQLAlchemy ORM: `Person`, `Tag`, `Interaction`, `Setting`, `User`, `AuthSession`, `PersonScore`, WebAuthn tables |
| `schemas.py` | Pydantic request/response models mirroring the ORM |
| `services/` | Python package (`__init__.py` holds all CRUD/business logic; submodules: `patterns.py` deterministic signals, `synthesis.py` Groq summarisation, `capture_suggestions.py`). |
| `database.py` | Engine setup, `get_db` dependency, `init_db` (create_all + manual migration) |
| `config.py` | `pydantic-settings` config — reads `DATABASE_URL`, `CORS_ORIGINS`, `AUTH_REQUIRED` from env |
| `constants.py` | `RELATIONSHIP_TYPES`, `DIMENSION_KEYS` (`urgency`, `reversibility`, `visibility`, `effort`, `growth_value`, `operational_cost`) |
| `auth_utils.py` | Password hashing (PBKDF2-SHA256, 100k iterations), session token creation/validation, 30-day expiry |
| `deps/auth.py` | Auth FastAPI dependencies: `optional_user`, `require_user`, `optional_auth_user` |
| `export_crypto.py` | Passphrase-based XOR+PBKDF2-SHA256+HMAC encryption for data export blobs |
| `routers/` | `auth`, `interactions`, `people`, `search`, `settings`, `sync`, `scores`, `ai`, `webauthn` |

**Product scope:** Tasks live in **Circuit**, not Canopy. See `DECISIONS.md` (2026-05-27). Dimension presets on `/dimensions` are retained for possible future interaction scoring — not task management.

**No Alembic migrations.** Schema is managed by `Base.metadata.create_all` at startup with a manual `_migrate_sqlite()` function in `database.py` for additive column changes.

### Energy system (`routers/sync.py`)

Canopy contributes to the cross-app cumulative energy model via two endpoints:

**`GET /api/sync/energy/timeline`** — cumulative interaction-energy timeline for a day.
- Each event has `delta` (signed, positive = restores), `running_energy` (balance after event), `start_energy` (0.70 baseline — Canopy doesn't have sleep data), `end_energy`.
- Delta rules: interactions tagged with `_RESTORE_TAGS` (support, joy, celebration, win, gratitude, fun, energizing) give a genuine positive delta (up to +0.15) — they restore, not just drain-less. `_DRAIN_TAGS` (conflict, stress, argument, difficult) give larger negatives (down to −0.25). AI energy score > 0.5 maps to positive delta; < 0.5 to negative.
- `energy` compat field (0–1) is preserved for backward compat with dot colour in the chart.

**`GET /api/sync/energy`** — real-time interaction energy state (used by Circuit's `use-combined-energy.ts`).
- `energy_so_far`: 0.70 + cumulative deltas from past interactions today (clamped 0–1). Replaces the old `1.0 − drain` formula so restorative interactions actually raise it above 0.70.
- Legacy `drain_so_far` / `drain_ahead` retained for backward compat.

**Cross-app note**: Canopy's `start_energy` for the combined timeline line is always 0.70 locally. The frontend (Canopy energy page) overrides this with Circuit's `start_energy` (sleep factor + `energy_eod` carry-over) for the combined dashed running-balance line.

**Cross-app auth (Energy page)**: Circuit and Chef timelines are fetched client-side from their backends using `NEXT_PUBLIC_CIRCUIT_API_URL` / `NEXT_PUBLIC_CHEF_API_URL`. The request carries Canopy's `canopy_auth_token` (the Cortex JWT when signed in with Cortex) — **not** `circuit_auth_token` / `chef_auth_token`, which live on those apps' origins and are not readable from Canopy's `localStorage`. Circuit and Chef backends accept the shared Cortex token via `CORTEX_AUTH_URL` validation.

### Frontend layout (`frontend/src/`)
| Path | Role |
|------|------|
| `lib/api.ts` | Central typed API client — `NEXT_PUBLIC_API_URL` in production; relative `/api/*` in dev when env unset (Next proxy). Network errors trigger `waitForBackend()` which polls `/api/health` up to 28 s before each retry (handles Render free-tier cold starts). |
| `app/layout.tsx` | Root layout — `AuthProvider`, `ThemeInit`, `ShellLayout` (sidebar + topbar) |
| `app/page.tsx` | Dashboard (summary stats + recent interactions) |
| `app/capture/` | Quick-capture form |
| `app/timeline/` | Chronological interaction list |
| `app/people/` | Entity list with interaction counts |
| `app/dimensions/` | Saved dimension presets (not task management — see `DECISIONS.md`) |
| `app/search/` | Full-text search across interactions and people |
| `app/energy/page.tsx` | Cross-app energy timeline. Fetches Circuit (`/api/energy/timeline`) and Chef (`/energy/timeline`) with the user's `canopy_auth_token` (Cortex JWT). Combined dashed line = `startEnergy + Σdeltas` (true running balance from Circuit's `start_energy`). Per-source dots show event intrinsic quality. Summary card shows `open → close` balance. Event list shows `+x%` delta and `→ y%` running balance per row. Requires Cortex sign-in on Canopy for sibling data; local-only Canopy accounts show Canopy events only. |
| `app/patterns/` | Reflection page — deterministic signals (`GET /api/ai/patterns`) + on-demand Groq synthesis (`GET /api/ai/synthesize`). |
| `app/chat/` | App-native Groq chat — people & interactions Q&A (`POST /api/ai/agent/chat`). Terminal/diary hub → Conduit only. |
| `app/login/` | Auth (register / login) |
| `components/ShellLayout.tsx` | App chrome — sidebar nav, topbar, mobile drawer |
| `components/InteractionCard.tsx` | Shared timeline row (feed, dashboard, edit/actions via props) |
| `components/TerminalChat.tsx` | Chat UI — streams from native Canopy agent (requires `GROQ_API_KEY`) |
| `lib/dimensions.ts` | `DIMENSION_KEYS`, labels, descriptions (shared with `/dimensions`) |

Pages are all client components that call `api.*` in `useEffect`. No global state library.

### Auth
- `AUTH_REQUIRED=false` by default (local dev). Set `AUTH_REQUIRED=true` in production (already set in `render.yaml`).
- Token stored in `localStorage` as `canopy_auth_token` and sent as `Authorization: Bearer <token>`.
- `optional_auth_user` dependency enforces auth only when `AUTH_REQUIRED=true`; most write endpoints use this.
- **WebAuthn passkey / biometric sign-in**: `POST /api/auth/webauthn/register/begin|complete` (requires Bearer token) and `/login/begin|complete` (public). Credentials in `webauthn_credentials`; challenges in `webauthn_challenges` (2-min TTL). Frontend: `src/lib/usePasskey.ts` hook + `PasskeyBanner`.

### Frontend build modes
- `npm run dev` — local with API proxy when `NEXT_PUBLIC_API_URL` is set in `.env.local` (`next.config.ts` rewrites `/api/*`)
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
| `GROQ_API_KEY` | _(empty)_ | AI classification, energy scoring, and `/api/ai/agent/chat` |
| `NEXT_PUBLIC_API_URL` | _(none — uses proxy in dev)_ | Frontend API base URL for GitHub Pages / production |

## Key invariants

**User data isolation.** Every entity (`Person`, `Interaction`) has a `user_id` foreign key. All service queries filter by `user_id`. In anonymous mode (`AUTH_REQUIRED=false`, no token), `user_id=None` is used — all anonymous data is shared globally across any unauthenticated request.

**Tags are global.** `Tag` records have no `user_id` and are shared across all users. `get_or_create_tags` uses a global uniqueness check on `Tag.name`.

**Settings are namespaced.** The `Setting` table uses a composite primary key (`key`). When a user is authenticated, keys are stored as `{user_id}:{key}` (e.g., `1:dimensions`). Anonymous keys use the bare key name.

**Export endpoints.** `GET /api/export` — plain JSON (`api.exportData()`, Settings → Download JSON). `POST /api/sync/export` — passphrase-encrypted backup (Settings). `POST /api/sync/import` merges decrypted blob; dedupes people by name, interactions by `(occurred_at, first 50 chars of observation)`.

**`slowapi` + FastAPI body injection incompatibility**: `@limiter.limit` wraps the route function, hiding Pydantic model type annotations from FastAPI's dependency injector — FastAPI treats the parameter as a query param and returns 422 "Field required". Using `= Body()` as default is worse: FastAPI injects the raw `FieldInfo` object, causing `AttributeError` that escapes past `CORSMiddleware` to `ServerErrorMiddleware` (outside CORS) → 500 with no CORS headers → "Failed to fetch" in browser. **Fix**: all rate-limited endpoints that take a JSON body must use `async def` + `await request.json()` + `Model.model_validate()` via the `_parse_body` helper in `routers/auth.py`. Never add a typed Pydantic parameter to a `@limiter.limit`-decorated route.

**Unhandled backend exceptions appear as frontend "Network error" (CORS bypass)**: Starlette's middleware stack is `ServerErrorMiddleware → [user middleware] → ExceptionMiddleware → Router`. `CORSMiddleware` sits inside `ServerErrorMiddleware`, so any unhandled Python exception that escapes the handler propagates past `CORSMiddleware` before `ServerErrorMiddleware` catches it and returns a 500 — that 500 has no CORS headers, and the browser reports it as a network error rather than an HTTP error. `HTTPException` is safe (caught by `ExceptionMiddleware` inside CORS). Unhandled exceptions are not. If a browser fetch is failing with "Network error" and the backend is reachable, check the Render/uvicorn logs for a Python traceback on that endpoint.

**Never let `app/foo.py` coexist with `app/foo/` as a namespace package**: Python's `FileFinder` gives regular modules (`.py` files) priority over namespace packages (directories without `__init__.py`) in the same parent. If both exist, `from app.foo.bar import …` silently resolves `app.foo` to `foo.py` and then fails to find `bar` as a submodule — raising an unhandled `ModuleNotFoundError` that triggers the CORS bypass above. If a directory needs submodules, give it an `__init__.py`; if a `.py` file and a same-named directory must coexist, one of them needs to be renamed.

## UI & Responsive Standards

All UI changes must work correctly across **every** combination of these views before being considered done:

| View | Width | Notes |
|------|-------|-------|
| Mobile portrait | ≤ 430 px | Primary design target; no horizontal scroll |
| Mobile landscape | ≤ 932 px, short viewport | Reflow; critical controls must stay on-screen |
| Tablet / iPad portrait | 768–1024 px | Two-column layouts where content warrants |
| Tablet / iPad landscape | 1024–1366 px | Same as portrait but wider; avoid dead whitespace |
| Laptop / desktop | ≥ 1025 px | Full layout; sidebar nav preferred over bottom tabs |

### Touch & gesture rules
- **Minimum tap target: 44 × 44 px** — applies to all buttons, chips, and icon controls.
- **Swipe-left to complete/confirm** (right-reveal action, green): implemented on Circuit task list and Chef grocery list via `SwipeTaskRow` / `SwipeGroceryRow`. Use the same pointer-event pattern for any new swipeable list.
- **Swipe-left further to skip/secondary** (deeper swipe, amber): implemented in Circuit `SwipeTaskRow` only.
- Swipe is layered on top of existing tap controls — both must remain functional.

### Voice input
- Present a mic button whenever the field accepts free-text input on the primary capture path.
- Use the `useVoiceInput` hook from `src/lib/use-voice-input.ts` (Canopy) or the equivalent in each app.
- Show a clear "listening…" state; hide the mic button entirely when `!voice.supported` (SSR / unsupported browser).
- `autoFocus` **off** by default on mobile to avoid keyboard jump on load (CortexSignIn rule — extend to all forms).

### Input affordances
- Keyboard shortcut hints (e.g. `Ctrl+Enter`, `Esc`) are desktop-only — render them inside a `hidden sm:block` wrapper or equivalent so they don't clutter mobile.

### Config & environment
- **Never** add `localhost` or `127.0.0.1` to `CORS_ORIGINS`, `render.yaml`, or Pydantic config defaults. Dev origins belong in `.env` only.
