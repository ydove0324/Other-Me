from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_token,
)
from app.models.base import OAuthProvider
from app.models.user import OAuthAccount, RefreshToken, User


# ===================================================================
# POST /api/v1/auth/refresh  (6 tests)
# ===================================================================


class TestRefresh:
    async def test_refresh_happy_path(self, client, test_user_with_refresh_token):
        user, raw_token = test_user_with_refresh_token
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": raw_token})
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "access_token" in body["data"]
        assert "refresh_token" in body["data"]
        assert body["data"]["token_type"] == "bearer"

    async def test_refresh_revoked_token(self, client, db_session: AsyncSession, test_user: User):
        raw_token = generate_refresh_token()
        rt = RefreshToken(
            user_id=test_user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            is_revoked=True,
        )
        db_session.add(rt)
        await db_session.commit()

        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": raw_token})
        assert resp.status_code == 401

    async def test_refresh_expired_token(self, client, db_session: AsyncSession, test_user: User):
        raw_token = generate_refresh_token()
        rt = RefreshToken(
            user_id=test_user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        db_session.add(rt)
        await db_session.commit()

        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": raw_token})
        assert resp.status_code == 401

    async def test_refresh_invalid_token(self, client, test_user_with_refresh_token):
        _user, _raw = test_user_with_refresh_token
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "wrong-token"})
        assert resp.status_code == 401

    async def test_refresh_missing_body(self, client):
        resp = await client.post("/api/v1/auth/refresh", content=b"")
        assert resp.status_code == 422

    async def test_refresh_user_deleted(self, client, db_session: AsyncSession):
        # Create a user, add token, then delete user
        user = User(email="ghost@example.com", display_name="Ghost")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        raw_token = generate_refresh_token()
        rt = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db_session.add(rt)
        await db_session.commit()

        # Delete the user but keep the token
        await db_session.delete(user)
        await db_session.commit()

        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": raw_token})
        assert resp.status_code == 401


# ===================================================================
# POST /api/v1/auth/logout  (4 tests)
# ===================================================================


class TestLogout:
    async def test_logout_happy_path(self, client, db_session: AsyncSession, test_user_with_refresh_token):
        user, raw_token = test_user_with_refresh_token
        resp = await client.post("/api/v1/auth/logout", json={"refresh_token": raw_token})
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

        # Verify DB state
        result = await db_session.execute(
            select(RefreshToken).where(RefreshToken.user_id == user.id)
        )
        rt = result.scalar_one()
        assert rt.is_revoked is True

    async def test_logout_invalid_token(self, client):
        resp = await client.post("/api/v1/auth/logout", json={"refresh_token": "nonexistent-token"})
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

    async def test_logout_already_revoked(self, client, db_session: AsyncSession, test_user: User):
        raw_token = generate_refresh_token()
        rt = RefreshToken(
            user_id=test_user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            is_revoked=True,
        )
        db_session.add(rt)
        await db_session.commit()

        resp = await client.post("/api/v1/auth/logout", json={"refresh_token": raw_token})
        assert resp.status_code == 200

    async def test_logout_missing_body(self, client):
        resp = await client.post("/api/v1/auth/logout", content=b"")
        assert resp.status_code == 422


# ===================================================================
# GET /api/v1/auth/me  (5 tests)
# ===================================================================


