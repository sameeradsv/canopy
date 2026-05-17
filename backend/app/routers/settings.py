from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.dimensions_utils import (
    DIMENSIONS_KEY,
    default_dimensions,
    parse_dimensions,
    serialize_dimensions,
)
from app.models import User
from app.schemas import DimensionsRead, DimensionsUpdate
from app.services import get_setting, set_setting

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/dimensions", response_model=DimensionsRead)
def get_dimensions(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    uid = user.id if user else None
    row = get_setting(db, DIMENSIONS_KEY, user_id=uid)
    values = parse_dimensions(row.value) if row else default_dimensions()
    return DimensionsRead(values=values)


@router.put("/dimensions", response_model=DimensionsRead)
def put_dimensions(
    data: DimensionsUpdate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    uid = user.id if user else None
    payload = serialize_dimensions(data.values) or json.dumps(default_dimensions())
    values = parse_dimensions(payload)
    set_setting(db, DIMENSIONS_KEY, payload, user_id=uid)
    return DimensionsRead(values=values)
