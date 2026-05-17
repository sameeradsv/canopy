from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps.auth import optional_auth_user, require_user
from app.dimensions_utils import parse_dimensions, serialize_dimensions
from app.export_crypto import decrypt_export, encrypt_export
from app.models import Interaction, Person, Tag, Task, User
from app.services import get_or_create_tags

router = APIRouter(prefix="/sync", tags=["sync"])


class EncryptedExportRequest(BaseModel):
    passphrase: str = Field(min_length=8, max_length=200)


class EncryptedImportRequest(BaseModel):
    passphrase: str = Field(min_length=8, max_length=200)
    blob: dict


def _collect_export_payload(db: Session, user_id: Optional[int] = None) -> dict:
    people = db.scalars(select(Person).where(Person.user_id == user_id)).all()
    tags = db.scalars(select(Tag)).all()
    interactions = db.scalars(
        select(Interaction)
        .where(Interaction.user_id == user_id)
        .options(
            selectinload(Interaction.participants),
            selectinload(Interaction.tags),
        )
    ).all()
    tasks = db.scalars(select(Task).where(Task.user_id == user_id)).all()
    return {
        "people": [
            {
                "id": p.id,
                "name": p.name,
                "relationship": p.relationship,
                "notes": p.notes,
                "created_at": p.created_at.isoformat(),
            }
            for p in people
        ],
        "tags": [{"id": t.id, "name": t.name} for t in tags],
        "interactions": [
            {
                "id": i.id,
                "occurred_at": i.occurred_at.isoformat(),
                "context": i.context,
                "observation": i.observation,
                "outcome": i.outcome,
                "confidence": i.confidence,
                "participant_ids": [p.id for p in i.participants],
                "tag_names": [t.name for t in i.tags],
            }
            for i in interactions
        ],
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "dimensions": parse_dimensions(t.dimensions_json),
                "created_at": t.created_at.isoformat(),
            }
            for t in tasks
        ],
    }


@router.post("/export")
def encrypted_export(
    data: EncryptedExportRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    """Export all data for the current user as a passphrase-encrypted blob."""
    payload = _collect_export_payload(db, user_id=user.id if user else None)
    return encrypt_export(payload, data.passphrase)


@router.post("/import")
def encrypted_import(
    data: EncryptedImportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    """
    Decrypt an export blob and merge its contents into the authenticated user's account.
    People are upserted by name; interactions by (occurred_at, observation prefix);
    tasks by title. Tags are global get-or-create.
    """
    try:
        inner = decrypt_export(data.blob, data.passphrase)
    except Exception as exc:
        raise HTTPException(400, "Could not decrypt export — check passphrase and blob") from exc

    uid = user.id
    created = {"people": 0, "interactions": 0, "tasks": 0, "tags": 0}
    skipped = {"people": 0, "interactions": 0, "tasks": 0}

    # Build name→id map for people already owned by this user
    existing_people: dict[str, Person] = {
        p.name: p
        for p in db.scalars(select(Person).where(Person.user_id == uid)).all()
    }
    # Map from blob person IDs to local DB person IDs (needed for participant linking)
    blob_to_local_person: dict[int, int] = {}

    for p_data in inner.get("people", []):
        name = (p_data.get("name") or "").strip()
        if not name:
            continue
        if name in existing_people:
            blob_to_local_person[p_data["id"]] = existing_people[name].id
            skipped["people"] += 1
        else:
            new_person = Person(
                user_id=uid,
                name=name,
                relationship=p_data.get("relationship"),
                notes=p_data.get("notes"),
            )
            db.add(new_person)
            db.flush()
            existing_people[name] = new_person
            blob_to_local_person[p_data["id"]] = new_person.id
            created["people"] += 1

    # Tags are global; use get_or_create
    for t_data in inner.get("tags", []):
        tag_name = (t_data.get("name") or "").strip().lower()
        if not tag_name:
            continue
        existing = db.scalar(select(Tag).where(Tag.name == tag_name))
        if existing is None:
            db.add(Tag(name=tag_name))
            created["tags"] += 1

    db.flush()

    # Interactions: deduplicate by (user_id, occurred_at, first 50 chars of observation)
    for i_data in inner.get("interactions", []):
        from datetime import datetime as _dt
        obs = (i_data.get("observation") or "").strip()
        try:
            occurred = _dt.fromisoformat(i_data["occurred_at"].rstrip("Z"))
        except Exception:
            skipped["interactions"] += 1
            continue

        dup = db.scalar(
            select(Interaction).where(
                Interaction.user_id == uid,
                Interaction.occurred_at == occurred,
                Interaction.observation.startswith(obs[:50]),
            )
        )
        if dup:
            skipped["interactions"] += 1
            continue

        new_i = Interaction(
            user_id=uid,
            occurred_at=occurred,
            context=i_data.get("context"),
            observation=obs,
            outcome=i_data.get("outcome"),
            confidence=float(i_data.get("confidence", 0.7)),
        )
        # Link participants using mapped IDs
        participant_ids = [
            blob_to_local_person[pid]
            for pid in i_data.get("participant_ids", [])
            if pid in blob_to_local_person
        ]
        if participant_ids:
            new_i.participants = list(
                db.scalars(select(Person).where(Person.id.in_(participant_ids))).all()
            )
        if i_data.get("tag_names"):
            new_i.tags = get_or_create_tags(db, i_data["tag_names"])
        db.add(new_i)
        created["interactions"] += 1

    # Tasks: upsert by (user_id, title)
    existing_tasks: dict[str, Task] = {
        t.title: t
        for t in db.scalars(select(Task).where(Task.user_id == uid)).all()
    }
    for t_data in inner.get("tasks", []):
        title = (t_data.get("title") or "").strip()
        if not title:
            continue
        from datetime import datetime as _dt
        try:
            blob_updated = _dt.fromisoformat(
                (t_data.get("updated_at") or t_data.get("created_at", "")).rstrip("Z")
            )
        except Exception:
            blob_updated = None

        if title in existing_tasks:
            existing_t = existing_tasks[title]
            # Overwrite dimensions if blob is newer
            if blob_updated and existing_t.updated_at < blob_updated:
                from app.dimensions_utils import serialize_dimensions
                dims = t_data.get("dimensions") or {}
                existing_t.dimensions_json = serialize_dimensions(dims)
            skipped["tasks"] += 1
        else:
            from app.dimensions_utils import serialize_dimensions
            dims = t_data.get("dimensions") or {}
            new_t = Task(
                user_id=uid,
                title=title,
                description=t_data.get("description"),
                dimensions_json=serialize_dimensions(dims),
            )
            db.add(new_t)
            created["tasks"] += 1

    db.commit()

    return {
        "status": "merged",
        "exported_at": inner.get("exported_at"),
        "created": created,
        "skipped": skipped,
    }
