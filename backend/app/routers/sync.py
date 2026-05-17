from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.dimensions_utils import parse_dimensions
from app.export_crypto import decrypt_export, encrypt_export
from app.models import Interaction, Person, Tag, Task, User

router = APIRouter(prefix="/sync", tags=["sync"])


class EncryptedExportRequest(BaseModel):
    passphrase: str = Field(min_length=8, max_length=200)


class EncryptedImportRequest(BaseModel):
    passphrase: str = Field(min_length=8, max_length=200)
    blob: dict


def _collect_export_payload(db: Session) -> dict:
    people = db.scalars(select(Person)).all()
    tags = db.scalars(select(Tag)).all()
    interactions = db.scalars(
        select(Interaction).options(
            selectinload(Interaction.participants),
            selectinload(Interaction.tags),
        )
    ).all()
    tasks = db.scalars(select(Task)).all()
    return {
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
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "dimensions": parse_dimensions(t.dimensions_json),
                "created_at": t.created_at.isoformat(),
            }
            for t in tasks
        ],
    }


@router.post("/export")
def encrypted_export(
    data: EncryptedExportRequest,
    db: Session = Depends(get_db),
    _user: Optional[User] = Depends(optional_auth_user),
):
    """Export all local data as a passphrase-encrypted blob. Keys never leave the client passphrase."""
    payload = _collect_export_payload(db)
    return encrypt_export(payload, data.passphrase)


@router.post("/import")
def encrypted_import(
    data: EncryptedImportRequest,
    db: Session = Depends(get_db),
    _user: Optional[User] = Depends(optional_auth_user),
):
    """
    Decrypt and validate an export blob. Full merge/sync is not implemented yet;
    returns a preview of entity counts for verification.
    """
    try:
        inner = decrypt_export(data.blob, data.passphrase)
    except Exception as exc:
        raise HTTPException(400, "Could not decrypt export — check passphrase and blob") from exc

    return {
        "status": "preview",
        "exported_at": inner.get("exported_at"),
        "counts": {
            "people": len(inner.get("people", [])),
            "interactions": len(inner.get("interactions", [])),
            "tasks": len(inner.get("tasks", [])),
            "tags": len(inner.get("tags", [])),
        },
        "message": "Import merge not implemented; use this endpoint to verify decryption only.",
    }
