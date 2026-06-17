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

Data stays on your machine (SQLite by default). Export (`GET /api/export`) and delete-all (`DELETE /api/data`) endpoints are available on the API for backup and reset; both require a valid Bearer token.

Auth supports username + password and **WebAuthn passkey / biometric sign-in** (fingerprint / Face ID). Enable or check status in **Settings → Security** after first login.

## Run locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API: http://127.0.0.1:8000 — health check at `/api/health`.

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
| API | https://canopy-api.onrender.com (after Render setup below) |

Push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): triggers a **Render** deploy for the API, then builds the Next.js UI with `NEXT_PUBLIC_API_URL` and publishes to **GitHub Pages**.

#### Render (recommended)

Render’s free plan allows **only one managed PostgreSQL database per account**. Chef or Circuit may already use that slot, so Canopy’s [`render.yaml`](render.yaml) deploys **only the web service** — you supply `DATABASE_URL` yourself (e.g. [Neon](https://neon.tech) free PostgreSQL).

**One-time setup**

1. **GitHub Pages:** Repo **Settings → Pages → Source** → **GitHub Actions**.
2. **Database:** Create a PostgreSQL instance (Neon, or a second logical database on an existing host). Copy the connection string.
3. **Render:** [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → connect this repo → apply `render.yaml`. On the `canopy-api` service, set **`DATABASE_URL`** to your connection string (Blueprint leaves it unset via `sync: false`).
4. **GitHub secret:** `RENDER_DEPLOY_HOOK` — from the Render service **Settings → Deploy Hook**.
5. Optional repo variable **`CANOPY_API_URL`** if your API host differs from `https://canopy-api.onrender.com`.

On first visit from the hosted UI, open **Account** and register — production API has `AUTH_REQUIRED=true`.

Without `RENDER_DEPLOY_HOOK`, only the UI is deployed on push; trigger Render deploys manually or from the dashboard.

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
