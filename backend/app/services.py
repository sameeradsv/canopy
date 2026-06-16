from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.dimensions_utils import parse_dimensions, serialize_dimensions
from app.models import Interaction, Person, Tag, interaction_participants
from app.schemas import (
    InteractionCreate,
    InteractionUpdate,
    PersonCreate,
    PersonUpdate,
)


def _normalize_tag(name: str) -> str:
    return name.strip().lower()


def _settings_key(user_id: Optional[int], key: str) -> str:
    """Namespace a settings key by user so each user has isolated settings."""
    if user_id is None:
        return key
    return f"{user_id}:{key}"


def get_or_create_tags(db: Session, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for raw in names:
        name = _normalize_tag(raw)
        if not name:
            continue
        tag = db.scalar(select(Tag).where(Tag.name == name))
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def person_to_read(
    person: Person,
    ix_count: Optional[int] = None,
    last_at_dt=None,
) -> dict:
    if ix_count is None:
        # Fallback for create/update/get — relationship already loaded on the object
        ix_count = len(person.interactions)
        last_at_dt = max((ix.occurred_at for ix in person.interactions), default=None) if person.interactions else None
    last_at = last_at_dt.strftime("%Y-%m-%dT%H:%M:%S") + "Z" if last_at_dt else None
    return {
        "id": person.id,
        "name": person.name,
        "relationship": person.relationship,
        "notes": person.notes,
        "created_at": person.created_at,
        "updated_at": person.updated_at,
        "interaction_count": ix_count,
        "last_interaction_at": last_at,
    }


def interaction_query(db: Session):
    return select(Interaction).options(
        selectinload(Interaction.participants),
        selectinload(Interaction.tags),
    )


def list_people(db: Session, q: Optional[str] = None, user_id: Optional[int] = None):
    # Single query with LEFT JOIN subquery for count + last-date instead of
    # loading all Interaction objects via selectinload.
    agg = (
        select(
            interaction_participants.c.person_id,
            func.count(interaction_participants.c.interaction_id).label("ix_count"),
            func.max(Interaction.occurred_at).label("last_at"),
        )
        .join(Interaction, Interaction.id == interaction_participants.c.interaction_id)
        .where(Interaction.user_id == user_id)
        .group_by(interaction_participants.c.person_id)
        .subquery()
    )
    stmt = (
        select(Person, agg.c.ix_count, agg.c.last_at)
        .outerjoin(agg, Person.id == agg.c.person_id)
        .where(Person.user_id == user_id)
        .order_by(Person.name)
    )
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Person.name.ilike(pattern), Person.notes.ilike(pattern)))
    return db.execute(stmt).all()  # rows of (Person, int|None, datetime|None)


