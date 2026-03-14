"""
真实集成测试：调用图像生成 API + 上传 OSS，输出最终可访问的 URL。
用法：
    source venv/bin/activate
    python scripts/test_image_real.py
"""
import asyncio
import sys
import os

# 让脚本能找到 app 模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 加载 .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.services.image_gen_service import generate_image
from app.services.oss_service import upload_from_url, new_key


async def main():
    print("=== Step 1: 调用图像生成 API（文生图，无参考图）===")
    prompt = (
        "A young woman standing at a crossroads in an autumn forest, "
        "warm golden light filtering through leaves, watercolor illustration style, "
        "soft and delicate, storybook art"
    )
    print(f"Prompt: {prompt}")

    img_url = await generate_image(prompt=prompt)
    print(f"✅ 生成的图像 URL（临时）: {img_url}\n")

    print("=== Step 2: 下载并上传到 Aliyun OSS ===")
    object_key = new_key("test/story-images", ext="jpg")
    print(f"OSS Object Key: {object_key}")

    oss_url = await upload_from_url(img_url, object_key)
    print(f"✅ OSS 永久 URL: {oss_url}\n")

    print("=== 完成 ===")
    print(f"可在浏览器访问: {oss_url}")


if __name__ == "__main__":
    asyncio.run(main())
