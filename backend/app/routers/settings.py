import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.constants import DIMENSION_KEYS
from app.database import get_db
from app.models import Setting
from app.schemas import DimensionsRead, DimensionsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

DIMENSIONS_KEY = "dimensions"


def _default_dimensions() -> dict[str, float | None]:
    return {key: None for key in DIMENSION_KEYS}


def _load_dimensions(db: Session) -> dict[str, float | None]:
    row = db.get(Setting, DIMENSIONS_KEY)
    if not row:
        return _default_dimensions()
    try:
        data = json.loads(row.value)
    except json.JSONDecodeError:
        return _default_dimensions()
    merged = _default_dimensions()
    for key in DIMENSION_KEYS:
        if key in data and data[key] is not None:
            merged[key] = float(data[key])
    return merged


@router.get("/dimensions", response_model=DimensionsRead)
def get_dimensions(db: Session = Depends(get_db)):
    return DimensionsRead(values=_load_dimensions(db))


@router.put("/dimensions", response_model=DimensionsRead)
def put_dimensions(data: DimensionsUpdate, db: Session = Depends(get_db)):
    payload = _default_dimensions()
    for key, value in data.values.items():
        if key in payload:
            if value is not None and not 0 <= value <= 1:
                from fastapi import HTTPException

                raise HTTPException(400, f"{key} must be between 0 and 1")
            payload[key] = value
    row = db.get(Setting, DIMENSIONS_KEY)
    if row is None:
        row = Setting(key=DIMENSIONS_KEY, value=json.dumps(payload))
        db.add(row)
    else:
        row.value = json.dumps(payload)
    db.commit()
    return DimensionsRead(values=payload)
