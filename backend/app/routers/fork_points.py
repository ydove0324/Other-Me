from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.user import User
from app.models.fork_point import ForkPoint
from app.models.life import AlternativeLife
from app.models.base import ForkPointStatus, LifeStatus
from app.schemas.common import ApiResponse
from app.schemas.fork_point import (
    CreateForkPointRequest,
    ForkPointResponse,
    UpdateForkPointRequest,
)
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/v1/fork-points", tags=["fork-points"])


@router.post("", response_model=ApiResponse)
async def create_fork_point(
    body: CreateForkPointRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    fp = ForkPoint(
        user_id=user.id,
        title=body.title,
        description=body.description,
        happened_at=body.happened_at,
        actual_choice=body.actual_choice,
        alternative_choice=body.alternative_choice,
        emotional_context=body.emotional_context,
        status=ForkPointStatus.draft,
    )
    session.add(fp)
    await session.commit()
    await session.refresh(fp)

    return ApiResponse(data=ForkPointResponse(
        id=fp.id,
        title=fp.title,
        description=fp.description,
        happened_at=fp.happened_at,
        actual_choice=fp.actual_choice,
        alternative_choice=fp.alternative_choice,
        emotional_context=fp.emotional_context,
        status=fp.status.value,
        created_at=fp.created_at,
    ).model_dump(mode="json"))


@router.get("", response_model=ApiResponse)
async def list_fork_points(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(ForkPoint)
        .where(ForkPoint.user_id == user.id)
        .order_by(ForkPoint.created_at.desc())
    )
    fps = result.scalars().all()

    # Fetch completed lives in one query to determine has_timeline / has_story
    fp_ids = [fp.id for fp in fps]
    lives_map: dict[int, set[str]] = {fp.id: set() for fp in fps}
    if fp_ids:
        lives_result = await session.execute(
            select(AlternativeLife.fork_point_id, AlternativeLife.content_type)
            .where(
                AlternativeLife.fork_point_id.in_(fp_ids),
                AlternativeLife.status == LifeStatus.completed,
            )
        )
        for fork_point_id, content_type in lives_result.all():
            lives_map[fork_point_id].add(content_type or "timeline")

    return ApiResponse(data=[
        ForkPointResponse(
            id=fp.id,
            title=fp.title,
            description=fp.description,
            happened_at=fp.happened_at,
            actual_choice=fp.actual_choice,
            alternative_choice=fp.alternative_choice,
            emotional_context=fp.emotional_context,
            status=fp.status.value,
            created_at=fp.created_at,
            has_timeline="timeline" in lives_map[fp.id],
            has_story="story" in lives_map[fp.id],
        ).model_dump(mode="json")
        for fp in fps
    ])


@router.get("/{fork_point_id}", response_model=ApiResponse)
async def get_fork_point(
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

    return ApiResponse(data=ForkPointResponse(
        id=fp.id,
        title=fp.title,
        description=fp.description,
        happened_at=fp.happened_at,
        actual_choice=fp.actual_choice,
        alternative_choice=fp.alternative_choice,
        emotional_context=fp.emotional_context,
        status=fp.status.value,
        created_at=fp.created_at,
    ).model_dump(mode="json"))


@router.put("/{fork_point_id}", response_model=ApiResponse)
async def update_fork_point(
    fork_point_id: int,
    body: UpdateForkPointRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id, ForkPoint.user_id == user.id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分岔点不存在")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(fp, field, value)

    await session.commit()
    await session.refresh(fp)

    return ApiResponse(data=ForkPointResponse(
        id=fp.id,
        title=fp.title,
        description=fp.description,
        happened_at=fp.happened_at,
        actual_choice=fp.actual_choice,
        alternative_choice=fp.alternative_choice,
        emotional_context=fp.emotional_context,
        status=fp.status.value,
        created_at=fp.created_at,
    ).model_dump(mode="json"))


@router.delete("/{fork_point_id}", response_model=ApiResponse)
async def delete_fork_point(
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

    await session.delete(fp)
    await session.commit()
    return ApiResponse(message="分岔点已删除")
