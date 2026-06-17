from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.models import Interaction, Person, PersonScore, User
from app.schemas import PersonScoreRead

router = APIRouter(prefix="/people", tags=["scores"])


def _build_score_read(ps: PersonScore) -> PersonScoreRead:
    return PersonScoreRead(
        person_id=ps.person_id,
        scores=json.loads(ps.scores_json),
        confidence=ps.confidence,
        summary=ps.summary,
        interaction_count=ps.interaction_count,
        scored_at=ps.scored_at,
    )


@router.get("/{person_id}/score", response_model=Optional[PersonScoreRead])
def get_person_score(
    person_id: int,
    user: Optional[User] = Depends(optional_auth_user),
    db: Session = Depends(get_db),
):
    uid = user.id if user else None
    person = db.scalar(select(Person).where(Person.id == person_id, Person.user_id == uid))
    if not person:
        raise HTTPException(404, "Person not found")
    ps = db.scalar(select(PersonScore).where(PersonScore.person_id == person_id, PersonScore.user_id == uid))
    if not ps:
        return None
    return _build_score_read(ps)


@router.post("/{person_id}/score", response_model=PersonScoreRead)
def score_person_endpoint(
    person_id: int,
    user: Optional[User] = Depends(optional_auth_user),
    db: Session = Depends(get_db),
):
    from app.ai import score_person
    from app.config import settings

    if not settings.groq_api_key:
        raise HTTPException(503, "AI scoring is not configured (GROQ_API_KEY missing)")

    uid = user.id if user else None
    person = db.scalar(
        select(Person)
        .options(selectinload(Person.interactions))
        .where(Person.id == person_id, Person.user_id == uid)
    )
    if not person:
        raise HTTPException(404, "Person not found")

    interactions_raw = db.scalars(
        select(Interaction)
        .where(Interaction.user_id == uid)
        .join(Interaction.participants)
        .where(Person.id == person_id)
        .order_by(Interaction.occurred_at.asc())
    ).all()

    ix_list = [
        {
            "occurred_at": ix.occurred_at.strftime("%Y-%m-%d"),
            "observation": ix.observation,
            "context": ix.context,
            "reflection": json.loads(ix.reflection_json) if ix.reflection_json else None,
        }
        for ix in interactions_raw
    ]

    try:
        result = score_person(
            person_name=person.name,
            relationship=person.relationship,
            person_notes=person.notes,
            interactions=ix_list,
        )
    except Exception as exc:
        raise HTTPException(500, f"Scoring failed: {exc}") from exc

    ps = db.scalar(select(PersonScore).where(PersonScore.person_id == person_id))
    if ps:
        ps.scores_json = json.dumps(result["scores"])
        ps.confidence = result["confidence"]
        ps.summary = result["summary"]
        ps.interaction_count = len(ix_list)
        from datetime import datetime, timezone
        ps.scored_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        ps = PersonScore(
            person_id=person_id,
            user_id=uid,
            scores_json=json.dumps(result["scores"]),
            confidence=result["confidence"],
            summary=result["summary"],
            interaction_count=len(ix_list),
        )
        db.add(ps)
    db.commit()
    db.refresh(ps)
    return _build_score_read(ps)


@router.get("/scores/all", response_model=dict[int, PersonScoreRead])
def get_all_scores(
    user: Optional[User] = Depends(optional_auth_user),
    db: Session = Depends(get_db),
):
    uid = user.id if user else None
    rows = db.scalars(select(PersonScore).where(PersonScore.user_id == uid)).all()
    return {ps.person_id: _build_score_read(ps) for ps in rows}


@router.post("/score-all", response_model=dict)
def score_all_people(
    user: Optional[User] = Depends(optional_auth_user),
    db: Session = Depends(get_db),
):
    from app.ai import score_person
    from app.config import settings

    if not settings.groq_api_key:
        raise HTTPException(503, "AI scoring is not configured (GROQ_API_KEY missing)")

    uid = user.id if user else None
    people = db.scalars(
        select(Person)
        .options(selectinload(Person.interactions))
        .where(Person.user_id == uid)
    ).all()

    scored = errors = 0
    for person in people:
        interactions_raw = db.scalars(
            select(Interaction)
            .where(Interaction.user_id == uid)
            .join(Interaction.participants)
            .where(Person.id == person.id)
            .order_by(Interaction.occurred_at.asc())
        ).all()

        ix_list = [
            {
                "occurred_at": ix.occurred_at.strftime("%Y-%m-%d"),
                "observation": ix.observation,
                "context": ix.context,
                "reflection": json.loads(ix.reflection_json) if ix.reflection_json else None,
            }
            for ix in interactions_raw
        ]

        try:
            result = score_person(
                person_name=person.name,
                relationship=person.relationship,
                person_notes=person.notes,
                interactions=ix_list,
            )
            ps = db.scalar(select(PersonScore).where(PersonScore.person_id == person.id))
            if ps:
                ps.scores_json = json.dumps(result["scores"])
                ps.confidence = result["confidence"]
                ps.summary = result["summary"]
                ps.interaction_count = len(ix_list)
                from datetime import datetime, timezone
                ps.scored_at = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                ps = PersonScore(
                    person_id=person.id,
                    user_id=uid,
                    scores_json=json.dumps(result["scores"]),
                    confidence=result["confidence"],
                    summary=result["summary"],
                    interaction_count=len(ix_list),
                )
                db.add(ps)
            db.flush()
            scored += 1
        except Exception:
            errors += 1

    db.commit()
    return {"scored": scored, "errors": errors, "total": len(people)}
