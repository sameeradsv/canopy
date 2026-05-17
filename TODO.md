# Canopy backlog

Tracked ideas and future work. Not a commitment order.

## Capture and input

- [ ] **Voice commands for data entry** — hands-free quick capture (local speech-to-text first; cloud only with explicit opt-in).
- [ ] **Siri / Shortcuts integration (feasibility)** — iOS Shortcuts action to append a capture or open quick-entry; requires mobile shell or PWA and documented URL scheme. Evaluate privacy (no silent exfiltration of notes).

## Sync and identity

- [x] **Encrypted export scaffold** — `/api/sync/export` + import preview; passphrase-derived keys, no server storage.
- [ ] **Encrypted cross-device sync** — merge import, conflict resolution for interactions and tasks.
- [ ] **Passkey support** — WebAuthn alongside password/passcode.
- [ ] **Enable `AUTH_REQUIRED` in production** — optional gate on destructive/sync routes (implemented; off by default for local dev).

## Intelligence (local-first)

- [ ] **Semantic retrieval** — pgvector embeddings for interactions (see `docs/ROADMAP.md` v0.2; next step in `docs/ARCHITECTURE.md`).
- [ ] **Local LLM summaries** — optional Ollama integration for periodic synthesis, not real-time diagnosis.

## Product

- [x] **Task / responsibility entity** — per-task ontology dimensions via `/api/tasks` and Tasks UI.
- [ ] **Tauri desktop shell** — feasible: Next.js static export or standalone server + Tauri webview; not started (non-trivial, ~1–2 days).
- [x] **PWA / mobile shell** — Next.js PWA plugin, web manifest, installable icons; API still requires local backend when online.

## Done (pass 2)

- Backend pytest on Python 3.9 (3.10+ preferred when available).
- Fixed SQLAlchemy `relationship` name shadowing on `Person` model.
- Auth middleware deps (`optional_auth_user`, `AUTH_REQUIRED`).
- Tasks CRUD with dimension persistence.
