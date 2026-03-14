from __future__ import annotations

import re
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_config import PromptTemplate

logger = logging.getLogger(__name__)

_TEMPLATE_CACHE: dict[str, str] = {}

FALLBACK_TEMPLATES: dict[str, str] = {
    "persona_generation": """你是一位资深的心理画像分析师。根据以下用户的自我标签和问卷回答，生成一份结构化的性格画像。

## 用户选择的标签
{{tags}}

## 用户的问卷回答
{{answers}}

请以 JSON 格式输出，包含以下字段：
{
  "persona_summary": "一段200字左右的人物画像描述，用第二人称'你'来写，像朋友一样温暖地描述这个人",
  "personality_traits": ["特质1", "特质2", ...],
  "core_values": ["价值观1", "价值观2", ...],
  "life_stage": "当前人生阶段的简短描述",
  "emotional_patterns": ["情绪模式1", "情绪模式2", ...],
  "key_relationships": "对人际关系的偏好和模式",
  "dreams_and_fears": "内心深处的渴望与恐惧"
}""",
    "life_timeline": """你是一位才华横溢的叙事作家。根据以下信息，为这个人构建一条"未选择之路"的人生时间线。

## 人物画像
{{persona}}

## 人生分岔点
- 时间：{{fork_date}}
- 标题：{{fork_title}}
- 背景：{{fork_description}}
- 实际的选择：{{actual_choice}}
- 未走的那条路：{{alternative_choice}}
- 当时的情绪：{{emotional_context}}

## 要求
从分岔点开始，想象如果选择了"未走的那条路"，这个人的人生会怎样展开。生成10-15个关键人生事件节点，时间跨度从分岔点延续到当前（{{current_year}}年）。

每个事件要真实、细腻、有情感温度。既有高光时刻也有低谷和挣扎——因为每条路都有代价。

请以 JSON 格式输出：
{
  "overview": "这条未选择之路的一句话概述",
  "events": [
    {
      "event_date": "YYYY-MM-DD",
      "title": "事件标题",
      "summary": "50-100字的事件摘要",
      "emotional_tone": {"primary": "主要情绪", "secondary": "次要情绪", "intensity": 0.8}
    }
  ]
}""",
    "event_detail": """你是一位细腻的第一人称叙事作家。请根据以下信息，为这个时间线事件写一段详细的叙事。

## 人物画像
{{persona}}

## 人生分岔点背景
{{fork_context}}

## 此前的人生经历
{{previous_events}}

## 当前事件
- 时间：{{event_date}}
- 标题：{{event_title}}
- 摘要：{{event_summary}}
- 情绪基调：{{emotional_tone}}

## 写作要求
1. 用第一人称"我"来写，仿佛这就是"另一个我"在写日记或回忆录
2. 字数500-800字
3. 要体现人物画像中的性格特征和价值观
4. 自然引用之前的经历，保持叙事连贯
5. 情感真实，不回避矛盾和代价
6. 偶尔穿插对"如果当初选了另一条路"（即现实中的选择）的思考

直接输出叙事文本，不需要 JSON 格式。""",
    "life_blocks": """你是一位才华横溢的叙事作家，擅长用细腻的笔触书写真实感人的人生故事。

## 人物画像
{{persona}}

## 人生分岔点
- 时间：{{fork_date}}
- 标题：{{fork_title}}
- 背景：{{fork_description}}
- 实际的选择：{{actual_choice}}
- 未走的那条路：{{alternative_choice}}

## 问卷中透露的更多信息
{{quiz_answers}}

## 写作要求
请以第一人称"我"的视角，写一篇关于"未走的那条路"的叙事故事，从分岔点推演到现在（{{current_year}}年）。

### 格式要求
- 用 `<!-- BLOCK n -->` 分隔符将故事分为 4-5 个叙事章节（n 从 1 开始）
- 每个 block 以 `## 章节标题` 开头
- 每个 block 约 500 字
- 使用 Markdown 格式（**粗体**、*斜体*等）

### 内容要求
1. 从分岔点那一刻写起，描述做出不同选择的心理活动
2. 沿时间线展开，有高光时刻也有低谷和挣扎——因为每条路都有代价
3. 体现人物画像中的性格特征和价值观，让故事与"我"的性格吻合
4. 每个 block 包含具体的场景描写、对话、和内心独白，而不是空泛的叙述
5. 最后一个 block 在结尾处用几句话反思"如果当初没有这样选择"，融入叙事中自然带过，不要整段反思
6. 情感真实，不美化也不悲观，呈现一个真实的"另一种可能"

### 输出示例结构
<!-- BLOCK 1 -->
## 那个夏天的决定
（约500字叙事...）

<!-- BLOCK 2 -->
## 陌生城市的第一年
（约500字叙事...）

直接输出 Markdown 文本，不需要 JSON 格式。""",
    "story_generation": """你是一位才华横溢的叙事作家，擅长用细腻的笔触书写真实感人的人生故事。

## 人物画像
{{persona}}

## 人生分岔点
- 时间：{{fork_date}}
- 标题：{{fork_title}}
- 背景：{{fork_description}}
- 实际的选择：{{actual_choice}}
- 未走的那条路：{{alternative_choice}}

## 问卷中透露的更多信息
{{quiz_answers}}

## 写作要求
请以第一人称"我"的视角，写一篇 1500-2500 字的 Markdown 故事，讲述如果当初选择了"未走的那条路"，我的人生会怎样展开。

### 格式要求
- 使用 Markdown 格式，包含标题（##）、段落、适当的强调（**粗体**、*斜体*）
- 故事标题用一级标题（#）
- 按时间线从分岔点推演到现在（{{current_year}}年）
- 分为多个章节（用 ## 二级标题），每个章节对应一个人生阶段

### 内容要求
1. 从分岔点那一刻写起，描述做出不同选择的心理活动
2. 沿时间线展开，有高光时刻也有低谷和挣扎——因为每条路都有代价
3. 体现人物画像中的性格特征和价值观，让故事与"我"的性格吻合
4. 包含具体的场景、对话、感受，而不是空泛的叙述
5. 结尾写一段与"现实中的我"隔空对话：站在这条未选择的路的终点，对选了另一条路的自己说几句话
6. 情感真实，不美化也不悲观，呈现一个真实的"另一种可能"

直接输出 Markdown 故事文本，不需要 JSON 格式。""",
}


async def get_template(name: str, session: AsyncSession) -> str:
    """Get a prompt template by name. Falls back to hardcoded template if not in DB."""
    if name in _TEMPLATE_CACHE:
        return _TEMPLATE_CACHE[name]

    result = await session.execute(
        select(PromptTemplate).where(
            PromptTemplate.name == name,
            PromptTemplate.is_active == True,  # noqa: E712
        ).order_by(PromptTemplate.version.desc()).limit(1)
    )
    template = result.scalar_one_or_none()

    if template:
        _TEMPLATE_CACHE[name] = template.template
        return template.template

    fallback = FALLBACK_TEMPLATES.get(name)
    if fallback:
        return fallback

    raise ValueError(f"Prompt template '{name}' not found")


def render_template(template: str, variables: dict[str, str]) -> str:
    """Replace {{variable}} placeholders with actual values."""
    def replace_var(match: re.Match) -> str:
        key = match.group(1).strip()
        return variables.get(key, match.group(0))

    return re.sub(r"\{\{(\w+)\}\}", replace_var, template)


def clear_cache() -> None:
    _TEMPLATE_CACHE.clear()
