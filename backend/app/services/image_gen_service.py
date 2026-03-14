from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def generate_image(
    prompt: str,
    reference_image_url: str | None = None,
    negative_prompt: str = "模糊，低质量，变形，丑陋",
) -> str:
    """Call the image generation API and return the generated image URL.

    Args:
        prompt: Text description of the image to generate.
        reference_image_url: Optional URL of a reference image (for style/character consistency).
        negative_prompt: What to avoid in the image.

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
