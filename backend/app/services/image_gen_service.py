from __future__ import annotations

import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def generate_image(
    prompt: str,
    reference_image_url: str | None = None,
    negative_prompt: str = "模糊，低质量，变形，丑陋",
    max_retries: int = 2,
) -> str:
    """Call the image generation API and return the generated image URL.

    Retries up to max_retries times on failure (network errors, 5xx, empty response).

    Args:
        prompt: Text description of the image to generate.
        reference_image_url: Optional URL of a reference image (for style/character consistency).
        negative_prompt: What to avoid in the image.
        max_retries: Number of retry attempts after the first failure.

    Returns:
        URL of the generated image (from the API, not yet uploaded to OSS).
    """
    payload: dict = {
        "model": settings.IMAGE_GEN_MODEL,
        "prompt": prompt,
        "negative_prompt": negative_prompt,
    }
    if reference_image_url:
        payload["image"] = reference_image_url

    last_error: Exception | None = None

    for attempt in range(1 + max_retries):
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{settings.IMAGE_GEN_API_BASE}/images/generations",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {settings.IMAGE_GEN_API_KEY}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            images = data.get("data", [])
            if not images:
                raise ValueError(f"No image returned from API: {data}")
            return images[0]["url"]

        except Exception as e:
            last_error = e
            logger.warning(
                f"Image generation failed (attempt {attempt + 1}/{1 + max_retries}): {e}"
            )
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)  # 1s, 2s backoff

    raise last_error  # type: ignore[misc]
