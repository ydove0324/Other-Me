from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(user_id: int, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


def generate_refresh_token() -> str:
    return str(uuid.uuid4())


def hash_token(token: str) -> str:
    """Hash a refresh token using SHA-256 for fast DB lookups."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token(plain: str, hashed: str) -> bool:
    """Verify a refresh token by comparing SHA-256 hashes."""
    return hash_token(plain) == hashed
