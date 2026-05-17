from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Person
from app.schemas import PersonCreate, PersonRead, PersonUpdate
from app.services import create_person, delete_person, list_people, person_to_read, update_person

router = APIRouter(prefix="/people", tags=["people"])


@router.get("", response_model=list[PersonRead])
def get_people(q: str | None = None, db: Session = Depends(get_db)):
    return [PersonRead(**person_to_read(p)) for p in list_people(db, q)]


@router.post("", response_model=PersonRead, status_code=201)
def post_person(data: PersonCreate, db: Session = Depends(get_db)):
    person = create_person(db, data)
    return PersonRead(**person_to_read(person))


@router.get("/{person_id}", response_model=PersonRead)
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    return PersonRead(**person_to_read(person))


@router.patch("/{person_id}", response_model=PersonRead)
def patch_person(person_id: int, data: PersonUpdate, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    person = update_person(db, person, data)
    return PersonRead(**person_to_read(person))


@router.delete("/{person_id}", status_code=204)
def remove_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    delete_person(db, person)
