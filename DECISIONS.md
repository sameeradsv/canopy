# Architecture Decisions

This file records intentional divergences from the Tend design spec and conscious product choices.

---

## Tasks feature removed from UI
**Decision (2026-05-27):** The Tasks feature described in the Tend design spec (`/tasks` with ranked/matrix/kanban views and dimension scoring) is intentionally absent from Canopy.

**Reason:** Tasks functionality conflicts with the Circuit product. Canopy's scope is relationship tracking (people + interactions) only.

**Implication:** The `/tasks` route is absent. Task-related scoring UI variants (radar, steppers, XY plot) are excluded from scope. Dimension presets on the Dimensions page are retained as they may apply to interaction scoring in the future.

---

## Nav / AmbientBackground removed (2026-06)

**Decision:** Deleted `Nav.tsx` and `AmbientBackground.tsx` in favor of `ShellLayout.tsx` (sidebar + topbar + mobile drawer).

**Reason:** Duplicate app chrome; ShellLayout is the single navigation surface.

**Do not restore** standalone `Nav` without removing ShellLayout duplication.

---

## TagInput on capture (2026-06)

**Decision:** Wire `TagInput` (datalist from `GET /api/tags`) on capture and timeline edit.

**Reason:** `listTags` API existed but UI was free-text only.

---

## Terminal UI: Conduit only (2026-06-17)

**Decision:** Phosphor terminal shell (diary routing, cross-app agent, slash commands) lives **only in Conduit**. Sibling apps (Circuit, Canopy, Chef) expose **`/chat` — app-native personal Groq agent** — not a terminal view or mono log layout.

**Do not:**
- Mount terminal-style timeline views (e.g. Canopy `TerminalView`) in sibling apps
- Duplicate Conduit diary/agent orchestration in Circuit/Canopy/Chef frontends

**Sibling `/chat` is:** single-app Q&A via each app's native agent (`POST /api/agent/chat` or equivalent). Cross-app orchestration → use Conduit.

**Supersedes:** mounting `TerminalView` on Canopy timeline (reverted 2026-06-17).

---

## Dimension names diverge from design spec
**Decision (2026-05-27):** Canopy uses `urgency`, `reversibility`, `visibility`, `effort`, `growth_value`, `operational_cost` rather than the spec's `urgency`, `effort`, `growth`, `joy`, `alignment`, `leverage`.

**Reason:** Canopy's dimension set was established before the Tend design was produced and is tuned to the decision-making / operational context this product targets. The spec dimensions are more task-centric. Migrating would break existing user data.

**Implication:** Dimension preset cards and the Dimensions page use Canopy's key names.

---

## Energy scale stays as 0–1 float
**Decision (2026-05-27):** Backend stores energy as a `0.0–1.0` float rather than the spec's `-3 to +3` discrete integer scale.

**Reason:** The current scale is already live in the database and maps cleanly to a 0–100% UI slider. Migrating would require a data transformation for all existing interactions. The semantics (left = draining, right = energising) are identical.

**Implication:** Capture and timeline display draining / neutral / energising labels based on 0–0.35 / 0.35–0.65 / 0.65–1.0 thresholds.

---

## Slate theme and Grotesk font mode removed
**Decision (2026-05-27):** The Slate (cool-blue minimal) theme and Grotesk (Manrope) font mode from the Tend spec were removed from Canopy.

**Reason:** Usage data showed these modes were rarely selected. Removing them reduces CSS maintenance surface. Paper + Ink covers the light/dark range; Editorial + Typewriter covers serif/mono font preferences.

**Implication:** Settings page offers Paper / Ink themes and Editorial / Typewriter font modes only.
