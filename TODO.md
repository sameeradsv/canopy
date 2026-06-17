# Canopy backlog

Tracked ideas and future work. **Full deferred inventory:** [docs/DEFERRED.md](docs/DEFERRED.md).

## Capture and input

- [x] **Voice on capture** — `useVoiceInput` on `/capture`.
- [ ] **Siri / Shortcuts integration** — deferred; see [DEFERRED.md](docs/DEFERRED.md).

## Sync and identity

- [x] **Encrypted export scaffold** — `/api/sync/export` + import preview; passphrase-derived keys, no server storage.
- [x] **Auth persistence + session display** — `AuthContext` validates token on startup via `/api/auth/me`; Nav shows username + sign-out button; login page redirects if already authenticated; `DELETE /api/auth/logout` invalidates session.
- [x] **Account + sync UI** — `/account` identity + stats; **encrypted export/import on `/settings`**; plain JSON export on Settings too.
- [x] **AES-GCM export crypto** — upgraded from XOR-stream+HMAC (v1) to AES-GCM-256 via pycryptodome (v2); v1 blobs still readable for backward compat.
- [ ] **Encrypted cross-device sync** — see [DEFERRED.md](docs/DEFERRED.md).
- [x] **Passkey support** — WebAuthn passkey / biometric sign-in. Backend: `POST /api/auth/webauthn/register/begin|complete` and `/login/begin|complete`. Frontend: `usePasskey` hook + `PasskeyBanner` post-login prompt.
- [ ] **Enable `AUTH_REQUIRED` in production** — optional gate on destructive/sync routes (implemented; off by default for local dev).

## Intelligence (local-first)

- [ ] **Semantic retrieval (pgvector)** — [DEFERRED.md](docs/DEFERRED.md); Groq synthesis + tag search shipped.
- [ ] **Local LLM summaries (Ollama)** — deferred; Groq weekly synthesis on Home shipped.

## Product

- [x] **Tasks removed from Canopy** — task management belongs in Circuit (`DECISIONS.md`, 2026-05-27). Dimension presets on `/dimensions` retained for possible future interaction scoring.
- [x] **InteractionCard** — shared timeline row component (`components/InteractionCard.tsx`).
- [x] **Plain JSON export** — Settings → Download JSON (`GET /api/export`).
- [x] **`lib/dimensions.ts`** — dimension labels/keys deduped from `/dimensions` page.
- [x] **Tag autocomplete on capture** — `TagInput` + `api.listTags()` on capture and timeline edit.
- [x] **TerminalView removed** — terminal UX is Conduit-only; Canopy uses feed/diary/calendar + `/chat` for app-native agent (`DECISIONS.md` 2026-06-17).
- [ ] **Tauri desktop shell** — [DEFERRED.md](docs/DEFERRED.md).
- [x] **PWA / mobile shell** — Next.js PWA plugin, web manifest, installable icons; API still requires local backend when online.

## Done (pass 2)

- Backend pytest on Python 3.9 (3.10+ preferred when available).
- Fixed SQLAlchemy `relationship` name shadowing on `Person` model.
- Auth middleware deps (`optional_auth_user`, `AUTH_REQUIRED`).
- Removed stale `/api/tasks` tests and UI references (tasks live in Circuit).