def create_person(db: Session, data: PersonCreate, user_id: Optional[int] = None) -> Person:
    person = Person(
        user_id=user_id,
        name=data.name.strip(),
        relationship=data.relationship,
        notes=data.notes,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def update_person(db: Session, person: Person, data: PersonUpdate) -> Person:
    if data.name is not None:
        person.name = data.name.strip()
    if data.relationship is not None:
        person.relationship = data.relationship
    if data.notes is not None:
        person.notes = data.notes
    db.commit()
    db.refresh(person)
    return person


def delete_person(db: Session, person: Person) -> None:
    db.delete(person)
    db.commit()


def interaction_query(db: Session):
    return select(Interaction).options(
        selectinload(Interaction.participants),
        selectinload(Interaction.tags),
    )


def _apply_interaction_filters(
    stmt,
    *,
    person_id: Optional[int] = None,
    tag: Optional[str] = None,
    kind: Optional[str] = None,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
    user_id: Optional[int] = None,
):
    stmt = stmt.where(Interaction.user_id == user_id)
    if person_id is not None:
        stmt = stmt.join(Interaction.participants).where(Person.id == person_id)
    if tag:
        stmt = stmt.join(Interaction.tags).where(Tag.name == _normalize_tag(tag))
    if kind:
        stmt = stmt.where(Interaction.kind == kind)
    if from_dt is not None:
        stmt = stmt.where(Interaction.occurred_at >= from_dt)
    if to_dt is not None:
        stmt = stmt.where(Interaction.occurred_at <= to_dt)
    return stmt


def count_interactions(
    db: Session,
    *,
    person_id: Optional[int] = None,
    tag: Optional[str] = None,
    kind: Optional[str] = None,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> int:
    stmt = select(func.count(func.distinct(Interaction.id))).select_from(Interaction)
    stmt = _apply_interaction_filters(
        stmt,
        person_id=person_id,
        tag=tag,
        kind=kind,
        from_dt=from_dt,
        to_dt=to_dt,
        user_id=user_id,
    )
    return int(db.scalar(stmt) or 0)


def list_interactions(
    db: Session,
    *,
    person_id: Optional[int] = None,
    tag: Optional[str] = None,
    kind: Optional[str] = None,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    user_id: Optional[int] = None,
) -> list[Interaction]:
    stmt = _apply_interaction_filters(
        interaction_query(db),
        person_id=person_id,
        tag=tag,
        kind=kind,
        from_dt=from_dt,
        to_dt=to_dt,
        user_id=user_id,
    )
    stmt = (
        stmt.order_by(Interaction.occurred_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt).unique().all())


def create_interaction(db: Session, data: InteractionCreate, user_id: Optional[int] = None) -> Interaction:
    interaction = Interaction(
        user_id=user_id,
        occurred_at=data.occurred_at or datetime.now(timezone.utc).replace(tzinfo=None),
        kind=data.kind,
        context=data.context,
        observation=data.observation.strip(),
        outcome=data.outcome,
        confidence=data.confidence,
        reflection_json=json.dumps(data.reflection) if data.reflection else None,
    )
    if data.participant_ids:
        people = db.scalars(select(Person).where(Person.id.in_(data.participant_ids))).all()
        interaction.participants = list(people)
    if data.tag_names:
        interaction.tags = get_or_create_tags(db, data.tag_names)
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return db.scalar(interaction_query(db).where(Interaction.id == interaction.id))


def update_interaction(db: Session, interaction: Interaction, data: InteractionUpdate) -> Interaction:
    if data.occurred_at is not None:
        interaction.occurred_at = data.occurred_at
    if data.kind is not None:
        interaction.kind = data.kind
    if data.context is not None:
        interaction.context = data.context
    if data.observation is not None:
        interaction.observation = data.observation.strip()
    if data.outcome is not None:
        interaction.outcome = data.outcome
    if data.confidence is not None:
        interaction.confidence = data.confidence
    if data.reflection is not None:
        interaction.reflection_json = json.dumps(data.reflection)
    if data.participant_ids is not None:
        people = db.scalars(select(Person).where(Person.id.in_(data.participant_ids))).all()
        interaction.participants = list(people)
    if data.tag_names is not None:
        interaction.tags = get_or_create_tags(db, data.tag_names)
    db.commit()
    return db.scalar(interaction_query(db).where(Interaction.id == interaction.id))


def delete_interaction(db: Session, interaction: Interaction) -> None:
    db.delete(interaction)
    db.commit()


def search(
    db: Session, query: str, limit: int = 50, user_id: Optional[int] = None
) -> tuple[list[Interaction], list[Person]]:
    pattern = f"%{query.strip()}%"
    if not query.strip():
        return [], []

    interactions = list(
        db.scalars(
            interaction_query(db)
            .where(Interaction.user_id == user_id)
            .where(
                or_(
                    Interaction.observation.ilike(pattern),
                    Interaction.context.ilike(pattern),
                    Interaction.outcome.ilike(pattern),
                )
            )
            .order_by(Interaction.occurred_at.desc())
            .limit(limit)
        ).all()
    )

    people = list(
        db.scalars(
            select(Person)
            .options(selectinload(Person.interactions))
            .where(Person.user_id == user_id)
            .where(or_(Person.name.ilike(pattern), Person.notes.ilike(pattern)))
            .order_by(Person.name)
            .limit(limit)
        ).all()
    )
    return interactions, people


def _people_to_reach_out(
    db: Session,
    user_id: Optional[int] = None,
    limit: int = 3,
) -> list[tuple[Person, int, datetime]]:
    """People with interactions, oldest last contact first — single aggregated query."""
    agg = (
        select(
            interaction_participants.c.person_id,
            func.count(interaction_participants.c.interaction_id).label("ix_count"),
            func.max(Interaction.occurred_at).label("last_at"),
        )
        .join(Interaction, Interaction.id == interaction_participants.c.interaction_id)
        .where(Interaction.user_id == user_id)
        .group_by(interaction_participants.c.person_id)
        .subquery()
    )
    stmt = (
        select(Person, agg.c.ix_count, agg.c.last_at)
        .join(agg, Person.id == agg.c.person_id)
        .where(Person.user_id == user_id)
        .order_by(agg.c.last_at.asc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [(row[0], int(row[1] or 0), row[2]) for row in rows]


def get_summary(db: Session, user_id: Optional[int] = None) -> dict:
    total_interactions = (
        db.scalar(select(func.count()).select_from(Interaction).where(Interaction.user_id == user_id)) or 0
    )
    total_people = (
        db.scalar(select(func.count()).select_from(Person).where(Person.user_id == user_id)) or 0
    )
    total_tags = db.scalar(select(func.count()).select_from(Tag)) or 0
    recent = list(
        db.scalars(
            interaction_query(db)
            .where(Interaction.user_id == user_id)
            .order_by(Interaction.occurred_at.desc())
            .limit(5)
        ).all()
    )
    top_tags = list(
        db.scalars(
            select(Tag)
            .join(Tag.interactions)
            .where(Interaction.user_id == user_id)
            .group_by(Tag.id)
            .order_by(func.count(Interaction.id).desc())
            .limit(5)
        ).all()
    )
    # People to reach out to: oldest last contact (aggregated — no full interaction load)
    people_to_reach_out = _people_to_reach_out(db, user_id=user_id, limit=3)
    return {
        "total_interactions": total_interactions,
        "total_people": total_people,
        "total_tags": total_tags,
        "recent_interactions": recent,
        "top_tags": top_tags,
        "people_to_reach_out": people_to_reach_out,
    }


def list_tags(db: Session) -> list[Tag]:
    return list(db.scalars(select(Tag).order_by(Tag.name)).all())


def get_setting(db: Session, key: str, user_id: Optional[int] = None):
    from app.models import Setting
    return db.get(Setting, _settings_key(user_id, key))


def set_setting(db: Session, key: str, value: str, user_id: Optional[int] = None):
    from app.models import Setting
    namespaced = _settings_key(user_id, key)
    setting = db.get(Setting, namespaced)
    if setting is None:
        setting = Setting(key=namespaced, value=value)
        db.add(setting)
    else:
        setting.value = value
    db.commit()
    return setting


