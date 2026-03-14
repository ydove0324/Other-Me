from __future__ import annotations

import asyncio
import logging
import uuid
from functools import partial

import httpx
import oss2

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_bucket() -> oss2.Bucket:
    auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)


def _public_url(object_key: str) -> str:
    return f"https://{settings.OSS_BUCKET_NAME}.{settings.OSS_REGION}.aliyuncs.com/{object_key}"


def _upload_sync(data: bytes, object_key: str, content_type: str) -> str:
    bucket = _get_bucket()
    bucket.put_object(object_key, data, headers={"Content-Type": content_type})
    return _public_url(object_key)


async def upload_bytes(data: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
    """Upload raw bytes to OSS and return the public URL."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_upload_sync, data, object_key, content_type))


async def upload_from_url(source_url: str, object_key: str) -> str:
    """Download image from URL and re-upload to OSS, return public URL."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(source_url)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
        return await upload_bytes(resp.content, object_key, content_type)


def new_key(prefix: str, ext: str = "jpg") -> str:
    """Generate a unique OSS object key under the given prefix."""
    return f"{prefix}/{uuid.uuid4().hex}.{ext}"
