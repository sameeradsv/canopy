# Canopy backlog

Tracked ideas and future work. Not a commitment order.

## Capture and input

- [ ] **Voice commands for data entry** — hands-free quick capture (local speech-to-text first; cloud only with explicit opt-in).
- [ ] **Siri / Shortcuts integration (feasibility)** — iOS Shortcuts action to append a capture or open quick-entry; requires mobile shell or PWA and documented URL scheme. Evaluate privacy (no silent exfiltration of notes).

## Sync and identity

- [x] **Encrypted export scaffold** — `/api/sync/export` + import preview; passphrase-derived keys, no server storage.
- [x] **Auth persistence + session display** — `AuthContext` validates token on startup via `/api/auth/me`; Nav shows username + sign-out button; login page redirects if already authenticated; `DELETE /api/auth/logout` invalidates session.
- [x] **Account + sync UI** — `/account` identity + stats; **encrypted export/import on `/settings`**; plain JSON export on Settings too.
- [x] **AES-GCM export crypto** — upgraded from XOR-stream+HMAC (v1) to AES-GCM-256 via pycryptodome (v2); v1 blobs still readable for backward compat.
- [ ] **Encrypted cross-device sync** — automatic merge; conflict resolution for interactions (manual export/import works now).
- [x] **Passkey support** — WebAuthn passkey / biometric sign-in. Backend: `POST /api/auth/webauthn/register/begin|complete` and `/login/begin|complete`. Frontend: `usePasskey` hook + `PasskeyBanner` post-login prompt.
- [ ] **Enable `AUTH_REQUIRED` in production** — optional gate on destructive/sync routes (implemented; off by default for local dev).

## Intelligence (local-first)

- [ ] **Semantic retrieval** — pgvector embeddings for interactions (see `docs/ROADMAP.md` v0.2; next step in `docs/ARCHITECTURE.md`).
- [ ] **Local LLM summaries** — optional Ollama integration for periodic synthesis, not real-time diagnosis.

## Product

- [x] **Tasks removed from Canopy** — task management belongs in Circuit (`DECISIONS.md`, 2026-05-27). Dimension presets on `/dimensions` retained for possible future interaction scoring.
- [x] **InteractionCard** — shared timeline row component (`components/InteractionCard.tsx`).
- [x] **Plain JSON export** — Settings → Download JSON (`GET /api/export`).
- [x] **`lib/dimensions.ts`** — dimension labels/keys deduped from `/dimensions` page.
- [x] **Tag autocomplete on capture** — `TagInput` + `api.listTags()` on capture and timeline edit.
- [x] **TerminalView** — mounted as fourth timeline view tab (`feed` / `diary` / `calendar` / `terminal`).
- [ ] **Tauri desktop shell** — feasible: Next.js static export or standalone server + Tauri webview; not started (non-trivial, ~1–2 days).
- [x] **PWA / mobile shell** — Next.js PWA plugin, web manifest, installable icons; API still requires local backend when online.

## Done (pass 2)

- Backend pytest on Python 3.9 (3.10+ preferred when available).
- Fixed SQLAlchemy `relationship` name shadowing on `Person` model.
- Auth middleware deps (`optional_auth_user`, `AUTH_REQUIRED`).
- Removed stale `/api/tasks` tests and UI references (tasks live in Circuit).
