from __future__ import annotations

from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.models import Person, User
from app.schemas import PersonCreate, PersonRead, PersonUpdate
from app.services import count_people, create_person, delete_person, list_people, person_to_read, update_person

router = APIRouter(prefix="/people", tags=["people"])


def _rows_to_read(rows) -> list[PersonRead]:
    return [
        PersonRead(**person_to_read(p, ix_count=int(cnt or 0), last_at_dt=last_at))
        for p, cnt, last_at in rows
    ]


@router.get("")
def get_people(
    q: Optional[str] = None,
    page: Optional[int] = Query(None, ge=1, description="1-based page; returns paginated payload"),
    limit: int = 24,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
) -> Union[list[PersonRead], dict]:
    uid = user.id if user else None
    filters = dict(q=q, user_id=uid)

    if page is not None:
        page_n = max(1, page)
        limit_n = max(1, min(100, limit))
        offset_n = (page_n - 1) * limit_n
        total = count_people(db, **filters)
        rows = list_people(db, **filters, limit=limit_n, offset=offset_n)
        pages = max(1, (total + limit_n - 1) // limit_n) if total else 0
        return {
            "items": _rows_to_read(rows),
            "total": total,
            "page": page_n,
            "limit": limit_n,
            "pages": pages,
        }

    return _rows_to_read(list_people(db, **filters))


@router.post("", response_model=PersonRead, status_code=201)
def post_person(
    data: PersonCreate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    person = create_person(db, data, user_id=user.id if user else None)
    return PersonRead(**person_to_read(person))


@router.get("/{person_id}", response_model=PersonRead)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    person = db.get(Person, person_id)
    uid = user.id if user else None
    if not person or person.user_id != uid:
        raise HTTPException(404, "Person not found")
    return PersonRead(**person_to_read(person))


@router.patch("/{person_id}", response_model=PersonRead)
def patch_person(
    person_id: int,
    data: PersonUpdate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    person = db.get(Person, person_id)
    uid = user.id if user else None
    if not person or person.user_id != uid:
        raise HTTPException(404, "Person not found")
    person = update_person(db, person, data)
    return PersonRead(**person_to_read(person))


@router.delete("/{person_id}", status_code=204)
def remove_person(
    person_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    person = db.get(Person, person_id)
    uid = user.id if user else None
    if not person or person.user_id != uid:
        raise HTTPException(404, "Person not found")
    delete_person(db, person)
