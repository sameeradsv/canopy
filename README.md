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
