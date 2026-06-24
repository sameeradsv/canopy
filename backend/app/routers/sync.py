from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

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

_IST = ZoneInfo("Asia/Kolkata")

# Tags that affect energy (fallback when no AI score)
_DRAIN_TAGS    = {"stress", "conflict", "difficult", "disagreement", "argument", "frustrating", "hard"}
_RESTORE_TAGS  = {"celebration", "win", "support", "joy", "gratitude", "fun", "energizing"}


def _duration_multiplier(duration_minutes: Optional[int]) -> float:
    """
    Scale interaction impact from a 30-minute baseline.
    Longer interactions compound impact, capped so a single log cannot dominate.
    """
    if not duration_minutes or duration_minutes <= 30:
        return 1.0
    return round(min(3.0, (duration_minutes / 30) ** 0.5), 3)


def _interaction_delta(interaction: Interaction) -> float:
    """
    Signed energy delta for an interaction.
    Positive = restores energy (supportive/joyful), negative = drains.

    When an AI energy score is available: 1.0 (fully energising) → +0.15,
    0.5 (neutral) → 0, 0.0 (fully draining) → −0.18.
    Restore-tagged interactions (support, joy, celebration, etc.) give a
    genuine positive delta instead of merely reducing drain.
    """
    multiplier = _duration_multiplier(interaction.duration_minutes)

    if interaction.energy is not None:
        # Map 0–1 → −0.18 to +0.15 (asymmetric: draining interactions cost more)
        delta = (interaction.energy - 0.5) * 0.33
    else:
        base = -0.08  # slight social cost by default
        confidence_adj = (interaction.confidence - 0.70) * 0.10
        tag_names = {t.name.lower() for t in interaction.tags}
        tag_mod = (
             0.10 if tag_names & _RESTORE_TAGS   # genuinely restoring
            else -0.10 if tag_names & _DRAIN_TAGS  # genuinely draining
            else 0.0
        )
        delta = base + confidence_adj + tag_mod
    return round(max(-0.25 * multiplier, min(0.15 * multiplier, delta * multiplier)), 3)


def _interaction_drain(interaction: Interaction) -> float:
    """Legacy drain helper — kept for backward compat in energy_summary."""
    delta = _interaction_delta(interaction)
    return round(max(0.0, -delta), 3)


@router.get("/energy/timeline")
def energy_timeline(
    date: Optional[str] = None,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Cumulative interaction-energy timeline for a calendar day (default: today IST).

    Each event now carries `delta` (signed change) and `running_energy` (balance
    after that event). The day's social energy opens at 0.70 baseline — Canopy
    does not have sleep data, so the combined running line is computed by the
    frontend using Circuit's start_energy.
    """
    if date:
        try:
            from datetime import date as _date
            target = _date.fromisoformat(date)
        except ValueError:
            raise HTTPException(400, "date must be YYYY-MM-DD")
    else:
        target = datetime.now(_IST).date()

    day_start_utc = datetime(target.year, target.month, target.day, tzinfo=_IST).astimezone(timezone.utc).replace(tzinfo=None)
    day_end_utc = day_start_utc + timedelta(days=1)

    interactions = db.scalars(
        select(Interaction)
        .where(
            Interaction.user_id == user.id,
            Interaction.occurred_at >= day_start_utc,
            Interaction.occurred_at < day_end_utc,
        )
        .options(selectinload(Interaction.tags))
        .order_by(Interaction.occurred_at)
    ).all()

    START = 0.70  # Canopy-local baseline (frontend uses Circuit's start_energy for combined line)
    running = START
    events = []
    for ix in interactions:
        delta = _interaction_delta(ix)
        running = round(min(1.0, max(0.0, running + delta)), 3)
        label = "draining" if delta < -0.05 else "energising" if delta > 0.03 else "neutral"
        local_time = ix.occurred_at.replace(tzinfo=timezone.utc).astimezone(_IST)
        # energy field: map delta to 0–1 for backward compat with chart dots
        energy_compat = round(min(1.0, max(0.0, (delta + 0.25) / 0.40)), 3)
        events.append({
            "occurred_at":    ix.occurred_at.isoformat() + "Z",
            "time":           local_time.strftime("%H:%M"),
            "energy":         energy_compat,
            "delta":          delta,
            "running_energy": running,
            "duration_minutes": ix.duration_minutes,
            "label":          label,
            "note":           ix.observation[:80],
            "source":         "canopy",
        })

    end_energy = running
    avg = round(sum(e["energy"] for e in events) / len(events), 3) if events else None
    return {
        "date":         target.isoformat(),
        "source":       "canopy",
        "start_energy": START,
        "end_energy":   end_energy,
        "events":       events,
        "avg_energy":   avg,
    }


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
    now_ist = datetime.now(_IST)
    now_utc = now_ist.astimezone(timezone.utc).replace(tzinfo=None)
    today_start_utc = now_ist.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).replace(tzinfo=None)
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

    past_delta = 0.0
    future_delta = 0.0

    for ix in today_interactions:
        delta = _interaction_delta(ix)
        if ix.occurred_at <= now_utc:
            past_delta += delta
        else:
            future_delta += delta

    # energy_so_far: 0.70 baseline + cumulative deltas (clamped 0–1)
    energy_so_far = round(min(1.0, max(0.0, 0.70 + past_delta)), 3)
    energy_ahead  = round(min(1.0, max(0.0, energy_so_far + future_delta)), 3)
    # Retain drain fields for backward compat (positive-only portion of deltas)
    drain_so_far = round(min(1.0, max(0.0, -past_delta)), 3)
    drain_ahead  = round(min(1.0, max(0.0, -future_delta)), 3)

    return {
        "as_of": (now_ist).strftime("%Y-%m-%dT%H:%M:%S+05:30"),
        "source": "canopy",
        "drain_so_far": drain_so_far,
        "energy_so_far": energy_so_far,
        "drain_ahead": drain_ahead,
        "energy_ahead": energy_ahead,
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
                "energy": i.energy,
                "duration_minutes": i.duration_minutes,
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
            energy=i_data.get("energy"),
            duration_minutes=i_data.get("duration_minutes"),
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
