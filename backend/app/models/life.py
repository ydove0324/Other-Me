from __future__ import annotations

from datetime import date

from sqlalchemy import String, Text, Integer, Date, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, LifeStatus


class AlternativeLife(Base, TimestampMixin):
    __tablename__ = "alternative_lives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fork_point_id: Mapped[int] = mapped_column(ForeignKey("fork_points.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    persona_snapshot_id: Mapped[int | None] = mapped_column(ForeignKey("user_personas.id", ondelete="SET NULL"), nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[LifeStatus] = mapped_column(
        default=LifeStatus.generating, server_default="generating", nullable=False,
    )
    generation_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    story_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    story_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_type: Mapped[str] = mapped_column(String(50), default="timeline", server_default="timeline", nullable=False)

    fork_point: Mapped["ForkPoint"] = relationship(back_populates="alternative_lives")
    events: Mapped[list[LifeTimelineEvent]] = relationship(
        back_populates="alternative_life", cascade="all, delete-orphan",
        order_by="LifeTimelineEvent.sort_order",
    )
    scenes: Mapped[list["LifeScene"]] = relationship(
        back_populates="alternative_life", cascade="all, delete-orphan",
        order_by="LifeScene.sort_order",
    )

    __table_args__ = (
        Index("ix_alternative_lives_fork_point_id", "fork_point_id"),
        Index("ix_alternative_lives_user_id", "user_id"),
    )


class LifeTimelineEvent(Base, TimestampMixin):
    __tablename__ = "life_timeline_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alternative_life_id: Mapped[int] = mapped_column(ForeignKey("alternative_lives.id", ondelete="CASCADE"), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    detailed_narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    emotional_tone: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)

    alternative_life: Mapped[AlternativeLife] = relationship(back_populates="events")

    __table_args__ = (Index("ix_life_timeline_events_life_id", "alternative_life_id"),)


class LifeScene(Base, TimestampMixin):
    __tablename__ = "life_scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alternative_life_id: Mapped[int] = mapped_column(ForeignKey("alternative_lives.id", ondelete="CASCADE"), nullable=False)
    scene_type: Mapped[str] = mapped_column(String(50), nullable=False, default="text")
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    alternative_life: Mapped[AlternativeLife] = relationship(back_populates="scenes")

    __table_args__ = (Index("ix_life_scenes_life_id", "alternative_life_id"),)
