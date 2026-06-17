"""Groq weekly interaction synthesis (Canopy v0.2)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.models import Interaction


def synthesize_period(db: Session, user_id: Optional[int], days: int = 7) -> dict:
    if not settings.groq_api_key:
        return {"summary": "", "error": "GROQ_API_KEY not configured"}

    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    rows = list(
        db.scalars(
            select(Interaction)
            .options(selectinload(Interaction.participants), selectinload(Interaction.tags))
            .where(Interaction.user_id == user_id, Interaction.occurred_at >= since)
            .order_by(Interaction.occurred_at.desc())
            .limit(40)
        ).all()
    )
    if not rows:
        return {"summary": "No interactions in this period.", "days": days}

    lines = []
    for ix in rows:
        ts = ix.occurred_at.strftime("%Y-%m-%d")
        names = ", ".join(p.name for p in ix.participants)
        tags = ", ".join(t.name for t in ix.tags)
        line = f"[{ts}]"
        if names:
            line += f" with {names}"
        line += f": {ix.observation[:200]}"
        if tags:
            line += f" (#{tags})"
        lines.append(line)

    from groq import Groq

    client = Groq(api_key=settings.groq_api_key)
    prompt = (
        f"Summarize these personal interaction notes from the last {days} days in 3–5 calm bullet points. "
        "No diagnosis, no advice — reflective synthesis only.\n\n"
        + "\n".join(lines)
    )
    resp = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are a concise personal memory assistant."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=400,
        temperature=0.4,
    )
    summary = (resp.choices[0].message.content or "").strip()
    return {"summary": summary, "days": days, "interaction_count": len(rows)}
