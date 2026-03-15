from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.user import User
from app.models.fork_point import ForkPoint
from app.models.life import AlternativeLife, LifeTimelineEvent, LifeScene
from app.models.memory import UserMemory
from app.models.base import ForkPointStatus, LifeStatus
from app.schemas.common import ApiResponse
from app.schemas.life import (
    AlternativeLifeResponse, TimelineEventResponse, StoryResponse, SceneResponse,
    LifeBlocksResponse, StoryQuestion, StoryQuestionsResponse, GenerateLifeStreamRequest,
    MemoryPreviewResponse,
)
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/v1", tags=["lives"])


def _build_memory_content(fp: ForkPoint, user_answers: list[dict] | None) -> str:
    """Build purely factual memory content from fork point + user answers. No LLM, no invention."""
    lines = []
    lines.append(f"分岔点：{fp.title}")
    if fp.description:
        lines.append(f"背景：{fp.description}")
    if fp.happened_at:
        lines.append(f"时间：{fp.happened_at}")
    lines.append(f"实际选择：{fp.actual_choice}")
    lines.append(f"另一条路：{fp.alternative_choice}")
    if fp.emotional_context and isinstance(fp.emotional_context, dict):
        parts = [f"{k}：{v}" for k, v in fp.emotional_context.items() if v]
        if parts:
            lines.append("当时感受：" + "；".join(parts))
    elif fp.emotional_context and isinstance(fp.emotional_context, str):
        lines.append(f"当时感受：{fp.emotional_context}")
    if user_answers:
        qa = [f"{a.get('question', '')}：{a.get('answer', '')}" for a in user_answers]
        lines.append("对故事的期望：")
        lines.extend(f"  - {x}" for x in qa if x.strip())
    return "\n".join(lines)


@router.post("/fork-points/{fork_point_id}/generate", response_model=ApiResponse)
async def generate_life(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    if fp.status == ForkPointStatus.generating:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="正在生成中，请稍候")

    from app.services.ai.pipeline import generate_alternative_life
    life = await generate_alternative_life(user.id, fork_point_id, session)

    return ApiResponse(data=AlternativeLifeResponse(
        id=life.id,
        fork_point_id=life.fork_point_id,
        overview=life.overview,
        status=life.status.value,
        created_at=life.created_at,
        events=[
            TimelineEventResponse(
                id=e.id,
                event_date=e.event_date,
                title=e.title,
                summary=e.summary,
                detailed_narrative=e.detailed_narrative,
                emotional_tone=e.emotional_tone,
                sort_order=e.sort_order,
            )
            for e in life.events
        ],
    ).model_dump(mode="json"))


