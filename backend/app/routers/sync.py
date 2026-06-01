from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps.auth import optional_auth_user, require_user
from app.export_crypto import decrypt_export, encrypt_export
from app.models import Interaction, Person, Tag, User
from app.services import get_or_create_tags

router = APIRouter(prefix="/sync", tags=["sync"])

# ── Energy sync ───────────────────────────────────────────────────────────────

_IST = timedelta(hours=5, minutes=30)

# Tags that add to drain vs restore energy (fallback heuristic)
_DRAIN_TAGS = {"stress", "conflict", "difficult", "disagreement", "argument", "frustrating", "hard"}
_RESTORE_TAGS = {"celebration", "win", "support", "joy", "gratitude", "fun", "energizing"}


def _interaction_drain(interaction: Interaction) -> float:
    """
    Per-interaction drain on a 0–1 scale.
    Uses AI energy score when available (1.0=energising → 0 drain, 0.0=draining → 0.4 drain).
    Falls back to base cost + confidence modifier + tag modifier.
    """
    if interaction.energy is not None:
        return (1.0 - interaction.energy) * 0.4
    base = 0.15
    confidence_cost = (1.0 - interaction.confidence) * 0.20
    tag_names = {t.name.lower() for t in interaction.tags}
    tag_mod = (
        0.10 if tag_names & _DRAIN_TAGS
        else -0.05 if tag_names & _RESTORE_TAGS
        else 0.0
    )
    return max(0.05, base + confidence_cost + tag_mod)


@router.get("/energy")
def energy_summary(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Returns the user's interaction-based energy drain split at the current IST moment.
    - drain_so_far / energy_so_far: interactions already had today (occurred_at < now)
    - drain_ahead / energy_ahead:   interactions logged for later today (occurred_at >= now)
    All values 0–1; drain 1.0 = completely drained, energy 1.0 = fully energised.
    Day boundaries are computed in IST (UTC+05:30).
    """
    now_utc = datetime.utcnow()
    now_ist = now_utc + _IST
    today_start_utc = now_ist.replace(hour=0, minute=0, second=0, microsecond=0) - _IST
    today_end_utc = today_start_utc + timedelta(days=1)

    today_interactions = db.scalars(
        select(Interaction)
        .where(
            Interaction.user_id == user.id,
            Interaction.occurred_at >= today_start_utc,
            Interaction.occurred_at < today_end_utc,
        )
        .options(selectinload(Interaction.tags))
    ).all()

    past_drain = 0.0
    future_drain = 0.0

    for ix in today_interactions:
        drain = _interaction_drain(ix)
        if ix.occurred_at <= now_utc:
            past_drain += drain
        else:
            future_drain += drain

    drain_so_far = round(min(past_drain, 1.0), 3)
    drain_ahead = round(min(future_drain, 1.0), 3)

    return {
        "as_of": (now_ist).strftime("%Y-%m-%dT%H:%M:%S+05:30"),
        "source": "canopy",
        "drain_so_far": drain_so_far,
        "energy_so_far": round(1.0 - drain_so_far, 3),
        "drain_ahead": drain_ahead,
        "energy_ahead": round(1.0 - drain_ahead, 3),
        "interactions_so_far": sum(1 for ix in today_interactions if ix.occurred_at <= now_utc),
        "interactions_ahead": sum(1 for ix in today_interactions if ix.occurred_at > now_utc),
    }


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
    People are upserted by name; interactions by (occurred_at, observation prefix).
    Tags are global get-or-create.
    """
    try:
        inner = decrypt_export(data.blob, data.passphrase)
    except Exception as exc:
        raise HTTPException(400, "Could not decrypt export — check passphrase and blob") from exc

    uid = user.id
    created = {"people": 0, "interactions": 0, "tags": 0}
    skipped = {"people": 0, "interactions": 0}

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

    db.commit()

    return {
        "status": "merged",
        "exported_at": inner.get("exported_at"),
        "created": created,
        "skipped": skipped,
    }
