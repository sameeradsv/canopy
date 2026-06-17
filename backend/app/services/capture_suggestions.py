"""Capture-time suggestions — heuristic participant + tag matching (user confirms)."""
from __future__ import annotations

import re
from collections import Counter
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Interaction, Person, Tag

_TAG_KEYWORDS: dict[str, list[str]] = {
    "work": ["meeting", "project", "deadline", "standup", "review", "email", "office", "1:1"],
    "social": ["coffee", "lunch", "dinner", "party", "friend", "catch up", "drinks"],
    "family": ["family", "mom", "dad", "parent", "sibling", "home"],
    "stress": ["argument", "conflict", "tension", "difficult", "frustrat"],
    "joy": ["celebration", "birthday", "win", "fun", "laugh"],
}


def _name_in_text(name: str, text: str) -> bool:
    parts = [p for p in re.split(r"\s+", name.strip()) if len(p) > 1]
    if not parts:
        return False
    low = text.lower()
    if name.lower() in low:
        return True
    return any(re.search(rf"\b{re.escape(p.lower())}\b", low) for p in parts)


def suggest_capture(
    db: Session,
    user_id: Optional[int],
    observation: str,
    context: str = "",
) -> dict:
    text = f"{observation} {context}".strip()
    people_q = db.query(Person)
    if user_id is not None:
        people_q = people_q.filter(Person.user_id == user_id)
    people = people_q.order_by(Person.name).limit(200).all()

    suggested_people = []
    for p in people:
        if _name_in_text(p.name, text):
            suggested_people.append({
                "id": p.id,
                "name": p.name,
                "relationship": p.relationship,
            })
    suggested_people = suggested_people[:5]

    tag_counts: Counter[str] = Counter()
    if user_id is not None and suggested_people:
        pids = [p["id"] for p in suggested_people]
        rows = (
            db.query(Interaction)
            .options(
                selectinload(Interaction.tags),
                selectinload(Interaction.participants),
            )
            .filter(Interaction.user_id == user_id)
            .order_by(Interaction.occurred_at.desc())
            .limit(80)
            .all()
        )
        for row in rows:
            pids_row = {p.id for p in row.participants}
            if pids_row & set(pids):
                for t in row.tags:
                    tag_counts[t.name] += 1

    suggested_tags: list[str] = []
    low = text.lower()
    for tag, keywords in _TAG_KEYWORDS.items():
        if any(k in low for k in keywords):
            suggested_tags.append(tag)
    for tag, _ in tag_counts.most_common(3):
        if tag not in suggested_tags:
            suggested_tags.append(tag)

    all_tags = db.execute(select(Tag.name).order_by(Tag.name)).scalars().all()
    for name in all_tags:
        if name.lower() in low and name not in suggested_tags:
            suggested_tags.append(name)

    return {
        "suggested_participants": suggested_people,
        "suggested_tags": suggested_tags[:8],
    }
