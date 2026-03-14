"""Unit tests for AI service layer (llm_gateway + pipeline)."""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.ai.llm_gateway import (
    call_llm,
    call_llm_json,
    extract_content,
    extract_reasoning,
    extract_usage,
    get_openai_client,
    reset_client,
)
from app.services.ai.prompt_engine import clear_cache, render_template


# ---------------------------------------------------------------------------
# Helpers: build mock OpenAI response objects
# ---------------------------------------------------------------------------

def _make_usage(prompt=10, completion=20, total=30):
    return SimpleNamespace(prompt_tokens=prompt, completion_tokens=completion, total_tokens=total)


def _make_message(content: str, reasoning_details=None):
    msg = SimpleNamespace(content=content, role="assistant")
    if reasoning_details is not None:
        msg.reasoning_details = reasoning_details
    return msg


def _make_choice(content: str, reasoning_details=None):
    return SimpleNamespace(
        message=_make_message(content, reasoning_details),
        index=0,
        finish_reason="stop",
    )


def _make_response(content: str, model: str = "MiniMax-M2.5", reasoning_details=None):
    return SimpleNamespace(
        choices=[_make_choice(content, reasoning_details)],
        usage=_make_usage(),
        model=model,
        id="chatcmpl-test-123",
    )


# ---------------------------------------------------------------------------
# Tests: get_openai_client / reset_client
# ---------------------------------------------------------------------------

class TestOpenAIClient:
    def setup_method(self):
        reset_client()

    def teardown_method(self):
        reset_client()

    def test_raises_without_api_key(self, monkeypatch):
        monkeypatch.setattr(settings, "AI_OPENAI_API_KEY", "")
        with pytest.raises(RuntimeError, match="AI_OPENAI_API_KEY is not configured"):
            get_openai_client()

    def test_creates_client_with_key(self, monkeypatch):
        monkeypatch.setattr(settings, "AI_OPENAI_API_KEY", "sk-test-key")
        monkeypatch.setattr(settings, "AI_DEFAULT_API_BASE", "https://api.minimaxi.com/v1")
        monkeypatch.setattr(settings, "AI_TIMEOUT_SECONDS", 60)
        monkeypatch.setattr(settings, "AI_MAX_RETRIES", 2)
        client = get_openai_client()
        assert client is not None
        assert client.api_key == "sk-test-key"

    def test_singleton_returns_same_instance(self, monkeypatch):
        monkeypatch.setattr(settings, "AI_OPENAI_API_KEY", "sk-test-key")
        c1 = get_openai_client()
        c2 = get_openai_client()
        assert c1 is c2

    def test_reset_clears_singleton(self, monkeypatch):
        monkeypatch.setattr(settings, "AI_OPENAI_API_KEY", "sk-test-key")
        c1 = get_openai_client()
        reset_client()
        c2 = get_openai_client()
        assert c1 is not c2


# ---------------------------------------------------------------------------
# Tests: call_llm (async)
# ---------------------------------------------------------------------------

