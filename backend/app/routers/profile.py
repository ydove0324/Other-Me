from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.user import User
from app.models.profile import (
    TagCategory, Tag, UserTag,
    QuestionnaireQuestion, QuestionnaireAnswer,
    UserPersona,
)
from app.schemas.common import ApiResponse
from app.schemas.profile import (
    SaveUserTagsRequest,
    SubmitAnswersRequest,
    SubmitQuizAnswersRequest,
    TagCategoryResponse,
    TagResponse,
    QuestionResponse,
    PersonaResponse,
    UserProfileResponse,
)
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.get("/tags", response_model=ApiResponse)
async def get_tags(session: Annotated[AsyncSession, Depends(get_session)]):
    result = await session.execute(
        select(TagCategory)
        .options(selectinload(TagCategory.tags))
        .order_by(TagCategory.sort_order)
    )
    categories = result.scalars().all()

    data = []
    for cat in categories:
        sorted_tags = sorted(cat.tags, key=lambda t: t.sort_order)
        data.append(TagCategoryResponse(
            id=cat.id,
            name=cat.name,
            display_name=cat.display_name,
            description=cat.description,
            sort_order=cat.sort_order,
            tags=[TagResponse(id=t.id, name=t.name, display_name=t.display_name, description=t.description) for t in sorted_tags],
        ).model_dump())

    return ApiResponse(data=data)


@router.post("/tags", response_model=ApiResponse)
async def save_user_tags(
    body: SaveUserTagsRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await session.execute(delete(UserTag).where(UserTag.user_id == user.id))

    for tag_id in body.tag_ids:
        session.add(UserTag(user_id=user.id, tag_id=tag_id))

    await session.commit()
    return ApiResponse(message="标签已保存")


@router.get("/my-tags", response_model=ApiResponse)
async def get_my_tags(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(Tag)
        .join(UserTag, UserTag.tag_id == Tag.id)
        .where(UserTag.user_id == user.id)
    )
    tags = result.scalars().all()
    return ApiResponse(data=[TagResponse(id=t.id, name=t.name, display_name=t.display_name, description=t.description).model_dump() for t in tags])


@router.get("/questions", response_model=ApiResponse)
async def get_questions(session: Annotated[AsyncSession, Depends(get_session)]):
    result = await session.execute(
        select(QuestionnaireQuestion)
        .where(QuestionnaireQuestion.is_active == True)  # noqa: E712
        .order_by(QuestionnaireQuestion.sort_order)
    )
    questions = result.scalars().all()

    return ApiResponse(data=[
        QuestionResponse(
            id=q.id,
            question_text=q.question_text,
            question_type=q.question_type.value,
            options=q.options,
            category=q.category,
            sort_order=q.sort_order,
        ).model_dump()
        for q in questions
    ])


@router.post("/answers", response_model=ApiResponse)
async def submit_answers(
    body: SubmitAnswersRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    for ans in body.answers:
        result = await session.execute(
            select(QuestionnaireAnswer).where(
                QuestionnaireAnswer.user_id == user.id,
                QuestionnaireAnswer.question_id == ans.question_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.answer_text = ans.answer_text
            existing.answer_data = ans.answer_data
        else:
            session.add(QuestionnaireAnswer(
                user_id=user.id,
                question_id=ans.question_id,
                answer_text=ans.answer_text,
                answer_data=ans.answer_data,
            ))

    await session.commit()
    return ApiResponse(message="答案已保存")


@router.post("/quiz-answers", response_model=ApiResponse)
async def submit_quiz_answers(
    body: SubmitQuizAnswersRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Submit quiz answers and generate persona in one step."""
    from app.services.ai.pipeline import generate_persona as gen_persona
    persona = await gen_persona(user.id, session, quiz_answers=body.answers)
    return ApiResponse(data=PersonaResponse(
        id=persona.id,
        persona_summary=persona.persona_summary,
        personality_traits=persona.personality_traits,
        values=persona.values,
        life_context=persona.life_context,
        version=persona.version,
    ).model_dump())


@router.post("/persona/generate", response_model=ApiResponse)
async def generate_persona(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.services.ai.pipeline import generate_persona
    persona = await generate_persona(user.id, session)
    return ApiResponse(data=PersonaResponse(
        id=persona.id,
        persona_summary=persona.persona_summary,
        personality_traits=persona.personality_traits,
        values=persona.values,
        life_context=persona.life_context,
        version=persona.version,
    ).model_dump())


@router.get("/persona", response_model=ApiResponse)
async def get_persona(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(UserPersona)
        .where(UserPersona.user_id == user.id)
        .order_by(UserPersona.version.desc())
        .limit(1)
    )
    persona = result.scalar_one_or_none()
    if not persona:
        return ApiResponse(data=None)

    return ApiResponse(data=PersonaResponse(
        id=persona.id,
        persona_summary=persona.persona_summary,
        personality_traits=persona.personality_traits,
        values=persona.values,
        life_context=persona.life_context,
        version=persona.version,
    ).model_dump())


@router.delete("/persona", response_model=ApiResponse)
async def reset_persona(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Delete all UserPersona records for the current user (used by redo flow)."""
    await session.execute(
        delete(UserPersona).where(UserPersona.user_id == user.id)
    )
    await session.commit()
    return ApiResponse(message="画像已清除")


@router.patch("/display-name", response_model=ApiResponse)
async def update_display_name(
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Update user display name."""
    display_name = body.get("display_name", "").strip()
    if display_name:
        user.display_name = display_name
        await session.commit()
    return ApiResponse(message="昵称已更新")


@router.post("/complete-onboarding", response_model=ApiResponse)
async def complete_onboarding(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    user.onboarding_completed = True
    await session.commit()
    return ApiResponse(message="Onboarding 已完成")


@router.get("/summary", response_model=ApiResponse)
async def get_profile_summary(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(Tag).join(UserTag, UserTag.tag_id == Tag.id).where(UserTag.user_id == user.id)
    )
    tags = result.scalars().all()

    result = await session.execute(
        select(UserPersona).where(UserPersona.user_id == user.id).order_by(UserPersona.version.desc()).limit(1)
    )
    persona = result.scalar_one_or_none()

    data = UserProfileResponse(
        user_id=user.id,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        onboarding_completed=user.onboarding_completed,
        selected_tags=[TagResponse(id=t.id, name=t.name, display_name=t.display_name, description=t.description) for t in tags],
        persona=PersonaResponse(
            id=persona.id,
            persona_summary=persona.persona_summary,
            personality_traits=persona.personality_traits,
            values=persona.values,
            life_context=persona.life_context,
            version=persona.version,
        ) if persona else None,
    )
    return ApiResponse(data=data.model_dump())
