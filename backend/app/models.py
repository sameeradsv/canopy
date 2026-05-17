from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

interaction_participants = Table(
    "interaction_participants",
    Base.metadata,
    Column("interaction_id", ForeignKey("interactions.id", ondelete="CASCADE"), primary_key=True),
    Column("person_id", ForeignKey("people.id", ondelete="CASCADE"), primary_key=True),
)

interaction_tags = Table(
    "interaction_tags",
    Base.metadata,
    Column("interaction_id", ForeignKey("interactions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    interactions: Mapped[list["Interaction"]] = relationship(
        secondary=interaction_participants, back_populates="participants"
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    interactions: Mapped[list["Interaction"]] = relationship(
        secondary=interaction_tags, back_populates="tags"
    )


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=datetime.utcnow)
    context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    observation: Mapped[str] = mapped_column(Text)
    outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    participants: Mapped[list[Person]] = relationship(
        secondary=interaction_participants, back_populates="interactions"
    )
    tags: Mapped[list[Tag]] = relationship(
        secondary=interaction_tags, back_populates="interactions"
    )