@router.get("/fork-points/{fork_point_id}/life", response_model=ApiResponse)
async def get_life(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    result = await session.execute(
        select(AlternativeLife)
        .where(
            AlternativeLife.fork_point_id == fork_point_id,
            AlternativeLife.content_type == "timeline",
        )
        .options(selectinload(AlternativeLife.events))
        .order_by(AlternativeLife.created_at.desc())
        .limit(1)
    )
    life = result.scalar_one_or_none()
    if not life:
        return ApiResponse(data=None, message="尚未生成平行人生")

    return ApiResponse(data=AlternativeLifeResponse(
        id=life.id,
        fork_point_id=life.fork_point_id,
        overview=life.overview,
        status=life.status.value,
        created_at=life.created_at,
        events=[
            TimelineEventResponse(
                id=e.id,
                event_date=e.event_date,
                title=e.title,
                summary=e.summary,
                detailed_narrative=e.detailed_narrative,
                emotional_tone=e.emotional_tone,
                sort_order=e.sort_order,
            )
            for e in sorted(life.events, key=lambda e: e.sort_order)
        ],
    ).model_dump(mode="json"))


@router.get("/lives/{life_id}/events/{event_id}", response_model=ApiResponse)
async def get_event_detail(
    life_id: int,
    event_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(AlternativeLife).where(AlternativeLife.id == life_id, AlternativeLife.user_id == user.id)
    )
    life = result.scalar_one_or_none()
    if not life:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="平行人生不存在")

    result = await session.execute(
        select(LifeTimelineEvent).where(
            LifeTimelineEvent.id == event_id,
            LifeTimelineEvent.alternative_life_id == life_id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件不存在")

    if not event.detailed_narrative:
        from app.services.ai.pipeline import generate_event_detail
        event = await generate_event_detail(life_id, event_id, session)

    return ApiResponse(data=TimelineEventResponse(
        id=event.id,
        event_date=event.event_date,
        title=event.title,
        summary=event.summary,
        detailed_narrative=event.detailed_narrative,
        emotional_tone=event.emotional_tone,
        sort_order=event.sort_order,
    ).model_dump(mode="json"))


@router.post("/fork-points/{fork_point_id}/generate-story", response_model=ApiResponse)
async def generate_story(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Generate a Markdown story for a fork point."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    if fp.status == ForkPointStatus.generating:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="正在生成中，请稍候")

    from app.services.ai.pipeline import generate_story as gen_story
    life = await gen_story(user.id, fork_point_id, session)

    return ApiResponse(data=StoryResponse(
        id=life.id,
        fork_point_id=life.fork_point_id,
        story_title=life.story_title,
        story_markdown=life.story_markdown,
        status=life.status.value,
        content_type=life.content_type,
        created_at=life.created_at,
    ).model_dump(mode="json"))


@router.post("/fork-points/{fork_point_id}/generate-story-stream")
async def generate_story_stream_endpoint(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """SSE endpoint: streams the story as it is generated, then saves to DB."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    if fp.status == ForkPointStatus.generating:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="正在生成中，请稍候")

    from app.services.ai.pipeline import generate_story_stream as gen_stream

    async def event_generator():
        try:
            async for chunk in gen_stream(user.id, fork_point_id, session):
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/fork-points/{fork_point_id}/story", response_model=ApiResponse)
async def get_story(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get the generated story for a fork point. Supports polling for status."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    result = await session.execute(
        select(AlternativeLife)
        .where(
            AlternativeLife.fork_point_id == fork_point_id,
            AlternativeLife.content_type == "story",
        )
        .options(selectinload(AlternativeLife.scenes))
        .order_by(AlternativeLife.created_at.desc())
        .limit(1)
    )
    life = result.scalar_one_or_none()
    if not life:
        return ApiResponse(data=None, message="尚未生成故事")

    from app.services.oss_service import sign_url

    def _sign(url: str | None) -> str | None:
        if not url:
            return None
        try:
            return sign_url(url, expires=3600)
        except Exception:
            return None

    return ApiResponse(data=StoryResponse(
        id=life.id,
        fork_point_id=life.fork_point_id,
        story_title=life.story_title,
        story_markdown=life.story_markdown,
        status=life.status.value,
        content_type=life.content_type,
        created_at=life.created_at,
        scenes=[
            SceneResponse(
                id=s.id,
                scene_type=s.scene_type,
                title=s.title,
                content=s.content,
                media_url=_sign(s.media_url),
                metadata=s.metadata_,
                sort_order=s.sort_order,
            )
            for s in sorted(life.scenes, key=lambda s: s.sort_order)
        ],
    ).model_dump(mode="json"))


@router.delete("/fork-points/{fork_point_id}/story", response_model=ApiResponse)
async def delete_story(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Delete generated story/blocks for a fork point. Fork point itself is kept."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    result = await session.execute(
        select(AlternativeLife).where(
            AlternativeLife.fork_point_id == fork_point_id,
            AlternativeLife.content_type.in_(["story", "blocks"]),
        )
    )
    lives = result.scalars().all()
    for life in lives:
        await session.delete(life)

    await session.commit()
    return ApiResponse(message="故事已删除")


@router.get("/fork-points/{fork_point_id}/story-questions", response_model=ApiResponse)
async def get_story_questions(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Generate personalized story questions for a fork point."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    from app.services.ai.pipeline import generate_story_questions
    questions = await generate_story_questions(user.id, fork_point_id, session)

    return ApiResponse(data=StoryQuestionsResponse(
        questions=[
            StoryQuestion(
                id=q.get("id", f"q{i+1}"),
                question=q.get("question", ""),
                hint=q.get("hint"),
                options=q.get("options", []),
            )
            for i, q in enumerate(questions)
        ]
    ).model_dump(mode="json"))


@router.post("/fork-points/{fork_point_id}/generate-life-stream")
async def generate_life_stream_endpoint(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request: GenerateLifeStreamRequest | None = None,
):
    """SSE endpoint: streams life blocks as they are generated."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    # If a previous stream was aborted mid-flight (client disconnected),
    # fp.status can be stuck as 'generating' because CancelledError bypasses
    # except-Exception blocks. Reset it so the user can regenerate.
    if fp.status == ForkPointStatus.generating:
        fp.status = ForkPointStatus.failed
        await session.flush()

    from app.services.ai.pipeline import generate_life_blocks_stream
    user_answers = request.answers if request else None

    async def event_generator():
        try:
            async for event in generate_life_blocks_stream(user.id, fork_point_id, session, user_answers=user_answers):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except BaseException as e:
            # Catch CancelledError (client disconnect) and other exceptions
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/fork-points/{fork_point_id}/blocks", response_model=ApiResponse)
async def get_life_blocks(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get generated life blocks for a fork point."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    result = await session.execute(
        select(AlternativeLife)
        .where(
            AlternativeLife.fork_point_id == fork_point_id,
            AlternativeLife.content_type == "blocks",
        )
        .options(selectinload(AlternativeLife.scenes))
        .order_by(AlternativeLife.created_at.desc())
        .limit(1)
    )
    life = result.scalar_one_or_none()
    if not life:
        return ApiResponse(data=None, message="尚未生成")

    from app.services.oss_service import sign_url

    def _sign(url: str | None) -> str | None:
        if not url:
            return None
        try:
            return sign_url(url, expires=3600)
        except Exception:
            return None

    return ApiResponse(data=LifeBlocksResponse(
        id=life.id,
        fork_point_id=life.fork_point_id,
        overview=life.overview,
        status=life.status.value,
        content_type=life.content_type,
        created_at=life.created_at,
        blocks=[
            SceneResponse(
                id=s.id,
                scene_type=s.scene_type,
                title=s.title,
                content=s.content,
                media_url=_sign(s.media_url),
                metadata=s.metadata_,
                sort_order=s.sort_order,
            )
            for s in sorted(life.scenes, key=lambda s: s.sort_order)
        ],
    ).model_dump(mode="json"))


@router.get("/fork-points/{fork_point_id}/memory-preview", response_model=ApiResponse)
async def get_memory_preview(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get the condensed factual summary to show before adding to memory. No invention."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    # Check if already in memory
    mem_result = await session.execute(
        select(UserMemory).where(
            UserMemory.user_id == user.id,
            UserMemory.fork_point_id == fork_point_id,
        )
    )
    existing = mem_result.scalar_one_or_none()
    if existing:
        return ApiResponse(data=MemoryPreviewResponse(
            content=existing.content,
            already_added=True,
        ).model_dump(mode="json"))

    # Load latest blocks life to get user_answers
    user_answers = None
    life_result = await session.execute(
        select(AlternativeLife)
        .where(
            AlternativeLife.fork_point_id == fork_point_id,
            AlternativeLife.content_type == "blocks",
            AlternativeLife.status == LifeStatus.completed,
        )
        .order_by(AlternativeLife.created_at.desc())
        .limit(1)
    )
    life = life_result.scalar_one_or_none()
    if life and life.generation_metadata:
        user_answers = life.generation_metadata.get("user_answers")

    content = _build_memory_content(fp, user_answers)
    return ApiResponse(data=MemoryPreviewResponse(
        content=content,
        already_added=False,
    ).model_dump(mode="json"))


@router.post("/fork-points/{fork_point_id}/memories", response_model=ApiResponse)
async def add_to_memory(
    fork_point_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Add fork point info + story choices to user's memory for future story generation."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    # Check if already added
    mem_result = await session.execute(
        select(UserMemory).where(
            UserMemory.user_id == user.id,
            UserMemory.fork_point_id == fork_point_id,
        )
    )
    if mem_result.scalar_one_or_none():
        return ApiResponse(data={"added": True, "message": "已加入"}, message="已在记忆库中")

    # Load user_answers from latest blocks
    user_answers = None
    life_result = await session.execute(
        select(AlternativeLife)
        .where(
            AlternativeLife.fork_point_id == fork_point_id,
            AlternativeLife.content_type == "blocks",
            AlternativeLife.status == LifeStatus.completed,
        )
        .order_by(AlternativeLife.created_at.desc())
        .limit(1)
    )
    life = life_result.scalar_one_or_none()
    if life and life.generation_metadata:
        user_answers = life.generation_metadata.get("user_answers")

    content = _build_memory_content(fp, user_answers)
    mem = UserMemory(user_id=user.id, fork_point_id=fork_point_id, content=content)
    session.add(mem)
    await session.commit()
    return ApiResponse(data={"added": True, "message": "已加入"}, message="已加入记忆库")
