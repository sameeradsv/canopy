from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field


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

    model_config = {"from_attributes": True}


class InteractionBase(BaseModel):
    occurred_at: Optional[datetime] = None
    context: Optional[str] = None
    observation: str = Field(min_length=1)
    outcome: Optional[str] = None
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)
    participant_ids: list[int] = Field(default_factory=list)
    tag_names: list[str] = Field(default_factory=list)


class InteractionCreate(InteractionBase):
    pass


class InteractionUpdate(BaseModel):
    occurred_at: Optional[datetime] = None
    context: Optional[str] = None
    observation: Optional[str] = None
    outcome: Optional[str] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    participant_ids: Optional[list[int]] = None
    tag_names: Optional[list[str]] = None


class InteractionRead(BaseModel):
    id: int
    occurred_at: datetime
    context: Optional[str]
    observation: str
    outcome: Optional[str]
    confidence: float
    created_at: datetime
    updated_at: datetime
    participants: list[PersonRead] = []
    tags: list[TagRead] = []

    model_config = {"from_attributes": True}


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
