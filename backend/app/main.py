from __future__ import annotations

from typing import Optional

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.constants import RELATIONSHIP_DEFAULTS, RELATIONSHIP_TYPES
from app.deps.auth import optional_auth_user
from app.models import User
from app.routers import ai, auth, interactions, people, search, sync
from app.routers import settings as settings_router
from app.schemas import RelationshipDefaults

app = FastAPI(
    title="Canopy API",
    description="Local-first contextual memory system",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router, prefix="/api")
app.include_router(people.router, prefix="/api")
app.include_router(interactions.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(sync.router, prefix="/api")


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
def export_data(_user: Optional[User] = Depends(optional_auth_user)):
    from app.database import SessionLocal
    from app.routers.sync import _collect_export_payload

    db = SessionLocal()
    try:
        uid = _user.id if _user else None
        return _collect_export_payload(db, user_id=uid)
    finally:
        db.close()


@app.delete("/api/data", status_code=204)
def delete_all_data(_user: Optional[User] = Depends(optional_auth_user)):
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
