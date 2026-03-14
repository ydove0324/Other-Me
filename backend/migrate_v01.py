#!/usr/bin/env python3
"""
v0.1 增量迁移：TaskType 枚举加值、alternative_lives 加字段、创建 life_scenes 表。
不会删除或重建已有数据。
"""
import asyncio
import sys

sys.path.insert(0, '/cpfs01/huangxu/other_me/backend')

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


# ALTER TYPE ... ADD VALUE 不能在事务块内执行，需要 autocommit
ENUM_STATEMENTS = [
    "ALTER TYPE tasktype ADD VALUE IF NOT EXISTS 'story_generation'",
]

# 其余 DDL 可以在事务内执行
DDL_STATEMENTS = [
    # --- AlternativeLife 新字段 ---
    "ALTER TABLE alternative_lives ADD COLUMN IF NOT EXISTS story_markdown TEXT",
    "ALTER TABLE alternative_lives ADD COLUMN IF NOT EXISTS story_title VARCHAR(500)",
    "ALTER TABLE alternative_lives ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) NOT NULL DEFAULT 'timeline'",

    # --- LifeScene 新表 ---
    """
    CREATE TABLE IF NOT EXISTS life_scenes (
        id SERIAL PRIMARY KEY,
        alternative_life_id INTEGER NOT NULL REFERENCES alternative_lives(id) ON DELETE CASCADE,
        scene_type VARCHAR(50) NOT NULL DEFAULT 'text',
        title VARCHAR(500),
        content TEXT,
        media_url VARCHAR(2000),
        metadata JSONB,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_life_scenes_life_id ON life_scenes (alternative_life_id)",
]


async def migrate():
    url = settings.resolved_database_url
    print(f"Connecting to: {url}")

    # Step 1: ALTER TYPE outside a transaction (requires isolation_level="AUTOCOMMIT")
    engine_autocommit = create_async_engine(url, echo=False, isolation_level="AUTOCOMMIT")
    async with engine_autocommit.connect() as conn:
        for stmt in ENUM_STATEMENTS:
            print(f"  [autocommit] {stmt}")
            await conn.execute(text(stmt))
    await engine_autocommit.dispose()

    # Step 2: DDL in a normal transaction
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            stmt_preview = stmt.strip().split('\n')[0][:80]
            print(f"  Running: {stmt_preview}...")
            await conn.execute(text(stmt))
    await engine.dispose()

    print("\n✅ Migration v0.1 complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
