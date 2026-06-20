# Canopy

Local-first contextual memory — preserve what you notice, who you interact with, and patterns over time without sending data to the cloud.

## Features

- **Quick capture** — log an observation in under 30 seconds (context, outcome, confidence, participants, tags)
- **Voice input** — tap the microphone on the capture Note field to dictate (Web Speech API)
- **Timeline** — chronological view of all interactions
- **People** — entity list linked to captures
- **Tagging** — comma-separated tags on each interaction
- **Search** — keyword search across interactions and people
- **Dashboard** — counts and recent activity summary

Data stays on your machine (SQLite by default). Export (`GET /api/export`) and clear-my-data (`DELETE /api/data`) endpoints are available on the API for backup and reset; both require a valid Bearer token. `DELETE /api/data` removes only the authenticated user's people, interactions, namespaced settings, and now-unused tags; it does not delete other users or the current login account/session.

Auth supports username + password and **WebAuthn passkey / biometric sign-in** (fingerprint / Face ID). Enable or check status in **Settings → Security** after first login. Passkey support is loaded only when passkey endpoints are called, so normal API startup is not blocked by optional native WebAuthn runtime dependencies.

## Run locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API: http://127.0.0.1:8000 — health check at `/api/health`.

On Windows/Python environments that do not ship system timezone data, `tzdata` from `backend/requirements.txt` is required for `zoneinfo.ZoneInfo("Asia/Kolkata")`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000 — requests to `/api/*` are proxied to the backend (see `frontend/next.config.ts`).

**Install as PWA:** Run a production build (`npm run build && npm run start` in `frontend`), open the app in Chrome or Edge, and use “Install app” from the address bar or browser menu. The service worker is disabled in `npm run dev`; use production mode to test offline shell caching. Capture and API calls still need the backend running.

### Deployed app (mobile-friendly)

| Piece | URL |
|-------|-----|
| UI | https://sameeradsv.github.io/canopy/ |
| API | Your Vercel API URL (repo variable `CANOPY_API_URL`, e.g. `https://canopy-api.vercel.app`) |

Push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): Vercel's Git integration deploys the API from `backend/`, then GitHub Actions health-checks `CANOPY_API_URL`, builds the Next.js UI with `NEXT_PUBLIC_API_URL`, and publishes to **GitHub Pages**.

#### Vercel API + Neon database (recommended free-tier compute)

Canopy's API can run as a Vercel Python Function from the `backend/` directory. Keep data in PostgreSQL via `DATABASE_URL` (Neon is the expected free-tier database); do not use SQLite for Vercel because function filesystems are ephemeral.

The Vercel entrypoint is [`backend/api/index.py`](backend/api/index.py). [`backend/vercel.json`](backend/vercel.json) routes all requests to the FastAPI app and excludes tests/cache files from the function bundle. Set `INIT_DB_ON_STARTUP=false` on Vercel after the target database schema already exists; this avoids running `create_all` and migration checks on every cold start.

**One-time setup**

1. **GitHub Pages:** Repo **Settings -> Pages -> Source** -> **GitHub Actions**.
2. **Database:** Create a PostgreSQL instance (Neon, or a second logical database on an existing host). Copy the connection string.
3. **Vercel:** Import this GitHub repo as a new project. Set **Root Directory** to `backend`. Vercel reads Python `3.12` from `backend/.python-version`.
4. **Vercel environment variables:**
   - `DATABASE_URL` = Neon/PostgreSQL connection string
   - `AUTH_REQUIRED` = `true`
   - `CORS_ORIGINS` = `https://sameeradsv.github.io`
   - `INIT_DB_ON_STARTUP` = `false` once the schema exists
   - `GROQ_API_KEY` = optional, enables AI classification/chat
   - `CORTEX_AUTH_URL` = Cortex auth server URL, if using shared Cortex auth
   - `WEBAUTHN_RP_ID` = `sameeradsv.github.io` when using the GitHub Pages UI
   - `WEBAUTHN_ORIGIN` = `https://sameeradsv.github.io` when using the GitHub Pages UI
   - `WEBAUTHN_RP_NAME` = `canopy`
5. **Schema initialization:** if this is a new database, initialize it once before disabling startup schema work:

```bash
cd backend
$env:DATABASE_URL="postgresql://..."
python -m app.database
```

For an existing Neon database already used by Render, leave the data in place and set `INIT_DB_ON_STARTUP=false` immediately.

6. Set repo variable **`CANOPY_API_URL`** to your Vercel API URL. The workflow health-checks this before building the GitHub Pages UI.

On first visit from the hosted UI, open **Account** and register - production API has `AUTH_REQUIRED=true`.

`render.yaml` remains in the repo only as a rollback/reference path. The recommended compute target is Vercel.

### Docker Compose (optional)

From the repo root:

```bash
docker compose up --build
```

Starts PostgreSQL (pgvector), backend on port 8000, and frontend on port 3000.

## Project layout

```
canopy/
├── backend/     FastAPI + SQLAlchemy
├── frontend/    Next.js + Tailwind
├── data/        SQLite database (local dev)
└── docker-compose.yml
```

## Conduit integration

Canopy's backend is consumed by **conduit** — the hub app that provides cross-app AI chat and diary routing.

- **Agent reads:** `GET /api/people`, `GET /api/interactions` — conduit answers "When did I last talk to Alice?" and "Who should I follow up with?"
- **Diary writes:** `POST /api/interactions` (with participant name resolution) — conduit's diary mode logs interactions from freeform entries

Canopy also has an embedded terminal chat at `/chat` (in the sidebar, or press `5`), powered by Canopy's native Groq agent at `POST /api/ai/agent/chat`. Requires `GROQ_API_KEY` on the backend. No Conduit dependency for in-app chat.

## Philosophy

Canopy is not a CRM, therapy app, or gamified productivity tool. It focuses on cognitive offloading and contextual continuity — remembering nuance and uncertainty so you spend less mental energy recomputing the same interpretations.

Product docs live in [`docs/`](docs/) (vision, architecture, ontology, roadmap). **Deferred work:** [`docs/DEFERRED.md`](docs/DEFERRED.md). Backlog: [`TODO.md`](TODO.md).
