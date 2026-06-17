from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.models import User
from app.schemas import InteractionRead, PersonRead, SearchResult, Summary, TagRead
from app.services import get_summary, list_tags, person_to_read, search
from app.routers.interactions import _to_read

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResult)
def get_search(
    q: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    uid = user.id if user else None
    interactions, people = search(db, q, user_id=uid)
    return SearchResult(
        query=q,
        interactions=[_to_read(i) for i in interactions],
        people=[PersonRead(**person_to_read(p)) for p in people],
    )


@router.get("/summary", response_model=Summary)
def get_summary_endpoint(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    uid = user.id if user else None
    data = get_summary(db, user_id=uid)
    return Summary(
        total_interactions=data["total_interactions"],
        total_people=data["total_people"],
        total_tags=data["total_tags"],
        recent_interactions=[_to_read(i) for i in data["recent_interactions"]],
        top_tags=[TagRead.model_validate(t) for t in data["top_tags"]],
        frequently_contacted=[
            PersonRead(**person_to_read(person, ix_count=ix_count, last_at_dt=last_at))
            for person, ix_count, last_at in data["frequently_contacted"]
        ],
    )


@router.get("/tags", response_model=list[TagRead])
def get_tags(db: Session = Depends(get_db)):
    return [TagRead.model_validate(t) for t in list_tags(db)]
