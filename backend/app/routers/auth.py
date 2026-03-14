from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.user import User, RefreshToken, OAuthAccount
from app.models.base import OAuthProvider
from app.schemas.common import ApiResponse
from app.schemas.auth import TokenResponse, RefreshRequest
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_token,
    verify_token,
)
from app.core.deps import get_current_user

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


async def _create_tokens(user: User, session: AsyncSession) -> TokenResponse:
    access_token = create_access_token(user_id=user.id)
    raw_refresh = generate_refresh_token()
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(refresh_record)
    await session.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=ApiResponse)
async def refresh(body: RefreshRequest, session: Annotated[AsyncSession, Depends(get_session)]):
    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.is_revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    tokens = result.scalars().all()

    matched: RefreshToken | None = None
    for tok in tokens:
        if verify_token(body.refresh_token, tok.token_hash):
            matched = tok
            break

    if not matched:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效或已过期的刷新令牌")

    matched.is_revoked = True
    result = await session.execute(select(User).where(User.id == matched.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")

    new_tokens = await _create_tokens(user, session)
    return ApiResponse(code=0, message="令牌已刷新", data=new_tokens.model_dump())


@router.post("/logout", response_model=ApiResponse)
async def logout(body: RefreshRequest, session: Annotated[AsyncSession, Depends(get_session)]):
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.is_revoked == False)  # noqa: E712
    )
    for tok in result.scalars().all():
        try:
            if verify_token(body.refresh_token, tok.token_hash):
                tok.is_revoked = True
                await session.commit()
                break
        except Exception:
            continue
    return ApiResponse(code=0, message="已退出登录")


@router.get("/me", response_model=ApiResponse)
async def get_me(user: Annotated[User, Depends(get_current_user)]):
    return ApiResponse(
        code=0,
        message="success",
        data={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "onboarding_completed": user.onboarding_completed,
        },
    )


# ===================== Google OAuth =====================

@router.get("/oauth/{provider}/authorize")
async def oauth_authorize(provider: str):
    if provider != "google":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"不支持的 OAuth 提供者: {provider}")
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google OAuth 未配置")

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(None),
    error: str = Query(None),
    session: AsyncSession = Depends(get_session),
):
    frontend_url = settings.FRONTEND_URL

    if provider != "google":
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=unsupported_provider")
    if error:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error={error}")
    if not code:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=no_code")

    try:
        # 使用 mounts 配置代理（这是 httpx 推荐的方式）
        proxy_url = settings.HTTPS_PROXY or settings.HTTP_PROXY
        if proxy_url:
            # 强制使用 http:// 协议（Clash 等代理不支持 https:// 作为代理协议）
            proxy_url = proxy_url.replace('https://', 'http://', 1)
            mounts = {
                "http://": httpx.AsyncHTTPTransport(proxy=proxy_url),
                "https://": httpx.AsyncHTTPTransport(proxy=proxy_url),
            }
            client = httpx.AsyncClient(mounts=mounts, timeout=15)
        else:
            client = httpx.AsyncClient(timeout=15)

        async with client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                },
            )
            token_data = token_response.json()
            if "error" in token_data:
                return RedirectResponse(url=f"{frontend_url}/auth/callback?error={token_data.get('error')}")

            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token_data.get('access_token')}"},
            )
            userinfo = userinfo_response.json()

        google_user_id = userinfo.get("id")
        email = userinfo.get("email")
        name = userinfo.get("name", "")
        picture = userinfo.get("picture")

        if not google_user_id or not email:
            return RedirectResponse(url=f"{frontend_url}/auth/callback?error=invalid_userinfo")

        result = await session.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == OAuthProvider.google,
                OAuthAccount.provider_user_id == google_user_id,
            )
        )
        oauth_account = result.scalar_one_or_none()

        if oauth_account:
            result = await session.execute(select(User).where(User.id == oauth_account.user_id))
            user = result.scalar_one_or_none()
            if not user:
                return RedirectResponse(url=f"{frontend_url}/auth/callback?error=user_not_found")
        else:
            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

            if user:
                oauth_account = OAuthAccount(
                    user_id=user.id,
                    provider=OAuthProvider.google,
                    provider_user_id=google_user_id,
                    provider_email=email,
                    provider_name=name,
                    provider_avatar_url=picture,
                    raw_profile=userinfo,
                )
                session.add(oauth_account)
            else:
                user = User(
                    email=email,
                    display_name=name or email.split("@")[0],
                    avatar_url=picture,
                )
                session.add(user)
                await session.flush()

                oauth_account = OAuthAccount(
                    user_id=user.id,
                    provider=OAuthProvider.google,
                    provider_user_id=google_user_id,
                    provider_email=email,
                    provider_name=name,
                    provider_avatar_url=picture,
                    raw_profile=userinfo,
                )
                session.add(oauth_account)

        user.last_login_at = datetime.now(timezone.utc)
        await session.commit()

        tokens = await _create_tokens(user, session)
        redirect_params = urlencode({
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
        })
        return RedirectResponse(url=f"{frontend_url}/auth/callback?{redirect_params}")

    except httpx.HTTPError as e:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=http_error&detail={str(e)}")
    except Exception as e:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=server_error&detail={str(e)}")
