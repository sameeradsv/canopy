"""Deterministic pattern detection (Canopy v0.3) — no LLM."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Interaction, Person, interaction_participants


def detect_patterns(db: Session, user_id: Optional[int]) -> dict:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    since = now - timedelta(days=60)

    interactions = list(
        db.scalars(
            select(Interaction)
            .options(selectinload(Interaction.tags), selectinload(Interaction.participants))
            .where(Interaction.user_id == user_id, Interaction.occurred_at >= since)
            .order_by(Interaction.occurred_at.desc())
            .limit(500)
        ).all()
    )

    tag_counts: Counter[str] = Counter()
    for ix in interactions:
        for tag in ix.tags:
            tag_counts[tag.name.lower()] += 1

    recurring_tags = [
        {"tag": name, "count": count}
        for name, count in tag_counts.most_common(5)
        if count >= 3
    ]

    stale_people: list[dict] = []
    people = list(db.scalars(select(Person).where(Person.user_id == user_id)).all())
    for p in people:
        last_ix = (
            db.query(func.max(Interaction.occurred_at))
            .join(interaction_participants, Interaction.id == interaction_participants.c.interaction_id)
            .filter(interaction_participants.c.person_id == p.id)
            .scalar()
        )
        if last_ix and (now - last_ix).days >= 21:
            stale_people.append({"name": p.name, "days_since": (now - last_ix).days})

    stale_people.sort(key=lambda x: x["days_since"], reverse=True)

    weekday_counts: Counter[int] = Counter()
    for ix in interactions:
        weekday_counts[ix.occurred_at.weekday()] += 1
    busiest = weekday_counts.most_common(1)
    busiest_day = None
    if busiest and busiest[0][1] >= 5:
        names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        busiest_day = {"weekday": names[busiest[0][0]], "count": busiest[0][1]}

    insights: list[str] = []
    if recurring_tags:
        top = recurring_tags[0]
        insights.append(f'"{top["tag"]}" appears on {top["count"]} interactions in 60 days.')
    if stale_people[:1]:
        p = stale_people[0]
        insights.append(f"No contact with {p['name']} in {p['days_since']} days.")
    if busiest_day:
        insights.append(f"Most interactions land on {busiest_day['weekday']}s ({busiest_day['count']} in 60 days).")

    return {
        "recurring_tags": recurring_tags,
        "stale_contacts": stale_people[:5],
        "busiest_weekday": busiest_day,
        "insights": insights,
    }
