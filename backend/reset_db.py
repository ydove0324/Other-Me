#!/usr/bin/env python3
"""
彻底清理并重建数据库：先用原始 SQL 删除一切，再用 SQLAlchemy 创建
"""
import asyncio
import sys

sys.path.insert(0, '/cpfs01/huangxu/other_me/backend')

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.models.base import Base

import app.models  # noqa: F401 — register all models


async def reset_db():
    url = settings.resolved_database_url
    print(f"Connecting to: {url}")

    # ========== 第一步：用原始 SQL 彻底清理 ==========
    print("\n=== Step 1: Drop everything ===")
    engine1 = create_async_engine(url, echo=False)
    async with engine1.begin() as conn:
        # 删除 public schema 下的所有东西，然后重建空的 public schema
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO PUBLIC"))
    await engine1.dispose()
    print("  Dropped all tables, types, and sequences.")

    # ========== 第二步：用新连接重建 ==========
    print("\n=== Step 2: Create all tables ===")
    engine2 = create_async_engine(url, echo=True)
    async with engine2.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine2.dispose()

    print("\n✅ Database reset complete!")


if __name__ == "__main__":
    asyncio.run(reset_db())
