from __future__ import annotations

from urllib.parse import quote

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Other Me"
    DEBUG: bool = False

    # --- Database ---
    DATABASE_URL: str = ""
    DB_HOST: str = ""
    DB_PORT: int = 5432
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_NAME: str = "other_me"

    # --- JWT ---
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- OAuth ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    FRONTEND_URL: str = "http://localhost:6018"

    # --- HTTP Proxy ---
    HTTP_PROXY: str = ""
    HTTPS_PROXY: str = ""

    # --- AI Gateway ---
    AI_DEFAULT_PROVIDER: str = "minimax"
    AI_DEFAULT_MODEL: str = "MiniMax-M2.5"
    AI_DEFAULT_API_BASE: str = "https://api.minimaxi.com/v1"
    AI_OPENAI_API_KEY: str = ""
    AI_MAX_RETRIES: int = 3
    AI_TIMEOUT_SECONDS: int = 120
    AI_REASONING_SPLIT: bool = True

    # --- Web Search ---
    SERPAPI_API_KEY: str = ""

    # --- Aliyun OSS ---
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET_NAME: str = "hx-img-oss"
    OSS_REGION: str = "cn-beijing"
    OSS_ENDPOINT: str = "https://oss-cn-beijing.aliyuncs.com"

    # --- Image Generation ---
    IMAGE_GEN_API_BASE: str = "https://aiping.cn/api/v1"
    IMAGE_GEN_API_KEY: str = ""
    IMAGE_GEN_MODEL: str = "Qwen-Image-2.0-Pro"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def resolved_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL

        if self.DB_HOST and self.DB_USER and self.DB_NAME:
            encoded_user = quote(self.DB_USER, safe="")
            encoded_password = quote(self.DB_PASSWORD, safe="")
            return (
                f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )

        return "postgresql+asyncpg://postgres:postgres@localhost:5432/other_me"


settings = Settings()
