from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class CreateForkPointRequest(BaseModel):
    title: str
    description: str | None = None
    happened_at: date | None = None
    actual_choice: str
    alternative_choice: str
    emotional_context: dict | None = None


class ForkPointResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    happened_at: date | None = None
    actual_choice: str
    alternative_choice: str
    emotional_context: dict | None = None
    status: str
    created_at: datetime
    has_timeline: bool = False
    has_story: bool = False


class UpdateForkPointRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    happened_at: date | None = None
    actual_choice: str | None = None
    alternative_choice: str | None = None
    emotional_context: dict | None = None