class TestCallLLM:
    def setup_method(self):
        reset_client()

    def teardown_method(self):
        reset_client()

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_basic_call(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=_make_response("Hello!"))
        mock_get_client.return_value = mock_client

        result = await call_llm([
            {"role": "user", "content": "Hi"},
        ])

        assert result["content"] == "Hello!"
        assert result["reasoning"] is None
        assert result["usage"]["total_tokens"] == 30
        assert result["usage"]["model"] == "MiniMax-M2.5"

        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == settings.AI_DEFAULT_MODEL
        assert call_kwargs.kwargs["temperature"] == 0.8

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_call_with_reasoning_split(self, mock_get_client, monkeypatch):
        monkeypatch.setattr(settings, "AI_REASONING_SPLIT", True)
        mock_client = MagicMock()
        reasoning = [{"text": "Let me think..."}, {"text": "I should say hello."}]
        mock_client.chat.completions.create = AsyncMock(
            return_value=_make_response("Hello!", reasoning_details=reasoning),
        )
        mock_get_client.return_value = mock_client

        result = await call_llm([{"role": "user", "content": "Hi"}])

        assert result["content"] == "Hello!"
        assert result["reasoning"] == "Let me think...\nI should say hello."
        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["extra_body"] == {"reasoning_split": True}

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_call_without_reasoning_split(self, mock_get_client, monkeypatch):
        monkeypatch.setattr(settings, "AI_REASONING_SPLIT", False)
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=_make_response("Hello!"))
        mock_get_client.return_value = mock_client

        await call_llm([{"role": "user", "content": "Hi"}])

        call_kwargs = mock_client.chat.completions.create.call_args
        assert "extra_body" not in call_kwargs.kwargs

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_call_with_explicit_reasoning_override(self, mock_get_client, monkeypatch):
        monkeypatch.setattr(settings, "AI_REASONING_SPLIT", False)
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=_make_response("Hello!"))
        mock_get_client.return_value = mock_client

        await call_llm([{"role": "user", "content": "Hi"}], reasoning_split=True)

        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["extra_body"] == {"reasoning_split": True}

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_call_with_custom_model(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=_make_response("Hello!", model="custom-model"),
        )
        mock_get_client.return_value = mock_client

        result = await call_llm(
            [{"role": "user", "content": "Hi"}],
            model="custom-model",
            temperature=0.5,
            max_tokens=2048,
        )

        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "custom-model"
        assert call_kwargs.kwargs["temperature"] == 0.5
        assert call_kwargs.kwargs["max_tokens"] == 2048

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_call_with_response_format(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=_make_response('{"key": "value"}'),
        )
        mock_get_client.return_value = mock_client

        await call_llm(
            [{"role": "user", "content": "respond in json"}],
            response_format={"type": "json_object"},
        )

        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["response_format"] == {"type": "json_object"}

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_call_handles_no_reasoning_attribute(self, mock_get_client):
        """When reasoning_details attribute doesn't exist on message."""
        mock_client = MagicMock()
        msg = SimpleNamespace(content="Hello!", role="assistant")
        choice = SimpleNamespace(message=msg, index=0, finish_reason="stop")
        resp = SimpleNamespace(
            choices=[choice], usage=_make_usage(), model="MiniMax-M2.5", id="test",
        )
        mock_client.chat.completions.create = AsyncMock(return_value=resp)
        mock_get_client.return_value = mock_client

        result = await call_llm([{"role": "user", "content": "Hi"}])
        assert result["reasoning"] is None

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_call_propagates_api_error(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))
        mock_get_client.return_value = mock_client

        with pytest.raises(Exception, match="API Error"):
            await call_llm([{"role": "user", "content": "Hi"}])


# ---------------------------------------------------------------------------
# Tests: extract helpers
# ---------------------------------------------------------------------------

class TestExtractHelpers:
    def test_extract_content(self):
        resp = {"content": "Hello!", "reasoning": None, "usage": {}}
        assert extract_content(resp) == "Hello!"

    def test_extract_reasoning_present(self):
        resp = {"content": "Hi", "reasoning": "thinking...", "usage": {}}
        assert extract_reasoning(resp) == "thinking..."

    def test_extract_reasoning_absent(self):
        resp = {"content": "Hi", "usage": {}}
        assert extract_reasoning(resp) is None

    def test_extract_usage(self):
        usage = {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30, "model": "test"}
        resp = {"content": "Hi", "usage": usage}
        assert extract_usage(resp) == usage

    def test_extract_usage_missing(self):
        resp = {"content": "Hi"}
        assert extract_usage(resp) == {}


# ---------------------------------------------------------------------------
# Tests: call_llm_json (async)
# ---------------------------------------------------------------------------

