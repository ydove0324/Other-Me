from __future__ import annotations

from datetime import date

from sqlalchemy import String, Text, Integer, Date, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, ForkPointStatus


class ForkPoint(Base, TimestampMixin):
    __tablename__ = "fork_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    happened_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_choice: Mapped[str] = mapped_column(Text, nullable=False)
    alternative_choice: Mapped[str] = mapped_column(Text, nullable=False)
    emotional_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[ForkPointStatus] = mapped_column(
        default=ForkPointStatus.draft, server_default="draft", nullable=False,
    )

    alternative_lives: Mapped[list] = relationship(
        "AlternativeLife", back_populates="fork_point", cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_fork_points_user_id", "user_id"),)
