from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dimensions_utils import (
    DIMENSIONS_KEY,
    default_dimensions,
    parse_dimensions,
    serialize_dimensions,
)
from app.models import Setting
from app.schemas import DimensionsRead, DimensionsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _load_global_dimensions(db: Session) -> dict[str, float | None]:
    row = db.get(Setting, DIMENSIONS_KEY)
    if not row:
        return default_dimensions()
    return parse_dimensions(row.value)


@router.get("/dimensions", response_model=DimensionsRead)
def get_dimensions(db: Session = Depends(get_db)):
    return DimensionsRead(values=_load_global_dimensions(db))


@router.put("/dimensions", response_model=DimensionsRead)
def put_dimensions(data: DimensionsUpdate, db: Session = Depends(get_db)):
    payload = serialize_dimensions(data.values) or json.dumps(default_dimensions())
    values = parse_dimensions(payload)
    row = db.get(Setting, DIMENSIONS_KEY)
    if row is None:
        row = Setting(key=DIMENSIONS_KEY, value=payload)
        db.add(row)
    else:
        row.value = payload
    db.commit()
    return DimensionsRead(values=values)