class TestMe:
    async def test_me_happy_path(self, client, test_user: User, auth_headers):
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["email"] == "test@example.com"
        assert body["data"]["display_name"] == "Test User"
        assert "id" in body["data"]

    async def test_me_no_token(self, client):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_me_expired_token(self, client, test_user: User, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.ACCESS_TOKEN_EXPIRE_MINUTES", -1)
        token = create_access_token(user_id=test_user.id)
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    async def test_me_invalid_token(self, client):
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert resp.status_code == 401

    async def test_me_user_deleted(self, client, db_session: AsyncSession):
        user = User(email="deleted@example.com", display_name="Deleted")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        user_id = user.id

        token = create_access_token(user_id=user_id)
        await db_session.delete(user)
        await db_session.commit()

        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401


# ===================================================================
# GET /api/v1/auth/oauth/{provider}/authorize  (3 tests)
# ===================================================================


class TestOAuthAuthorize:
    async def test_authorize_google_redirect(self, client):
        resp = await client.get("/api/v1/auth/oauth/google/authorize", follow_redirects=False)
        assert resp.status_code == 307
        location = resp.headers["location"]
        assert "accounts.google.com" in location
        assert "test-client-id" in location

    async def test_authorize_unsupported_provider(self, client):
        resp = await client.get("/api/v1/auth/oauth/github/authorize")
        assert resp.status_code == 400

    async def test_authorize_google_not_configured(self, client, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.GOOGLE_CLIENT_ID", "")
        resp = await client.get("/api/v1/auth/oauth/google/authorize")
        assert resp.status_code == 500


# ===================================================================
# GET /api/v1/auth/oauth/{provider}/callback  (9 tests)
# ===================================================================


def _mock_httpx_client(token_json: dict, userinfo_json: dict):
    """Build a mock httpx.AsyncClient that returns controlled responses."""
    mock_client = AsyncMock()

    token_resp = MagicMock()
    token_resp.json.return_value = token_json

    userinfo_resp = MagicMock()
    userinfo_resp.json.return_value = userinfo_json

    mock_client.post = AsyncMock(return_value=token_resp)
    mock_client.get = AsyncMock(return_value=userinfo_resp)

    # Support `async with client:` context manager
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    return mock_client


class TestOAuthCallback:
    async def test_callback_new_user(self, client, db_session: AsyncSession):
        mock_client = _mock_httpx_client(
            token_json={"access_token": "goog-at"},
            userinfo_json={
                "id": "google-123",
                "email": "newuser@gmail.com",
                "name": "New User",
                "picture": "https://example.com/pic.jpg",
            },
        )
        with patch("app.routers.auth.httpx.AsyncClient", return_value=mock_client):
            resp = await client.get(
                "/api/v1/auth/oauth/google/callback",
                params={"code": "auth-code-123"},
                follow_redirects=False,
            )
        assert resp.status_code == 307
        location = resp.headers["location"]
        assert "access_token" in location
        assert "refresh_token" in location

        # DB assertions
        result = await db_session.execute(select(User).where(User.email == "newuser@gmail.com"))
        user = result.scalar_one()
        assert user.display_name == "New User"

        result = await db_session.execute(
            select(OAuthAccount).where(OAuthAccount.provider_user_id == "google-123")
        )
        oauth = result.scalar_one()
        assert oauth.user_id == user.id

    async def test_callback_existing_oauth_account(self, client, db_session: AsyncSession):
        # Pre-create user + oauth account
        user = User(email="existing@gmail.com", display_name="Existing")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        oa = OAuthAccount(
            user_id=user.id,
            provider=OAuthProvider.google,
            provider_user_id="google-existing",
            provider_email="existing@gmail.com",
        )
        db_session.add(oa)
        await db_session.commit()

        mock_client = _mock_httpx_client(
            token_json={"access_token": "goog-at"},
            userinfo_json={
                "id": "google-existing",
                "email": "existing@gmail.com",
                "name": "Existing",
            },
        )
        with patch("app.routers.auth.httpx.AsyncClient", return_value=mock_client):
            resp = await client.get(
                "/api/v1/auth/oauth/google/callback",
                params={"code": "code-456"},
                follow_redirects=False,
            )
        assert resp.status_code == 307
        assert "access_token" in resp.headers["location"]

    async def test_callback_existing_user_new_oauth(self, client, db_session: AsyncSession):
        # User exists by email but has no OAuth account
        user = User(email="linker@gmail.com", display_name="Linker")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        mock_client = _mock_httpx_client(
            token_json={"access_token": "goog-at"},
            userinfo_json={
                "id": "google-linker",
                "email": "linker@gmail.com",
                "name": "Linker",
            },
        )
        with patch("app.routers.auth.httpx.AsyncClient", return_value=mock_client):
            resp = await client.get(
                "/api/v1/auth/oauth/google/callback",
                params={"code": "code-789"},
                follow_redirects=False,
            )
        assert resp.status_code == 307
        assert "access_token" in resp.headers["location"]

        # Verify new OAuthAccount linked to existing user
        result = await db_session.execute(
            select(OAuthAccount).where(OAuthAccount.provider_user_id == "google-linker")
        )
        oauth = result.scalar_one()
        assert oauth.user_id == user.id

    async def test_callback_unsupported_provider(self, client):
        resp = await client.get(
            "/api/v1/auth/oauth/github/callback",
            params={"code": "any-code"},
            follow_redirects=False,
        )
        assert resp.status_code == 307
        location = resp.headers["location"]
        assert "error=unsupported_provider" in location

    async def test_callback_error_param(self, client):
        resp = await client.get(
            "/api/v1/auth/oauth/google/callback",
            params={"error": "access_denied"},
            follow_redirects=False,
        )
        assert resp.status_code == 307
        assert "error=access_denied" in resp.headers["location"]

    async def test_callback_no_code(self, client):
        resp = await client.get(
            "/api/v1/auth/oauth/google/callback",
            follow_redirects=False,
        )
        assert resp.status_code == 307
        assert "error=no_code" in resp.headers["location"]

    async def test_callback_google_token_error(self, client):
        mock_client = _mock_httpx_client(
            token_json={"error": "invalid_grant"},
            userinfo_json={},
        )
        with patch("app.routers.auth.httpx.AsyncClient", return_value=mock_client):
            resp = await client.get(
                "/api/v1/auth/oauth/google/callback",
                params={"code": "bad-code"},
                follow_redirects=False,
            )
        assert resp.status_code == 307
        assert "error=invalid_grant" in resp.headers["location"]

    async def test_callback_invalid_userinfo(self, client):
        mock_client = _mock_httpx_client(
            token_json={"access_token": "goog-at"},
            userinfo_json={"name": "No ID or Email"},  # missing id and email
        )
        with patch("app.routers.auth.httpx.AsyncClient", return_value=mock_client):
            resp = await client.get(
                "/api/v1/auth/oauth/google/callback",
                params={"code": "code-xyz"},
                follow_redirects=False,
            )
        assert resp.status_code == 307
        assert "error=invalid_userinfo" in resp.headers["location"]

    async def test_callback_http_error(self, client):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.HTTPError("connection failed"))

        with patch("app.routers.auth.httpx.AsyncClient", return_value=mock_client):
            resp = await client.get(
                "/api/v1/auth/oauth/google/callback",
                params={"code": "code-err"},
                follow_redirects=False,
            )
        assert resp.status_code == 307
        assert "error=http_error" in resp.headers["location"]
