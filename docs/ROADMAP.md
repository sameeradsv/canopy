# Roadmap

# v0.1 — Core Memory System (shipped)

Features:
- quick capture
- entities
- interaction timeline
- tagging
- search
- local database
- bearer token auth + optional auth gate
- WebAuthn passkey / biometric sign-in
- encrypted export/import (AES-GCM)
- conduit integration (agent reads + diary writes)

Goal:
Create a usable low-friction memory layer.

---

# v0.2 — Contextual Retrieval

Features:
- embeddings
- semantic search
- contextual linking
- summaries
- tag autocomplete on capture (`TagInput` + `api.listTags`)

**Shipped (2026-06):** `TagInput` on capture + timeline edit.

**Terminal:** mono terminal log view is **not** in Canopy — use Conduit for terminal/diary orchestration; Canopy `/chat` is app-native agent only.

Questions:
- What gets retrieved frequently?
- Which dimensions become useful?
- What metadata becomes burdensome?

---

# v0.3 — Pattern Assistance

Features:
- recurring pattern detection
- operational burden visibility
- low-confidence insights
- periodic synthesis

Goal:
Support reflection without replacing judgment.

---

# v0.4 — Local Intelligence Layer

Potential:
- local LLM integration
- voice ingestion
- adaptive tagging
- contextual prompts
- memory compression

Only add features that:
- reduce cognitive load,
- preserve trust,
- and maintain low friction.