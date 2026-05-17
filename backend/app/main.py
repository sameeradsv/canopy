from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.constants import RELATIONSHIP_DEFAULTS, RELATIONSHIP_TYPES
from app.routers import auth, interactions, people, search, settings
from app.schemas import RelationshipDefaults

app = FastAPI(
    title="Canopy API",
    description="Local-first contextual memory system",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(people.router, prefix="/api")
app.include_router(interactions.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(auth.router, prefix="/api")


@app.get("/api/relationship-defaults", response_model=RelationshipDefaults)
def relationship_defaults():
    return RelationshipDefaults(types=RELATIONSHIP_TYPES, defaults=RELATIONSHIP_DEFAULTS)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/export")
def export_data():
    from app.database import SessionLocal
    from app.models import Interaction, Person, Tag
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    db = SessionLocal()
    try:
        people = db.scalars(select(Person)).all()
        tags = db.scalars(select(Tag)).all()
        interactions = db.scalars(
            select(Interaction).options(
                selectinload(Interaction.participants),
                selectinload(Interaction.tags),
            )
        ).all()
        payload = {
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
        return payload
    finally:
        db.close()


@app.delete("/api/data", status_code=204)
def delete_all_data():
    from app.database import SessionLocal
    from app.models import AuthSession, Interaction, Person, Setting, Tag, User

    db = SessionLocal()
    try:
        for model in (Interaction, Person, Tag, Setting, AuthSession, User):
            for row in db.query(model).all():
                db.delete(row)
        db.commit()
    finally:
        db.close()
