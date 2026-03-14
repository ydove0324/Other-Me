from __future__ import annotations

from typing import Any, Union

from pydantic import BaseModel


class TagCategoryResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: str | None = None
    sort_order: int
    tags: list[TagResponse] = []


class TagResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: str | None = None


class SaveUserTagsRequest(BaseModel):
    tag_ids: list[int]


class QuestionResponse(BaseModel):
    id: int
    question_text: str
    question_type: str
    options: dict | None = None
    category: str
    sort_order: int


class SubmitAnswerRequest(BaseModel):
    question_id: int
    answer_text: str | None = None
    answer_data: dict | None = None


class SubmitAnswersRequest(BaseModel):
    answers: list[SubmitAnswerRequest]


class SubmitQuizAnswersRequest(BaseModel):
    answers: dict[str, str | list[str]]


class PersonaResponse(BaseModel):
    id: int
    persona_summary: str | None = None
    personality_traits: Union[list, dict, None] = None
    values: Union[list, dict, None] = None
    life_context: Union[list, dict, None] = None
    version: int


class UserProfileResponse(BaseModel):
    user_id: int
    display_name: str
    email: str
    avatar_url: str | None = None
    onboarding_completed: bool
    selected_tags: list[TagResponse] = []
    persona: PersonaResponse | None = None


# Needed for forward reference resolution
TagCategoryResponse.model_rebuild()