class TestCallLLMJson:
    def setup_method(self):
        reset_client()

    def teardown_method(self):
        reset_client()

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_parses_json_response(self, mock_get_client):
        json_content = json.dumps({"persona_summary": "A curious person", "traits": ["curious"]})
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=_make_response(json_content))
        mock_get_client.return_value = mock_client

        data, usage = await call_llm_json([{"role": "user", "content": "generate persona"}])

        assert data["persona_summary"] == "A curious person"
        assert data["traits"] == ["curious"]
        assert usage["total_tokens"] == 30

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_parses_json_in_code_block(self, mock_get_client):
        json_content = '```json\n{"key": "value"}\n```'
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=_make_response(json_content))
        mock_get_client.return_value = mock_client

        data, usage = await call_llm_json([{"role": "user", "content": "test"}])
        assert data["key"] == "value"

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_raises_on_invalid_json(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=_make_response("not json at all"),
        )
        mock_get_client.return_value = mock_client

        with pytest.raises(json.JSONDecodeError):
            await call_llm_json([{"role": "user", "content": "test"}])

    @patch("app.services.ai.llm_gateway.get_openai_client")
    async def test_passes_json_response_format(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=_make_response('{"ok": true}'),
        )
        mock_get_client.return_value = mock_client

        await call_llm_json([{"role": "user", "content": "test"}])

        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["response_format"] == {"type": "json_object"}


# ---------------------------------------------------------------------------
# Tests: render_template (prompt_engine)
# ---------------------------------------------------------------------------

class TestRenderTemplate:
    def test_basic_rendering(self):
        template = "Hello {{name}}, you are {{age}} years old."
        result = render_template(template, {"name": "Alice", "age": "30"})
        assert result == "Hello Alice, you are 30 years old."

    def test_missing_variable_preserved(self):
        template = "Hello {{name}}, welcome to {{place}}."
        result = render_template(template, {"name": "Bob"})
        assert result == "Hello Bob, welcome to {{place}}."

    def test_empty_variables(self):
        template = "No variables here."
        result = render_template(template, {})
        assert result == "No variables here."

    def test_chinese_content(self):
        template = "用户选择了 {{tags}}，他的回答是 {{answers}}"
        result = render_template(template, {"tags": "内向, 创意", "answers": "我喜欢独处"})
        assert result == "用户选择了 内向, 创意，他的回答是 我喜欢独处"


# ---------------------------------------------------------------------------
# Tests: pipeline integration (with mocked LLM)
# ---------------------------------------------------------------------------

