# Architecture

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