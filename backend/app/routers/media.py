from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import async_session_factory, get_session
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/api/v1/media", tags=["media"])
logger = logging.getLogger(__name__)


@router.post("/upload-photo", response_model=ApiResponse)
async def upload_photo(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    use_as_avatar: bool = True,
    user: Annotated[User, Depends(get_current_user)] = ...,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    """Upload user photo to OSS and optionally kick off comic avatar generation."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只支持图片文件")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="图片大小不能超过 10MB")

    from app.services.oss_service import upload_bytes

    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower() or "jpg"
    object_key = f"user-photos/{user.id}/{uuid.uuid4().hex}.{ext}"

    try:
        photo_url = await upload_bytes(content, object_key, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"OSS upload failed: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="图片上传失败，请稍后重试")

    user.photo_url = photo_url
    if use_as_avatar:
        user.avatar_url = photo_url
    await session.commit()

    # Generate comic avatar in background (non-blocking)
    background_tasks.add_task(_generate_comic_avatar, user.id, photo_url)

    return ApiResponse(data={"photo_url": photo_url, "avatar_url": user.avatar_url})


async def _generate_comic_avatar(user_id: int, photo_url: str) -> None:
    """Background task: generate a comic-style avatar from the user's photo and save to OSS."""
    from app.services.image_gen_service import generate_image
    from app.services.oss_service import upload_from_url, new_key, sign_url

    try:
        # Generate a signed URL so the external image generation API can fetch the photo
        signed_photo_url = sign_url(photo_url, expires=3600)

        prompt = (
            "Convert the person in the photo into a beautifully illustrated storybook character. "
            "Preserve facial features. Warm, delicate illustration style with soft colors. "
            "Suitable for a life narrative story."
        )
        generated_url = await generate_image(prompt, reference_image_url=signed_photo_url)

        object_key = new_key(f"comic-avatars/{user_id}")
        oss_url = await upload_from_url(generated_url, object_key)

        async with async_session_factory() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.comic_avatar_url = oss_url
                await session.commit()
                logger.info(f"Comic avatar saved for user {user_id}: {oss_url}")

    except Exception as e:
        logger.error(f"Comic avatar generation failed for user {user_id}: {e}")


@router.get("/avatar-info", response_model=ApiResponse)
async def get_avatar_info(
    user: Annotated[User, Depends(get_current_user)],
):
    """Return the user's photo URL, avatar URL, and comic avatar URL (all signed)."""
    from app.services.oss_service import sign_url

    def _sign(url: str | None) -> str | None:
        if not url:
            return None
        try:
            return sign_url(url, expires=3600)
        except Exception:
            return None

    return ApiResponse(data={
        "photo_url": _sign(user.photo_url),
        "avatar_url": _sign(user.avatar_url),
        "comic_avatar_url": _sign(user.comic_avatar_url),
    })


@router.get("/sign-url", response_model=ApiResponse)
async def get_signed_url(
    url: str,
    user: Annotated[User, Depends(get_current_user)],
):
    """Return a signed URL for any OSS object. Frontend calls this to display images."""
    from app.services.oss_service import sign_url

    try:
        signed = sign_url(url, expires=3600)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"无法签名: {e}")

    return ApiResponse(data={"signed_url": signed})
