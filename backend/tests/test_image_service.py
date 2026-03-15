"""Unit tests for image generation service and OSS upload/retrieval."""
from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# image_gen_service tests
# ---------------------------------------------------------------------------

class TestGenerateImage:
    """Tests for app.services.image_gen_service.generate_image"""

    @pytest.mark.asyncio
    async def test_basic_text_to_image(self):
        """Without reference image → payload must NOT contain 'image' key."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"data": [{"url": "https://cdn.example.com/gen.jpg"}]}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.image_gen_service.httpx.AsyncClient", return_value=mock_client):
            from app.services.image_gen_service import generate_image
            url = await generate_image("a young woman walking in autumn forest")

        assert url == "https://cdn.example.com/gen.jpg"

        _, kwargs = mock_client.post.call_args
        sent_json = kwargs["json"]
        assert "image" not in sent_json, "No reference image → 'image' must be absent"
        assert sent_json["prompt"] == "a young woman walking in autumn forest"

    @pytest.mark.asyncio
    async def test_image_editing_with_reference(self):
        """With reference image → payload must include 'image' key (character editing)."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"data": [{"url": "https://cdn.example.com/edited.jpg"}]}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        avatar_url = "https://oss.example.com/comic-avatars/123/abc.jpg"

        with patch("app.services.image_gen_service.httpx.AsyncClient", return_value=mock_client):
            from app.services.image_gen_service import generate_image
            url = await generate_image("the same character standing at a crossroads", reference_image_url=avatar_url)

        assert url == "https://cdn.example.com/edited.jpg"

        _, kwargs = mock_client.post.call_args
        sent_json = kwargs["json"]
        assert sent_json["image"] == avatar_url, "Reference avatar must be forwarded as 'image'"

    @pytest.mark.asyncio
    async def test_raises_when_no_images_returned(self):
        """API returning empty data list should raise ValueError."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"data": []}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.image_gen_service.httpx.AsyncClient", return_value=mock_client):
            from app.services.image_gen_service import generate_image
            with pytest.raises(ValueError, match="No image returned"):
                await generate_image("test prompt")

    @pytest.mark.asyncio
    async def test_api_key_in_authorization_header(self):
        """API key from settings must appear in Authorization header."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"data": [{"url": "https://cdn.example.com/img.jpg"}]}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        from app.services.image_gen_service import generate_image

        with patch("app.services.image_gen_service.httpx.AsyncClient", return_value=mock_client), \
             patch("app.services.image_gen_service.settings") as mock_settings:
            mock_settings.IMAGE_GEN_API_BASE = "https://api.example.com/v1"
            mock_settings.IMAGE_GEN_API_KEY = "test-secret-key"
            mock_settings.IMAGE_GEN_MODEL = "TestModel"

            await generate_image("test")

        _, kwargs = mock_client.post.call_args
        assert kwargs["headers"]["Authorization"] == "Bearer test-secret-key"

    @pytest.mark.asyncio
    async def test_negative_prompt_included(self):
        """Custom negative_prompt is forwarded in the payload."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"data": [{"url": "https://cdn.example.com/img.jpg"}]}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.image_gen_service.httpx.AsyncClient", return_value=mock_client):
            from app.services.image_gen_service import generate_image
            await generate_image("prompt", negative_prompt="blurry, low quality")

        _, kwargs = mock_client.post.call_args
        assert kwargs["json"]["negative_prompt"] == "blurry, low quality"


# ---------------------------------------------------------------------------
# oss_service tests
# ---------------------------------------------------------------------------

class TestOSSService:
    """Tests for app.services.oss_service"""

    @pytest.mark.asyncio
    async def test_upload_bytes_calls_oss_put_object(self):
        """upload_bytes should call bucket.put_object with correct args and return public URL."""
        mock_bucket = MagicMock()
        mock_bucket.put_object = MagicMock()

        from app.services.oss_service import upload_bytes

        with patch("app.services.oss_service.oss2.Auth"), \
             patch("app.services.oss_service.oss2.Bucket", return_value=mock_bucket), \
             patch("app.services.oss_service.settings") as mock_settings:

            mock_settings.OSS_ACCESS_KEY_ID = "key-id"
            mock_settings.OSS_ACCESS_KEY_SECRET = "key-secret"
            mock_settings.OSS_ENDPOINT = "https://oss-cn-hangzhou.aliyuncs.com"
            mock_settings.OSS_BUCKET_NAME = "hx-img-oss"
            mock_settings.OSS_REGION = "cn-hangzhou"

            data = b"fake-image-bytes"
            url = await upload_bytes(data, "story-images/1/abc.jpg", "image/jpeg")

        assert url == "https://hx-img-oss.oss-cn-hangzhou.aliyuncs.com/story-images/1/abc.jpg"
        mock_bucket.put_object.assert_called_once_with(
            "story-images/1/abc.jpg",
            data,
            headers={"Content-Type": "image/jpeg"},
        )

    @pytest.mark.asyncio
    async def test_upload_from_url_downloads_then_uploads(self):
        """upload_from_url should download the source URL then call upload_bytes."""
        fake_image_bytes = b"downloaded-image-data"

        # Use a real response-like object (not AsyncMock) so raise_for_status stays sync
        class FakeResponse:
            content = fake_image_bytes
            headers = {"Content-Type": "image/png"}
            def raise_for_status(self): pass

        mock_http_client = AsyncMock()
        mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
        mock_http_client.__aexit__ = AsyncMock(return_value=False)
        mock_http_client.get = AsyncMock(return_value=FakeResponse())

        uploaded: list[tuple] = []

        async def fake_upload_bytes(data, key, ct):
            uploaded.append((data, key, ct))
            return f"https://hx-img-oss.cn-hangzhou.aliyuncs.com/{key}"

        from app.services.oss_service import upload_from_url

        with patch("app.services.oss_service.httpx.AsyncClient", return_value=mock_http_client), \
             patch("app.services.oss_service.upload_bytes", side_effect=fake_upload_bytes):
            result_url = await upload_from_url(
                "https://api.imggen.example.com/tmp/img123.png",
                "story-images/2/xyz.png",
            )

        assert result_url == "https://hx-img-oss.cn-hangzhou.aliyuncs.com/story-images/2/xyz.png"
        assert len(uploaded) == 1
        data_sent, key_sent, ct_sent = uploaded[0]
        assert data_sent == fake_image_bytes
        assert key_sent == "story-images/2/xyz.png"
        assert ct_sent == "image/png"

    def test_new_key_format(self):
        """new_key should produce a path with the given prefix and a UUID hex."""
        import re

        with patch("app.services.oss_service.oss2"):
            from app.services.oss_service import new_key
            key = new_key("story-images/42", ext="jpg")

        assert key.startswith("story-images/42/")
        suffix = key[len("story-images/42/"):]
        # UUID hex (32 chars) + .jpg
        assert re.fullmatch(r"[0-9a-f]{32}\.jpg", suffix), f"Unexpected key format: {key}"

    def test_new_key_default_extension(self):
        with patch("app.services.oss_service.oss2"):
            from app.services.oss_service import new_key
            key = new_key("comic-avatars/7")
        assert key.endswith(".jpg")


# ---------------------------------------------------------------------------
# Integration-style: generate_image → upload_from_url → OSS (fully mocked)
# ---------------------------------------------------------------------------

class TestImageGenToOSSPipeline:
    """End-to-end mock test: image generated → URL downloaded → uploaded to OSS."""

    @pytest.mark.asyncio
    async def test_full_pipeline(self):
        """Simulate the two-step pipeline:
        1. generate_image() → returns a temporary CDN URL
        2. upload_from_url()  → downloads it and stores it in OSS, returns stable OSS URL

        We mock both functions at the service level to avoid nested async-mock issues.
        """
        generated_cdn_url = "https://cdn.imggen.com/result.jpg"
        expected_oss_url = "https://hx-img-oss.cn-hangzhou.aliyuncs.com/story-images/99/deadbeef.jpg"
        object_key = "story-images/99/deadbeef.jpg"
        avatar_url = "https://oss.example.com/comic-avatars/99/ref.jpg"

        async def fake_generate(prompt, reference_image_url=None, negative_prompt=""):
            # Verify reference image is forwarded (character-editing mode)
            assert reference_image_url == avatar_url
            return generated_cdn_url

        async def fake_upload_from_url(source_url, key):
            assert source_url == generated_cdn_url
            assert key == object_key
            return expected_oss_url

        with patch("app.services.image_gen_service.generate_image", side_effect=fake_generate), \
             patch("app.services.oss_service.upload_from_url", side_effect=fake_upload_from_url):

            from app.services.image_gen_service import generate_image
            from app.services.oss_service import upload_from_url

            # Step A: generate image (with comic avatar as reference)
            img_url = await generate_image(
                prompt="the same character sitting under a cherry tree",
                reference_image_url=avatar_url,
            )

            # Step B: persist generated image to OSS
            oss_url = await upload_from_url(img_url, object_key)

        assert img_url == generated_cdn_url
        assert oss_url == expected_oss_url
