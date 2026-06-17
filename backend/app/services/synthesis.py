"""Groq weekly interaction synthesis (Canopy v0.2)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.models import Interaction

_MAX_INTERACTIONS = 25
_MAX_OBS_LEN = 150
_GROQ_TIMEOUT_S = 20.0


def synthesize_period(db: Session, user_id: Optional[int], days: int = 7) -> dict:
    try:
        return _synthesize_period(db, user_id, days)
    except Exception as exc:
        return {"summary": "", "days": days, "error": str(exc)}


def _synthesize_period(db: Session, user_id: Optional[int], days: int = 7) -> dict:
    if not settings.groq_api_key:
        return {"summary": "", "error": "GROQ_API_KEY not configured", "days": days}

    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    rows = list(
        db.scalars(
            select(Interaction)
            .options(selectinload(Interaction.participants), selectinload(Interaction.tags))
            .where(Interaction.user_id == user_id, Interaction.occurred_at >= since)
            .order_by(Interaction.occurred_at.desc())
            .limit(_MAX_INTERACTIONS)
        ).all()
    )
    if not rows:
        return {"summary": "No interactions in this period.", "days": days}

    lines: list[str] = []
    for ix in rows:
        obs = (ix.observation or "").strip()
        if not obs:
            continue
        ts = ix.occurred_at.strftime("%Y-%m-%d") if ix.occurred_at else "unknown"
        names = ", ".join(p.name for p in ix.participants if p.name)
        tags = ", ".join(t.name for t in ix.tags if t.name)
        line = f"[{ts}]"
        if names:
            line += f" with {names}"
        line += f": {obs[:_MAX_OBS_LEN]}"
        if tags:
            line += f" (#{tags})"
        lines.append(line)

    if not lines:
        return {"summary": "No interactions in this period.", "days": days}

    from groq import Groq

    client = Groq(api_key=settings.groq_api_key, timeout=_GROQ_TIMEOUT_S)
    prompt = (
        f"Summarize these personal interaction notes from the last {days} days in 3-5 calm bullet points. "
        "No diagnosis, no advice - reflective synthesis only.\n\n"
        + "\n".join(lines)
    )
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a concise personal memory assistant."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=400,
            temperature=0.4,
        )
    except Exception as exc:
        return {"summary": "", "days": days, "error": str(exc)}

    if not resp.choices:
        return {"summary": "", "days": days, "error": "Groq returned no completion"}

    summary = (resp.choices[0].message.content or "").strip()
    return {"summary": summary, "days": days, "interaction_count": len(rows)}
