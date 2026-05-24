from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.models import Interaction, Person, User

router = APIRouter(prefix="/ai", tags=["ai"])


class ClassifyRequest(BaseModel):
    observation: str
    context: Optional[str] = None
    participant_ids: list[int] = []


class ClassifyResponse(BaseModel):
    energy: float
    label: str
    reasoning: str


@router.post("/classify", response_model=ClassifyResponse)
def classify(
    data: ClassifyRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    from app.ai import classify_energy
    from app.config import settings

    if not settings.groq_api_key:
        raise HTTPException(503, "AI classification is not configured (GROQ_API_KEY missing)")

    person_notes: list[tuple[str, str]] = []
    for pid in data.participant_ids:
        p = db.get(Person, pid)
        if p:
            person_notes.append((p.name, p.notes or ""))

    try:
        result = classify_energy(data.observation, data.context, person_notes or None)
    except Exception as exc:
        raise HTTPException(500, f"Classification failed: {exc}") from exc

    return result


@router.post("/classify-all", response_model=dict)
def classify_all(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    """Classify all interactions that have no energy score yet."""
    from app.ai import classify_energy
    from app.config import settings

    if not settings.groq_api_key:
        raise HTTPException(503, "AI classification is not configured (GROQ_API_KEY missing)")

    uid = user.id if user else None
    interactions = db.query(Interaction).filter(
        Interaction.user_id == uid,
        Interaction.energy.is_(None),
    ).all()

    classified = 0
    errors = 0
    for ix in interactions:
        person_notes = [(p.name, p.notes or "") for p in ix.participants]
        try:
            result = classify_energy(ix.observation, ix.context, person_notes or None)
            ix.energy = result["energy"]
            classified += 1
        except Exception:
            errors += 1

    db.commit()
    return {"classified": classified, "errors": errors, "total": len(interactions)}
