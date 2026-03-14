from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import JSON, event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token, generate_refresh_token, hash_token
from app.database import get_session
from app.models.base import Base
from app.models.user import OAuthAccount, RefreshToken, User  # noqa: F401 – register models


# ---------------------------------------------------------------------------
# Engine / tables (session-scoped – created once)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def test_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Replace JSONB columns with JSON so SQLite can handle them
    @event.listens_for(Base.metadata, "before_create")
    def _patch_jsonb(target, connection, **kw):  # noqa: ARG001
        for table in target.sorted_tables:
            for col in table.columns:
                if hasattr(col.type, "__class__") and col.type.__class__.__name__ == "JSONB":
                    col.type = JSON()

    return engine


@pytest.fixture(scope="session", autouse=True)
async def _create_tables(test_engine):
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# Per-test cleanup
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def _cleanup_tables(test_engine):
    yield
    async with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(text(f"DELETE FROM {table.name}"))


# ---------------------------------------------------------------------------
# DB session fixture
# ---------------------------------------------------------------------------

@pytest.fixture()
async def db_session(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Settings override (autouse)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def override_settings(monkeypatch):
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "test-secret")
    monkeypatch.setattr(settings, "JWT_ALGORITHM", "HS256")
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 60)
    monkeypatch.setattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS", 30)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://localhost/callback")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:6018")
    monkeypatch.setattr(settings, "HTTP_PROXY", "")
    monkeypatch.setattr(settings, "HTTPS_PROXY", "")


# ---------------------------------------------------------------------------
# FastAPI app + async test client
# ---------------------------------------------------------------------------

@pytest.fixture()
async def app(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_session():
        async with session_factory() as session:
            yield session

    from app.main import create_app

    application = create_app()
    application.dependency_overrides[get_session] = _override_get_session
    return application


@pytest.fixture()
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Data factory helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
async def test_user(db_session: AsyncSession) -> User:
    user = User(email="test@example.com", display_name="Test User")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture()
async def test_user_with_refresh_token(db_session: AsyncSession, test_user: User):
    raw_token = generate_refresh_token()
    rt = RefreshToken(
        user_id=test_user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(rt)
    await db_session.commit()
    return test_user, raw_token


@pytest.fixture()
def auth_headers(test_user: User) -> dict[str, str]:
    token = create_access_token(user_id=test_user.id)
    return {"Authorization": f"Bearer {token}"}
