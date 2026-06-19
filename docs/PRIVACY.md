# Privacy and Ethics

# Philosophy

Canopy stores sensitive human context.

Privacy is foundational, not optional.

---

# Local-First Design

Defaults:
- local storage
- local processing where possible
- optional sync
- minimal cloud dependency

---

# Sensitive Information

Potentially sensitive:
- workplace observations
- interpersonal dynamics
- emotional context
- behavioral impressions
- operational frustrations

Assume compromise risk exists.

---

# Security Requirements

Minimum:
- encrypted storage
- authentication
- backup strategy
- export/delete capability

Recommended:
- local AI inference
- end-to-end encrypted sync
- self-hosting support

Current implementation notes:
- Authenticated people and interactions are scoped by `user_id`; interaction participant links must point to people owned by the current user.
- `DELETE /api/data` clears only the authenticated user's Canopy data and leaves other users, the account row, and the current session intact.
- Dynamic user-data GET responses are marked `Cache-Control: no-store` to avoid stale browser caches after writes.

---

# Ethical Boundaries

Canopy should:
- reduce cognitive fatigue,
- preserve context,
- improve calibration.

Canopy should not:
- intensify paranoia,
- create rigid profiling,
- or encourage manipulative behavior.