class TestPipelineGeneratePersona:
    """Test generate_persona with mocked LLM calls."""

    @patch("app.services.ai.pipeline.call_llm_json", new_callable=AsyncMock)
    async def test_generate_persona_success(self, mock_llm_json, db_session: AsyncSession):
        from app.models.user import User
        from app.services.ai.pipeline import generate_persona

        user = User(email="ai-test@example.com", display_name="AI Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        persona_data = {
            "persona_summary": "你是一个充满好奇心的探索者",
            "personality_traits": ["好奇", "创新"],
            "core_values": ["自由", "成长"],
            "life_stage": "职业探索期",
            "emotional_patterns": ["乐观但偶尔焦虑"],
            "key_relationships": "重视深度关系",
            "dreams_and_fears": "渴望自由，害怕平庸",
        }
        mock_llm_json.return_value = (
            persona_data,
            {"prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300, "model": "MiniMax-M2.5"},
        )
        clear_cache()

        persona = await generate_persona(user.id, db_session)

        assert persona.persona_summary == "你是一个充满好奇心的探索者"
        assert persona.personality_traits == ["好奇", "创新"]
        assert persona.version == 1
        assert persona.user_id == user.id

        mock_llm_json.assert_called_once()
        call_args = mock_llm_json.call_args
        messages = call_args[0][0]
        assert messages[0]["role"] == "system"
        assert "心理画像" in messages[0]["content"]

    @patch("app.services.ai.pipeline.call_llm_json", new_callable=AsyncMock)
    async def test_generate_persona_increments_version(self, mock_llm_json, db_session: AsyncSession):
        from app.models.user import User
        from app.services.ai.pipeline import generate_persona

        user = User(email="version-test@example.com", display_name="Version Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        persona_data = {
            "persona_summary": "v1",
            "personality_traits": ["a"],
            "core_values": ["b"],
            "life_stage": "test",
            "emotional_patterns": [],
            "key_relationships": "",
            "dreams_and_fears": "",
        }
        mock_llm_json.return_value = (
            persona_data,
            {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30, "model": "MiniMax-M2.5"},
        )
        clear_cache()

        p1 = await generate_persona(user.id, db_session)
        assert p1.version == 1

        persona_data["persona_summary"] = "v2"
        mock_llm_json.return_value = (
            persona_data,
            {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30, "model": "MiniMax-M2.5"},
        )

        p2 = await generate_persona(user.id, db_session)
        assert p2.version == 2
        assert p2.persona_summary == "v2"

    @patch("app.services.ai.pipeline.call_llm_json", new_callable=AsyncMock)
    async def test_generate_persona_records_task_on_failure(self, mock_llm_json, db_session: AsyncSession):
        from sqlalchemy import select
        from app.models.user import User
        from app.models.ai_config import GenerationTask
        from app.models.base import TaskStatus
        from app.services.ai.pipeline import generate_persona

        user = User(email="fail-test@example.com", display_name="Fail Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        mock_llm_json.side_effect = Exception("API timeout")
        clear_cache()

        with pytest.raises(Exception, match="API timeout"):
            await generate_persona(user.id, db_session)

        result = await db_session.execute(
            select(GenerationTask).where(GenerationTask.user_id == user.id)
        )
        task = result.scalar_one()
        assert task.status == TaskStatus.failed
        assert "API timeout" in task.error_message


class TestPipelineGenerateLife:
    """Test generate_alternative_life with mocked LLM calls."""

    @patch("app.services.ai.pipeline.call_llm_json", new_callable=AsyncMock)
    async def test_generate_life_success(self, mock_llm_json, db_session: AsyncSession):
        from app.models.user import User
        from app.models.fork_point import ForkPoint
        from app.models.base import ForkPointStatus
        from app.services.ai.pipeline import generate_alternative_life

        user = User(email="life-test@example.com", display_name="Life Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        fp = ForkPoint(
            user_id=user.id,
            title="大学选专业",
            actual_choice="选了计算机",
            alternative_choice="选了音乐",
            status=ForkPointStatus.draft,
            happened_at=date(2015, 9, 1),
        )
        db_session.add(fp)
        await db_session.commit()
        await db_session.refresh(fp)

        life_data = {
            "overview": "如果选了音乐，人生会完全不同",
            "events": [
                {
                    "event_date": "2015-09-01",
                    "title": "进入音乐学院",
                    "summary": "怀着激动的心情踏入音乐殿堂",
                    "emotional_tone": {"primary": "兴奋", "secondary": "忐忑", "intensity": 0.9},
                },
                {
                    "event_date": "2017-06-15",
                    "title": "第一次演出",
                    "summary": "在学校音乐厅第一次登台",
                    "emotional_tone": {"primary": "紧张", "secondary": "自豪", "intensity": 0.85},
                },
            ],
        }
        mock_llm_json.return_value = (
            life_data,
            {"prompt_tokens": 200, "completion_tokens": 500, "total_tokens": 700, "model": "MiniMax-M2.5"},
        )
        clear_cache()

        life = await generate_alternative_life(user.id, fp.id, db_session)

        assert life.overview == "如果选了音乐，人生会完全不同"
        assert len(life.events) == 2
        assert life.events[0].title == "进入音乐学院"
        assert life.events[1].title == "第一次演出"

    @patch("app.services.ai.pipeline.call_llm_json", new_callable=AsyncMock)
    async def test_generate_life_not_found(self, mock_llm_json, db_session: AsyncSession):
        from app.models.user import User
        from app.services.ai.pipeline import generate_alternative_life

        user = User(email="notfound@example.com", display_name="NF")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        with pytest.raises(ValueError, match="Fork point not found"):
            await generate_alternative_life(user.id, 99999, db_session)


class TestPipelineGenerateEventDetail:
    """Test generate_event_detail with mocked LLM calls."""

    @patch("app.services.ai.pipeline.call_llm", new_callable=AsyncMock)
    async def test_generate_event_detail_success(self, mock_llm, db_session: AsyncSession):
        from app.models.user import User
        from app.models.fork_point import ForkPoint
        from app.models.life import AlternativeLife, LifeTimelineEvent
        from app.models.base import ForkPointStatus, LifeStatus
        from app.services.ai.pipeline import generate_event_detail

        user = User(email="detail-test@example.com", display_name="Detail Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        fp = ForkPoint(
            user_id=user.id,
            title="考研还是工作",
            actual_choice="工作",
            alternative_choice="考研",
            status=ForkPointStatus.completed,
        )
        db_session.add(fp)
        await db_session.commit()
        await db_session.refresh(fp)

        life = AlternativeLife(
            fork_point_id=fp.id,
            user_id=user.id,
            status=LifeStatus.completed,
            overview="如果考了研...",
        )
        db_session.add(life)
        await db_session.commit()
        await db_session.refresh(life)

        evt = LifeTimelineEvent(
            alternative_life_id=life.id,
            title="收到录取通知",
            summary="终于等到了录取通知书",
            sort_order=0,
        )
        db_session.add(evt)
        await db_session.commit()
        await db_session.refresh(evt)

        narrative_text = "那天下午，我拆开信封的手在微微颤抖..."
        mock_llm.return_value = {
            "content": narrative_text,
            "reasoning": "I need to write a first-person narrative",
            "usage": {"prompt_tokens": 150, "completion_tokens": 300, "total_tokens": 450, "model": "MiniMax-M2.5"},
            "raw_response": None,
        }
        clear_cache()

        result = await generate_event_detail(life.id, evt.id, db_session)

        assert result.detailed_narrative == narrative_text
        mock_llm.assert_called_once()


class TestPersonaResponseSchema:
    """Test PersonaResponse schema handles both list and dict for personality_traits."""

    def test_persona_response_accepts_list_traits(self):
        from app.schemas.profile import PersonaResponse

        resp = PersonaResponse(
            id=1,
            persona_summary="你是一个好人",
            personality_traits=["同理心强", "浪漫", "独立自主", "热爱冒险"],
            values={"core_values": ["自由"]},
            life_context={"life_stage": "初入社会"},
            version=1,
        )
        assert isinstance(resp.personality_traits, list)
        assert resp.personality_traits[0] == "同理心强"

    def test_persona_response_accepts_dict_traits(self):
        from app.schemas.profile import PersonaResponse

        resp = PersonaResponse(
            id=1,
            persona_summary="你是一个好人",
            personality_traits={"openness": 0.8, "neuroticism": 0.3},
            values=["自由", "成长"],
            life_context=["初入社会"],
            version=1,
        )
        assert isinstance(resp.personality_traits, dict)

    def test_persona_response_serializes_to_json(self):
        from app.schemas.profile import PersonaResponse

        resp = PersonaResponse(
            id=1,
            persona_summary="画像",
            personality_traits=["特质A", "特质B"],
            values=None,
            life_context=None,
            version=2,
        )
        data = resp.model_dump()
        assert data["personality_traits"] == ["特质A", "特质B"]
        assert data["version"] == 2


class TestPipelineGeneratePersonaWithQuiz:
    """Test generate_persona with quiz_answers dict (v0.1 flow)."""

    @patch("app.services.ai.pipeline.call_llm_json", new_callable=AsyncMock)
    async def test_generate_persona_from_quiz_answers(self, mock_llm_json, db_session: AsyncSession):
        from app.models.user import User
        from app.services.ai.pipeline import generate_persona

        user = User(email="quiz-test@example.com", display_name="Quiz Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        persona_data = {
            "persona_summary": "你是一个内向但充满创造力的人",
            "personality_traits": ["内向", "创造力"],
            "core_values": ["自由"],
            "life_stage": "初入社会",
            "emotional_patterns": ["平静"],
            "key_relationships": "喜欢深度连接",
            "dreams_and_fears": "渴望表达",
        }
        mock_llm_json.return_value = (
            persona_data,
            {"prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300, "model": "MiniMax-M2.5"},
        )
        clear_cache()

        quiz_answers = {
            "personality_type": "introvert",
            "personality_traits": ["creative", "empathetic"],
            "life_priority": "freedom",
            "age_range": "23-28",
        }
        persona = await generate_persona(user.id, db_session, quiz_answers=quiz_answers)

        assert persona.persona_summary == "你是一个内向但充满创造力的人"
        assert persona.version == 1
        assert persona.raw_input_data["quiz_answers"] == quiz_answers

        call_args = mock_llm_json.call_args
        messages = call_args[0][0]
        prompt_text = messages[1]["content"]
        assert "introvert" in prompt_text or "creative" in prompt_text


class TestPipelineGenerateStory:
    """Test generate_story with mocked LLM calls."""

    @patch("app.services.ai.pipeline.call_llm", new_callable=AsyncMock)
    async def test_generate_story_success(self, mock_llm, db_session: AsyncSession):
        from app.models.user import User
        from app.models.fork_point import ForkPoint
        from app.models.profile import UserPersona
        from app.models.base import ForkPointStatus
        from app.services.ai.pipeline import generate_story

        user = User(email="story-test@example.com", display_name="Story Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        persona = UserPersona(
            user_id=user.id,
            persona_summary="你是一个充满好奇心的探索者",
            personality_traits=["好奇", "冒险"],
            version=1,
            raw_input_data={"quiz_answers": {"personality_type": "extrovert"}},
        )
        db_session.add(persona)
        await db_session.commit()

        fp = ForkPoint(
            user_id=user.id,
            title="大学选专业",
            actual_choice="选了计算机",
            alternative_choice="选了音乐",
            status=ForkPointStatus.draft,
            happened_at=date(2015, 9, 1),
        )
        db_session.add(fp)
        await db_session.commit()
        await db_session.refresh(fp)

        story_md = "# 如果我选了音乐\n\n## 序章\n\n那年九月，我做了一个不同的决定……"
        mock_llm.return_value = {
            "content": story_md,
            "reasoning": None,
            "usage": {"prompt_tokens": 500, "completion_tokens": 2000, "total_tokens": 2500, "model": "MiniMax-M2.5"},
            "raw_response": None,
        }
        clear_cache()

        life = await generate_story(user.id, fp.id, db_session)

        assert life.story_markdown == story_md
        assert life.story_title == "如果我选了音乐"
        assert life.content_type == "story"
        assert life.status.value == "completed"

        mock_llm.assert_called_once()
        call_args = mock_llm.call_args
        assert call_args.kwargs.get("temperature") == 0.9
        assert call_args.kwargs.get("max_tokens") == 16384

    @patch("app.services.ai.pipeline.call_llm", new_callable=AsyncMock)
    async def test_generate_story_creates_scene(self, mock_llm, db_session: AsyncSession):
        from sqlalchemy import select
        from app.models.user import User
        from app.models.fork_point import ForkPoint
        from app.models.life import LifeScene
        from app.models.base import ForkPointStatus
        from app.services.ai.pipeline import generate_story

        user = User(email="scene-test@example.com", display_name="Scene Test")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        fp = ForkPoint(
            user_id=user.id,
            title="那次搬家",
            actual_choice="留在北京",
            alternative_choice="去了深圳",
            status=ForkPointStatus.draft,
        )
        db_session.add(fp)
        await db_session.commit()
        await db_session.refresh(fp)

        story_md = "# 南方的日子\n\n如果当初去了深圳……"
        mock_llm.return_value = {
            "content": story_md,
            "reasoning": None,
            "usage": {"prompt_tokens": 100, "completion_tokens": 500, "total_tokens": 600, "model": "MiniMax-M2.5"},
            "raw_response": None,
        }
        clear_cache()

        life = await generate_story(user.id, fp.id, db_session)

        result = await db_session.execute(
            select(LifeScene).where(LifeScene.alternative_life_id == life.id)
        )
        scenes = result.scalars().all()
        assert len(scenes) == 1
        assert scenes[0].scene_type == "text"
        assert scenes[0].content == story_md

    @patch("app.services.ai.pipeline.call_llm", new_callable=AsyncMock)
    async def test_generate_story_not_found(self, mock_llm, db_session: AsyncSession):
        from app.models.user import User
        from app.services.ai.pipeline import generate_story

        user = User(email="story-nf@example.com", display_name="NF")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        with pytest.raises(ValueError, match="Fork point not found"):
            await generate_story(user.id, 99999, db_session)

    @patch("app.services.ai.pipeline.call_llm", new_callable=AsyncMock)
    async def test_generate_story_records_task_on_failure(self, mock_llm, db_session: AsyncSession):
        from sqlalchemy import select
        from app.models.user import User
        from app.models.fork_point import ForkPoint
        from app.models.ai_config import GenerationTask
        from app.models.base import ForkPointStatus, TaskStatus, TaskType
        from app.services.ai.pipeline import generate_story

        user = User(email="story-fail@example.com", display_name="Fail")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        fp = ForkPoint(
            user_id=user.id,
            title="测试失败",
            actual_choice="A",
            alternative_choice="B",
            status=ForkPointStatus.draft,
        )
        db_session.add(fp)
        await db_session.commit()
        await db_session.refresh(fp)

        mock_llm.side_effect = Exception("LLM timeout")
        clear_cache()

        with pytest.raises(Exception, match="LLM timeout"):
            await generate_story(user.id, fp.id, db_session)

        result = await db_session.execute(
            select(GenerationTask).where(
                GenerationTask.user_id == user.id,
                GenerationTask.task_type == TaskType.story_generation,
            )
        )
        task = result.scalar_one()
        assert task.status == TaskStatus.failed
        assert "LLM timeout" in task.error_message


class TestStoryGenerationAPI:
    """Test story generation through the API router (schema serialization)."""

    @patch("app.services.ai.pipeline.call_llm_json", new_callable=AsyncMock)
    async def test_quiz_answers_api_returns_valid_persona(self, mock_llm_json, client, test_user, auth_headers):
        """POST /profile/quiz-answers should return PersonaResponse with list traits."""
        persona_data = {
            "persona_summary": "你是一个温暖的人",
            "personality_traits": ["同理心强", "浪漫", "独立自主"],
            "core_values": ["爱与被爱"],
            "life_stage": "而立之年",
            "emotional_patterns": ["平静"],
            "key_relationships": "重视家庭",
            "dreams_and_fears": "渴望稳定",
        }
        mock_llm_json.return_value = (
            persona_data,
            {"prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300, "model": "MiniMax-M2.5"},
        )
        clear_cache()

        resp = await client.post(
            "/api/v1/profile/quiz-answers",
            json={"answers": {"personality_type": "ambivert", "age_range": "29-35"}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["persona_summary"] == "你是一个温暖的人"
        assert data["personality_traits"] == ["同理心强", "浪漫", "独立自主"]
        assert data["version"] == 1
