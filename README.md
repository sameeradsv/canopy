# Canopy

Local-first contextual memory — preserve what you notice, who you interact with, and patterns over time without sending data to the cloud.

## v0.1 features

- **Quick capture** — log an observation in under 30 seconds (context, outcome, confidence, participants, tags)
- **Timeline** — chronological view of all interactions
- **People** — entity list linked to captures
- **Tagging** — comma-separated tags on each interaction
- **Search** — keyword search across interactions and people
- **Dashboard** — counts and recent activity summary

Data stays on your machine (SQLite by default). Export and delete-all endpoints are available on the API for backup and reset.

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
| API | https://canopy-api.fly.dev (after Fly setup below) |

Push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): deploys the FastAPI backend to **Fly.io**, then builds the Next.js UI with `NEXT_PUBLIC_API_URL` and publishes to **GitHub Pages**.

**One-time setup**

1. **GitHub Pages:** Repo **Settings → Pages → Source** → **GitHub Actions**.
2. **Fly.io API** (free tier; persistent SQLite on a volume):
   ```bash
   # Install: https://fly.io/docs/hands-on/install-flyctl/
   fly auth login
   fly apps create canopy-api
   fly volumes create canopy_data --region iad --size 1 -a canopy-api
   fly deploy --config backend/fly.toml backend
   ```
3. **GitHub secret:** `FLY_API_TOKEN` from `fly tokens create deploy -x 999999h`
4. Optional repo variable `CANOPY_API_URL` if your API host differs from `https://canopy-api.fly.dev`.

On first visit from the hosted UI, open **Account** and register — production API has `AUTH_REQUIRED=true`. Data stays on your Fly volume (still your instance, not shared multi-tenant SaaS).

Without `FLY_API_TOKEN`, only the UI is deployed; use the API locally as in **Run locally** above.

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

## Philosophy

Canopy is not a CRM, therapy app, or gamified productivity tool. It focuses on cognitive offloading and contextual continuity — remembering nuance and uncertainty so you spend less mental energy recomputing the same interpretations.

Product docs live in [`docs/`](docs/) (vision, architecture, ontology, roadmap). Backlog: [`TODO.md`](TODO.md).
