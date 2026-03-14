from __future__ import annotations

import asyncio
import logging
import uuid
from functools import partial
from urllib.parse import urlparse

import httpx
import oss2
from oss2.credentials import StaticCredentialsProvider

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_bucket() -> oss2.Bucket:
    """Create an OSS Bucket client using V4 auth (as required by the bucket)."""
    auth = oss2.ProviderAuthV4(
        StaticCredentialsProvider(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
    )
    return oss2.Bucket(
        auth,
        settings.OSS_ENDPOINT,
        settings.OSS_BUCKET_NAME,
        region=settings.OSS_REGION,
    )


def _public_url(object_key: str) -> str:
    """Build the canonical OSS URL for a given object key (not signed, not publicly readable)."""
    endpoint_host = urlparse(settings.OSS_ENDPOINT).netloc
    return f"https://{settings.OSS_BUCKET_NAME}.{endpoint_host}/{object_key}"


def _upload_sync(data: bytes, object_key: str, content_type: str) -> str:
    bucket = _get_bucket()
    bucket.put_object(object_key, data, headers={"Content-Type": content_type})
    return _public_url(object_key)


async def upload_bytes(data: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
    """Upload raw bytes to OSS and return the stored URL (unsigned)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_upload_sync, data, object_key, content_type))


async def upload_from_url(source_url: str, object_key: str) -> str:
    """Download image from URL and re-upload to OSS, return the stored URL (unsigned)."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(source_url)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
        return await upload_bytes(resp.content, object_key, content_type)


def new_key(prefix: str, ext: str = "jpg") -> str:
    """Generate a unique OSS object key under the given prefix."""
    return f"{prefix}/{uuid.uuid4().hex}.{ext}"


def object_key_from_url(url: str) -> str:
    """Extract the OSS object key from a stored URL."""
    path = urlparse(url).path
    return path.lstrip("/")


def _get_bucket_v1() -> oss2.Bucket:
    """V1 auth bucket — used for generating signed GET URLs (V4 sign_url has HEAD issues)."""
    auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)


def sign_url(url: str, expires: int = 3600) -> str:
    """Given a stored OSS URL, return a signed GET URL that anyone can access.

    Bucket is private, so both external APIs (image gen) and the frontend
    need signed URLs to read images.

    Args:
        url: The plain OSS URL as stored in the database.
        expires: Signature validity in seconds (default 1 hour).
    """
    key = object_key_from_url(url)
    bucket = _get_bucket_v1()
    return bucket.sign_url("GET", key, expires, slash_safe=True)
