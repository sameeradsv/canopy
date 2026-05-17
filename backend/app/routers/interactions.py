from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Interaction
from app.schemas import InteractionCreate, InteractionRead, InteractionUpdate, PersonRead, TagRead
from app.services import (
    create_interaction,
    delete_interaction,
    list_interactions,
    person_to_read,
    update_interaction,
)

router = APIRouter(prefix="/interactions", tags=["interactions"])


def _to_read(interaction: Interaction) -> InteractionRead:
    return InteractionRead(
        id=interaction.id,
        occurred_at=interaction.occurred_at,
        context=interaction.context,
        observation=interaction.observation,
        outcome=interaction.outcome,
        confidence=interaction.confidence,
        created_at=interaction.created_at,
        updated_at=interaction.updated_at,
        participants=[PersonRead(**person_to_read(p)) for p in interaction.participants],
        tags=[TagRead.model_validate(t) for t in interaction.tags],
    )


@router.get("", response_model=list[InteractionRead])
def get_interactions(
    person_id: int | None = None,
    tag: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    items = list_interactions(db, person_id=person_id, tag=tag, limit=limit, offset=offset)
    return [_to_read(i) for i in items]


@router.post("", response_model=InteractionRead, status_code=201)
def post_interaction(data: InteractionCreate, db: Session = Depends(get_db)):
    interaction = create_interaction(db, data)
    return _to_read(interaction)


@router.get("/{interaction_id}", response_model=InteractionRead)
def get_interaction(interaction_id: int, db: Session = Depends(get_db)):
    interaction = db.get(Interaction, interaction_id)
    if not interaction:
        raise HTTPException(404, "Interaction not found")
    db.refresh(interaction)
    return _to_read(interaction)


@router.patch("/{interaction_id}", response_model=InteractionRead)
def patch_interaction(
    interaction_id: int, data: InteractionUpdate, db: Session = Depends(get_db)
):
    interaction = db.get(Interaction, interaction_id)
    if not interaction:
        raise HTTPException(404, "Interaction not found")
    interaction = update_interaction(db, interaction, data)
    return _to_read(interaction)


@router.delete("/{interaction_id}", status_code=204)
def remove_interaction(interaction_id: int, db: Session = Depends(get_db)):
    interaction = db.get(Interaction, interaction_id)
    if not interaction:
        raise HTTPException(404, "Interaction not found")
    delete_interaction(db, interaction)
