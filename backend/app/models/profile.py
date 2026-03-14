from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    String, Text, Integer, Boolean, ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, QuestionType


class TagCategory(Base, TimestampMixin):
    __tablename__ = "tag_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    tags: Mapped[list[Tag]] = relationship(back_populates="category", cascade="all, delete-orphan")


class Tag(Base, TimestampMixin):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("tag_categories.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    category: Mapped[TagCategory] = relationship(back_populates="tags")

    __table_args__ = (
        UniqueConstraint("category_id", "name", name="uq_tag_category_name"),
        Index("ix_tags_category_id", "category_id"),
    )


class UserTag(Base, TimestampMixin):
    __tablename__ = "user_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "tag_id", name="uq_user_tag"),
        Index("ix_user_tags_user_id", "user_id"),
    )


class QuestionnaireQuestion(Base, TimestampMixin):
    __tablename__ = "questionnaire_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(nullable=False)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)


class QuestionnaireAnswer(Base, TimestampMixin):
    __tablename__ = "questionnaire_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("questionnaire_questions.id", ondelete="CASCADE"), nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_question_answer"),
        Index("ix_questionnaire_answers_user_id", "user_id"),
    )


class UserPersona(Base, TimestampMixin):
    __tablename__ = "user_personas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    persona_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    personality_traits: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    values: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    life_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    raw_input_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (Index("ix_user_personas_user_id", "user_id"),)
