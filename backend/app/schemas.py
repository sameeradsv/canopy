from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field, field_serializer


class TagRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class PersonBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    relationship: Optional[str] = Field(None, max_length=40)
    notes: Optional[str] = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    relationship: Optional[str] = Field(None, max_length=40)
    notes: Optional[str] = None


class PersonRead(PersonBase):
    id: int
    created_at: datetime
    updated_at: datetime
    interaction_count: int = 0
    last_interaction_at: Optional[str] = None

    model_config = {"from_attributes": True}


INTERACTION_KINDS = {"meeting", "call", "message", "meal", "walk", "one-on-one"}


class InteractionBase(BaseModel):
    occurred_at: Optional[datetime] = None
    kind: Optional[str] = None
    context: Optional[str] = None
    observation: str = Field(min_length=1)
    outcome: Optional[str] = None
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)
    energy: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    reflection: Optional[Dict] = None
    participant_ids: list[int] = Field(default_factory=list)
    tag_names: list[str] = Field(default_factory=list)


class InteractionCreate(InteractionBase):
    pass


class InteractionUpdate(BaseModel):
    occurred_at: Optional[datetime] = None
    kind: Optional[str] = None
    context: Optional[str] = None
    observation: Optional[str] = None
    outcome: Optional[str] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    energy: Optional[float] = Field(None, ge=0.0, le=1.0)
    reflection: Optional[Dict] = None
    participant_ids: Optional[list[int]] = None
    tag_names: Optional[list[str]] = None


class InteractionRead(BaseModel):
    id: int
    occurred_at: datetime
    kind: Optional[str] = None
    context: Optional[str]
    observation: str
    outcome: Optional[str]
    confidence: float
    energy: Optional[float] = None
    reflection: Optional[Dict] = None
    created_at: datetime
    updated_at: datetime
    participants: list[PersonRead] = []
    tags: list[TagRead] = []

    @field_serializer("occurred_at", "created_at", "updated_at")
    def serialize_dt(self, v: datetime) -> str:
        # Always emit UTC with Z so browsers parse correctly as UTC, not local time
        return v.strftime("%Y-%m-%dT%H:%M:%S") + "Z"

    model_config = {"from_attributes": True}


class PersonScoreRead(BaseModel):
    person_id: int
    scores: Dict
    confidence: float
    summary: Optional[str] = None
    interaction_count: int
    scored_at: datetime


class SearchResult(BaseModel):
    interactions: list[InteractionRead]
    people: list[PersonRead]
    query: str


class Summary(BaseModel):
    total_interactions: int
    total_people: int
    total_tags: int
    recent_interactions: list[InteractionRead]
    top_tags: list[TagRead]
    frequently_contacted: list[PersonRead] = []


class DimensionsRead(BaseModel):
    values: Dict[str, Optional[float]]


class DimensionsUpdate(BaseModel):
    values: Dict[str, Optional[float]] = Field(default_factory=dict)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=6, max_length=200)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class UserRead(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserRead


class RelationshipDefaults(BaseModel):
    types: list[str]
    defaults: dict[str, dict[str, str]]


class EncryptedExportRequest(BaseModel):
    passphrase: str = Field(min_length=8, max_length=200)


class EncryptedImportRequest(BaseModel):
    passphrase: str = Field(min_length=8, max_length=200)
    blob: dict
