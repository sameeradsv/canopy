from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import init_db
from app.constants import RELATIONSHIP_DEFAULTS, RELATIONSHIP_TYPES
from app.deps.auth import require_user
from app.limiter import limiter
from app.models import User
from app.routers import ai, auth, interactions, people, scores, search, sync
from app.routers import settings as settings_router
from app.routers import webauthn as webauthn_router
from app.schemas import RelationshipDefaults

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Canopy API",
    description="Local-first contextual memory system",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    # Bearer tokens only (no cookies) — must be False so cross-origin fetch from
    # GitHub Pages works without credentials: "include" on the client.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router, prefix="/api")
app.include_router(scores.router, prefix="/api")
app.include_router(people.router, prefix="/api")
app.include_router(interactions.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(webauthn_router.router, prefix="/api")


@app.middleware("http")
async def add_cache_control(request: Request, call_next):
    response = await call_next(request)
    if request.method == "GET" and response.status_code == 200:
        if request.url.path == "/api/relationship-defaults":
            response.headers["Cache-Control"] = "public, max-age=86400"
        else:
            response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/relationship-defaults", response_model=RelationshipDefaults)
def relationship_defaults():
    return RelationshipDefaults(types=RELATIONSHIP_TYPES, defaults=RELATIONSHIP_DEFAULTS)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/export")
def export_data(_user: User = Depends(require_user)):
    from app.database import SessionLocal
    from app.routers.sync import _collect_export_payload

    db = SessionLocal()
    try:
        uid = _user.id if _user else None
        return _collect_export_payload(db, user_id=uid)
    finally:
        db.close()


@app.delete("/api/data", status_code=204)
def delete_all_data(_user: User = Depends(require_user)):
    from sqlalchemy import delete, select

    from app.database import SessionLocal
    from app.models import Interaction, Person, Setting, Tag

    db = SessionLocal()
    try:
        uid = _user.id
        for row in db.query(Interaction).filter(Interaction.user_id == uid).all():
            db.delete(row)
        for row in db.query(Person).filter(Person.user_id == uid).all():
            db.delete(row)
        db.flush()
        db.execute(
            delete(Setting)
            .where(Setting.key.like(f"{uid}:%"))
            .execution_options(synchronize_session=False)
        )
        unused_tag_ids = select(Tag.id).where(~Tag.interactions.any())
        db.execute(
            delete(Tag)
            .where(Tag.id.in_(unused_tag_ids))
            .execution_options(synchronize_session=False)
        )
        db.commit()
    finally:
        db.close()
