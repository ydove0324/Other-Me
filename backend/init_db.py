#!/usr/bin/env python3
"""
使用 SQLAlchemy 自动创建数据库表和枚举类型
"""
import asyncio
import sys

# 添加项目路径
sys.path.insert(0, '/cpfs01/huangxu/other_me/backend')

from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.models.base import Base


async def init_db():
    """创建所有表和枚举类型"""
    print(f"Connecting to database: {settings.resolved_database_url}")

    engine = create_async_engine(
        settings.resolved_database_url,
        echo=True,
    )

    async with engine.begin() as conn:
        print("Creating all tables and enum types...")
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Database initialized successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
