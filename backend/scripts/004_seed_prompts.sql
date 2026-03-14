-- Seed: Prompt Templates (optional — app has hardcoded fallbacks)
-- These DB entries override the fallbacks and can be hot-updated.

INSERT INTO prompt_templates (name, category, template, variables, model_config, version) VALUES
(
    'persona_generation',
    'persona',
    E'你是一位资深的心理画像分析师。根据以下用户的自我标签和问卷回答，生成一份结构化的性格画像。\n\n## 用户选择的标签\n{{tags}}\n\n## 用户的问卷回答\n{{answers}}\n\n请以 JSON 格式输出，包含以下字段：\n{\n  "persona_summary": "一段200字左右的人物画像描述，用第二人称''你''来写，像朋友一样温暖地描述这个人",\n  "personality_traits": ["特质1", "特质2", ...],\n  "core_values": ["价值观1", "价值观2", ...],\n  "life_stage": "当前人生阶段的简短描述",\n  "emotional_patterns": ["情绪模式1", "情绪模式2", ...],\n  "key_relationships": "对人际关系的偏好和模式",\n  "dreams_and_fears": "内心深处的渴望与恐惧"\n}',
    '["tags", "answers"]',
    '{"temperature": 0.7, "max_tokens": 2048}',
    1
),
(
    'life_timeline',
    'generation',
    E'你是一位才华横溢的叙事作家。根据以下信息，为这个人构建一条"未选择之路"的人生时间线。\n\n## 人物画像\n{{persona}}\n\n## 人生分岔点\n- 时间：{{fork_date}}\n- 标题：{{fork_title}}\n- 背景：{{fork_description}}\n- 实际的选择：{{actual_choice}}\n- 未走的那条路：{{alternative_choice}}\n- 当时的情绪：{{emotional_context}}\n\n## 要求\n从分岔点开始，想象如果选择了"未走的那条路"，这个人的人生会怎样展开。生成10-15个关键人生事件节点，时间跨度从分岔点延续到当前（{{current_year}}年）。\n\n每个事件要真实、细腻、有情感温度。既有高光时刻也有低谷和挣扎——因为每条路都有代价。\n\n请以 JSON 格式输出：\n{\n  "overview": "这条未选择之路的一句话概述",\n  "events": [\n    {\n      "event_date": "YYYY-MM-DD",\n      "title": "事件标题",\n      "summary": "50-100字的事件摘要",\n      "emotional_tone": {"primary": "主要情绪", "secondary": "次要情绪", "intensity": 0.8}\n    }\n  ]\n}',
    '["persona", "fork_date", "fork_title", "fork_description", "actual_choice", "alternative_choice", "emotional_context", "current_year"]',
    '{"temperature": 0.85, "max_tokens": 8192}',
    1
),
(
    'event_detail',
    'generation',
    E'你是一位细腻的第一人称叙事作家。请根据以下信息，为这个时间线事件写一段详细的叙事。\n\n## 人物画像\n{{persona}}\n\n## 人生分岔点背景\n{{fork_context}}\n\n## 此前的人生经历\n{{previous_events}}\n\n## 当前事件\n- 时间：{{event_date}}\n- 标题：{{event_title}}\n- 摘要：{{event_summary}}\n- 情绪基调：{{emotional_tone}}\n\n## 写作要求\n1. 用第一人称"我"来写，仿佛这就是"另一个我"在写日记或回忆录\n2. 字数500-800字\n3. 要体现人物画像中的性格特征和价值观\n4. 自然引用之前的经历，保持叙事连贯\n5. 情感真实，不回避矛盾和代价\n6. 偶尔穿插对"如果当初选了另一条路"（即现实中的选择）的思考\n\n直接输出叙事文本，不需要 JSON 格式。',
    '["persona", "fork_context", "previous_events", "event_date", "event_title", "event_summary", "emotional_tone"]',
    '{"temperature": 0.9, "max_tokens": 2048}',
    1
)
ON CONFLICT (name) DO UPDATE SET
    template = EXCLUDED.template,
    variables = EXCLUDED.variables,
    model_config = EXCLUDED.model_config,
    version = prompt_templates.version + 1,
    updated_at = NOW();
