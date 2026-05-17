from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.dimensions_utils import merge_dimension_update, parse_dimensions, serialize_dimensions
from app.models import Interaction, Person, Tag, Task
from app.schemas import (
    InteractionCreate,
    InteractionUpdate,
    PersonCreate,
    PersonUpdate,
    TaskCreate,
    TaskUpdate,
)


def _normalize_tag(name: str) -> str:
    return name.strip().lower()


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


def person_to_read(person: Person) -> dict:
    return {
        "id": person.id,
        "name": person.name,
        "relationship": person.relationship,
        "notes": person.notes,
        "created_at": person.created_at,
        "updated_at": person.updated_at,
        "interaction_count": len(person.interactions),
    }


def interaction_query(db: Session):
    return select(Interaction).options(
        selectinload(Interaction.participants),
        selectinload(Interaction.tags),
    )


def list_people(db: Session, q: Optional[str] = None) -> list[Person]:
    stmt = select(Person).options(selectinload(Person.interactions)).order_by(Person.name)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Person.name.ilike(pattern), Person.notes.ilike(pattern)))
    return list(db.scalars(stmt).all())


def create_person(db: Session, data: PersonCreate) -> Person:
    person = Person(
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


def list_interactions(
    db: Session,
    *,
    person_id: Optional[int] = None,
    tag: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Interaction]:
    stmt = interaction_query(db).order_by(Interaction.occurred_at.desc()).offset(offset).limit(limit)
    if person_id is not None:
        stmt = stmt.join(Interaction.participants).where(Person.id == person_id)
    if tag:
        stmt = stmt.join(Interaction.tags).where(Tag.name == _normalize_tag(tag))
    return list(db.scalars(stmt).unique().all())


def create_interaction(db: Session, data: InteractionCreate) -> Interaction:
    interaction = Interaction(
        occurred_at=data.occurred_at or datetime.utcnow(),
        context=data.context,
        observation=data.observation.strip(),
        outcome=data.outcome,
        confidence=data.confidence,
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
    if data.context is not None:
        interaction.context = data.context
    if data.observation is not None:
        interaction.observation = data.observation.strip()
    if data.outcome is not None:
        interaction.outcome = data.outcome
    if data.confidence is not None:
        interaction.confidence = data.confidence
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


def search(db: Session, query: str, limit: int = 50) -> tuple[list[Interaction], list[Person]]:
    pattern = f"%{query.strip()}%"
    if not query.strip():
        return [], []

    interactions = list(
        db.scalars(
            interaction_query(db)
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
            .where(or_(Person.name.ilike(pattern), Person.notes.ilike(pattern)))
            .order_by(Person.name)
            .limit(limit)
        ).all()
    )
    return interactions, people


def get_summary(db: Session) -> dict:
    total_interactions = db.scalar(select(func.count()).select_from(Interaction)) or 0
    total_people = db.scalar(select(func.count()).select_from(Person)) or 0
    total_tags = db.scalar(select(func.count()).select_from(Tag)) or 0
    recent = list(db.scalars(interaction_query(db).order_by(Interaction.occurred_at.desc()).limit(5)).all())
    top_tags = list(
        db.scalars(
            select(Tag)
            .join(Tag.interactions)
            .group_by(Tag.id)
            .order_by(func.count(Interaction.id).desc())
            .limit(5)
        ).all()
    )
    return {
        "total_interactions": total_interactions,
        "total_people": total_people,
        "total_tags": total_tags,
        "recent_interactions": recent,
        "top_tags": top_tags,
    }


def list_tags(db: Session) -> list[Tag]:
    return list(db.scalars(select(Tag).order_by(Tag.name)).all())


def task_to_read(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "dimensions": parse_dimensions(task.dimensions_json),
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def list_tasks(db: Session) -> list[Task]:
    return list(db.scalars(select(Task).order_by(Task.updated_at.desc())).all())


def create_task(db: Session, data: TaskCreate) -> Task:
    task = Task(
        title=data.title.strip(),
        description=data.description,
        dimensions_json=serialize_dimensions(data.dimensions),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: Task, data: TaskUpdate) -> Task:
    if data.title is not None:
        task.title = data.title.strip()
    if data.description is not None:
        task.description = data.description
    if data.dimensions is not None:
        current = parse_dimensions(task.dimensions_json)
        merged = merge_dimension_update(current, data.dimensions)
        task.dimensions_json = serialize_dimensions(merged)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
