from __future__ import annotations

from sqlalchemy import Integer, Text, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class UserMemory(Base, TimestampMixin):
    __tablename__ = "user_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    fork_point_id: Mapped[int] = mapped_column(
        ForeignKey("fork_points.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "fork_point_id", name="uq_user_memory_fork"),
        Index("ix_user_memories_user_id", "user_id"),
    )
