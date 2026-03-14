from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )


class OAuthProvider(str, enum.Enum):
    google = "google"
    github = "github"


class ForkPointStatus(str, enum.Enum):
    draft = "draft"
    generating = "generating"
    completed = "completed"
    failed = "failed"


class LifeStatus(str, enum.Enum):
    generating = "generating"
    completed = "completed"
    failed = "failed"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class TaskType(str, enum.Enum):
    persona_generation = "persona_generation"
    life_timeline = "life_timeline"
    event_detail = "event_detail"
    story_generation = "story_generation"


class QuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    open_ended = "open_ended"
    scale = "scale"
