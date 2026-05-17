# Canopy backlog

Tracked ideas and future work. Not a commitment order.

## Capture and input

- [ ] **Voice commands for data entry** — hands-free quick capture (local speech-to-text first; cloud only with explicit opt-in).
- [ ] **Siri / Shortcuts integration (feasibility)** — iOS Shortcuts action to append a capture or open quick-entry; requires mobile shell or PWA and documented URL scheme. Evaluate privacy (no silent exfiltration of notes).

## Sync and identity

- [ ] **Encrypted cross-device sync** — build on `/api/auth` sessions; end-to-end encrypted blob sync; conflict resolution for interactions.
- [ ] **Passkey support** — WebAuthn alongside password/passcode.

## Intelligence (local-first)

- [ ] **Semantic retrieval** — pgvector embeddings for interactions (see `docs/ROADMAP.md` v0.2).
- [ ] **Local LLM summaries** — optional Ollama integration for periodic synthesis, not real-time diagnosis.

## Product

- [ ] **Task / responsibility entity** — ontology dimensions linked to tasks, not only global sliders.
- [ ] **Tauri desktop shell** — optional native wrapper per `docs/ARCHITECTURE.md`.
