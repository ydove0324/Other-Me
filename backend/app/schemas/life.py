from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class TimelineEventResponse(BaseModel):
    id: int
    event_date: date | None = None
    title: str
    summary: str
    detailed_narrative: str | None = None
    emotional_tone: dict | None = None
    sort_order: int


class SceneResponse(BaseModel):
    id: int
    scene_type: str
    title: str | None = None
    content: str | None = None
    media_url: str | None = None
    metadata: dict | None = None
    sort_order: int


class AlternativeLifeResponse(BaseModel):
    id: int
    fork_point_id: int
    overview: str | None = None
    status: str
    created_at: datetime
    content_type: str = "timeline"
    events: list[TimelineEventResponse] = []


class StoryResponse(BaseModel):
    id: int
    fork_point_id: int
    story_title: str | None = None
    story_markdown: str | None = None
    status: str
    content_type: str = "story"
    created_at: datetime
    scenes: list[SceneResponse] = []


class LifeBlocksResponse(BaseModel):
    id: int
    fork_point_id: int
    overview: str | None = None
    status: str
    content_type: str = "blocks"
    created_at: datetime
    blocks: list[SceneResponse] = []


class GenerateLifeRequest(BaseModel):
    pass
