from __future__ import annotations

import json

from fastapi import HTTPException

from app.constants import DIMENSION_KEYS

DIMENSIONS_KEY = "dimensions"


def default_dimensions() -> dict[str, float | None]:
    return {key: None for key in DIMENSION_KEYS}


def parse_dimensions(raw: str | None) -> dict[str, float | None]:
    if not raw:
        return default_dimensions()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return default_dimensions()
    merged = default_dimensions()
    for key in DIMENSION_KEYS:
        if key in data and data[key] is not None:
            merged[key] = float(data[key])
    return merged


def serialize_dimensions(values: dict[str, float | None] | None) -> str | None:
    if values is None:
        return None
    payload = default_dimensions()
    for key, value in values.items():
        if key in payload:
            if value is not None and not 0 <= value <= 1:
                raise HTTPException(400, f"{key} must be between 0 and 1")
            payload[key] = value
    return json.dumps(payload)


def merge_dimension_update(
    current: dict[str, float | None], updates: dict[str, float | None]
) -> dict[str, float | None]:
    payload = dict(current)
    for key, value in updates.items():
        if key in payload:
            if value is not None and not 0 <= value <= 1:
                raise HTTPException(400, f"{key} must be between 0 and 1")
            payload[key] = value
    return payload
