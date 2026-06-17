# Deferred & future work

**Last updated:** 2026-06-17  
**Canonical copy:** kept in sync with [Circuit `docs/DEFERRED.md`](https://github.com/sameeradsv/circuit/blob/main/docs/DEFERRED.md) (ecosystem master).

Canopy-specific summary below.

---

## Canopy — deferred

| Item | Version | Notes |
|------|---------|--------|
| **pgvector / embeddings** | v0.2 | Groq has no embedding API |
| **Contextual linking** | v0.2 | Auto link interactions ↔ entities |
| **Local LLM (Ollama)** | v0.4 | Groq synthesis shipped for cloud path |
| **Adaptive tagging, memory compression** | v0.4 | Not started |
| **Encrypted auto sync** | Backlog | Manual export/import works |
| **Tauri desktop** | Backlog | ~1–2 day shell project |
| **`AUTH_REQUIRED` in prod** | Ops | Enable via env when deploying |

## Ecosystem (affects Canopy)

Sibling-auth via Conduit/Cortex, Siri shortcuts, pgvector — see Circuit master `DEFERRED.md`.

## Terminal UX

Terminal/diary hub → **Conduit only**. Canopy `/chat` = native Groq agent.

## Shipped (2026-06)

TagInput, tag search, `GET /api/ai/patterns`, `POST /api/ai/synthesize`, voice on capture, TerminalView removed.
