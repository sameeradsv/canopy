from __future__ import annotations

from datetime import date as date_cls, datetime, timezone
from typing import Optional, Union
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.models import Interaction, User
from app.schemas import InteractionCreate, InteractionRead, InteractionUpdate, PersonRead, TagRead
from app.services import (
    count_interactions,
    create_interaction,
    delete_interaction,
    list_interactions,
    person_to_read,
    update_interaction,
)

router = APIRouter(prefix="/interactions", tags=["interactions"])
_IST = ZoneInfo("Asia/Kolkata")


def _parse_ist_date_range(
    from_date: Optional[str],
    to_date: Optional[str],
) -> tuple[Optional[datetime], Optional[datetime]]:
    start = end = None
    if from_date:
        try:
            parsed = date_cls.fromisoformat(from_date)
        except ValueError as exc:
            raise HTTPException(400, "from_date must be YYYY-MM-DD") from exc
        start = datetime(parsed.year, parsed.month, parsed.day, tzinfo=_IST).astimezone(timezone.utc).replace(tzinfo=None)
    if to_date:
        try:
            parsed = date_cls.fromisoformat(to_date)
        except ValueError as exc:
            raise HTTPException(400, "to_date must be YYYY-MM-DD") from exc
        end = datetime(parsed.year, parsed.month, parsed.day, 23, 59, 59, 999999, tzinfo=_IST).astimezone(timezone.utc).replace(tzinfo=None)
    return start, end


def _to_read(interaction: Interaction) -> InteractionRead:
    import json as _json
    return InteractionRead(
        id=interaction.id,
        occurred_at=interaction.occurred_at,
        kind=interaction.kind,
        context=interaction.context,
        observation=interaction.observation,
        outcome=interaction.outcome,
        confidence=interaction.confidence,
        energy=interaction.energy,
        duration_minutes=interaction.duration_minutes,
        reflection=_json.loads(interaction.reflection_json) if interaction.reflection_json else None,
        created_at=interaction.created_at,
        updated_at=interaction.updated_at,
        participants=[PersonRead(**person_to_read(p)) for p in interaction.participants],
        tags=[TagRead.model_validate(t) for t in interaction.tags],
    )


@router.get("")
def get_interactions(
    person_id: Optional[int] = None,
    tag: Optional[str] = None,
    kind: Optional[str] = None,
    from_date: Optional[str] = Query(None, description="Inclusive start date (YYYY-MM-DD, IST)"),
    to_date: Optional[str] = Query(None, description="Inclusive end date (YYYY-MM-DD, IST)"),
    page: Optional[int] = Query(None, ge=1, description="1-based page; returns paginated payload"),
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
) -> Union[list[InteractionRead], dict]:
    uid = user.id if user else None
    from_dt, to_dt = _parse_ist_date_range(from_date, to_date)
    filters = dict(
        person_id=person_id,
        tag=tag,
        kind=kind,
        from_dt=from_dt,
        to_dt=to_dt,
        user_id=uid,
    )

    if page is not None:
        page_n = max(1, page)
        limit_n = max(1, min(100, limit))
        offset_n = (page_n - 1) * limit_n
        total = count_interactions(db, **filters)
        items = list_interactions(db, **filters, limit=limit_n, offset=offset_n)
        pages = max(1, (total + limit_n - 1) // limit_n) if total else 0
        return {
            "items": [_to_read(i) for i in items],
            "total": total,
            "page": page_n,
            "limit": limit_n,
            "pages": pages,
        }

    items = list_interactions(db, **filters, limit=limit, offset=offset)
    return [_to_read(i) for i in items]


@router.post("", response_model=InteractionRead, status_code=201)
def post_interaction(
    data: InteractionCreate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    try:
        interaction = create_interaction(db, data, user_id=user.id if user else None)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _to_read(interaction)


@router.get("/{interaction_id}", response_model=InteractionRead)
def get_interaction(
    interaction_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    interaction = db.get(Interaction, interaction_id)
    uid = user.id if user else None
    if not interaction or interaction.user_id != uid:
        raise HTTPException(404, "Interaction not found")
    db.refresh(interaction)
    return _to_read(interaction)


@router.patch("/{interaction_id}", response_model=InteractionRead)
def patch_interaction(
    interaction_id: int,
    data: InteractionUpdate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    interaction = db.get(Interaction, interaction_id)
    uid = user.id if user else None
    if not interaction or interaction.user_id != uid:
        raise HTTPException(404, "Interaction not found")
    try:
        interaction = update_interaction(db, interaction, data)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _to_read(interaction)


@router.delete("/{interaction_id}", status_code=204)
def remove_interaction(
    interaction_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    interaction = db.get(Interaction, interaction_id)
    uid = user.id if user else None
    if not interaction or interaction.user_id != uid:
        raise HTTPException(404, "Interaction not found")
    delete_interaction(db, interaction)
