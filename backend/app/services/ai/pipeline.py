from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, date, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.profile import Tag, UserTag, QuestionnaireAnswer, QuestionnaireQuestion, UserPersona
from app.models.fork_point import ForkPoint
from app.models.life import AlternativeLife, LifeTimelineEvent, LifeScene
from app.models.memory import UserMemory
from app.models.ai_config import GenerationTask
from app.models.base import ForkPointStatus, LifeStatus, TaskStatus, TaskType
from app.models.user import User

from .prompt_engine import get_template, render_template
import re as _re

from .llm_gateway import call_llm, call_llm_json, call_llm_stream, extract_content, extract_usage

logger = logging.getLogger(__name__)


async def _get_user_tags(user_id: int, session: AsyncSession) -> list[str]:
    result = await session.execute(
        select(Tag).join(UserTag, UserTag.tag_id == Tag.id).where(UserTag.user_id == user_id)
    )
    return [t.display_name for t in result.scalars().all()]


async def _get_user_answers(user_id: int, session: AsyncSession) -> list[dict]:
    result = await session.execute(
        select(QuestionnaireAnswer, QuestionnaireQuestion)
        .join(QuestionnaireQuestion, QuestionnaireQuestion.id == QuestionnaireAnswer.question_id)
        .where(QuestionnaireAnswer.user_id == user_id)
    )
    answers = []
    for ans, q in result.all():
        answers.append({
            "question": q.question_text,
            "answer": ans.answer_text or json.dumps(ans.answer_data, ensure_ascii=False),
        })
    return answers


async def _get_latest_persona(user_id: int, session: AsyncSession) -> UserPersona | None:
    result = await session.execute(
        select(UserPersona)
        .where(UserPersona.user_id == user_id)
        .order_by(UserPersona.version.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def generate_persona(
    user_id: int,
    session: AsyncSession,
    quiz_answers: dict[str, str | list[str]] | None = None,
) -> UserPersona:
    """Generate or regenerate the user persona from tags + questionnaire answers.

    If quiz_answers is provided (from BubbleQuiz), use it directly instead of
    loading from UserTag/QuestionnaireAnswer tables.
    """
    if quiz_answers is not None:
        tags: list[str] = []
        answers_text = "\n".join(
            f"Q: {k}\nA: {v if isinstance(v, str) else ', '.join(v)}"
            for k, v in quiz_answers.items()
        )
        raw_input = {"quiz_answers": quiz_answers}
    else:
        tags = await _get_user_tags(user_id, session)
        answers_list = await _get_user_answers(user_id, session)
        answers_text = "\n".join(
            f"Q: {a['question']}\nA: {a['answer']}" for a in answers_list
        ) if answers_list else "（未回答问题）"
        raw_input = {"tags": tags, "answers": answers_list}

    template = await get_template("persona_generation", session)
    prompt = render_template(template, {
        "tags": ", ".join(tags) if tags else "（未选择标签）",
        "answers": answers_text,
    })

    task = GenerationTask(
        user_id=user_id,
        task_type=TaskType.persona_generation,
        status=TaskStatus.processing,
        input_data=raw_input,
        started_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.flush()

    try:
        data, usage = await call_llm_json([
            {"role": "system", "content": "你是一位心理画像分析师。请用 JSON 格式回复。"},
            {"role": "user", "content": prompt},
        ], temperature=0.7)

        existing = await _get_latest_persona(user_id, session)
        new_version = (existing.version + 1) if existing else 1

        persona = UserPersona(
            user_id=user_id,
            persona_summary=data.get("persona_summary", ""),
            personality_traits=data.get("personality_traits") or data.get("core_values"),
            values={"core_values": data.get("core_values", []), "dreams_and_fears": data.get("dreams_and_fears", "")},
            life_context={
                "life_stage": data.get("life_stage", ""),
                "emotional_patterns": data.get("emotional_patterns", []),
                "key_relationships": data.get("key_relationships", ""),
            },
            version=new_version,
            raw_input_data=raw_input,
        )
        session.add(persona)

        task.status = TaskStatus.completed
        task.output_data = data
        task.tokens_used = usage
        task.model_used = usage.get("model", "")
        task.completed_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(persona)
        return persona

    except Exception as e:
        task.status = TaskStatus.failed
        task.error_message = str(e)
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        raise


async def generate_alternative_life(
    user_id: int,
    fork_point_id: int,
    session: AsyncSession,
) -> AlternativeLife:
    """Generate a full alternative life timeline for a fork point."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise ValueError("Fork point not found")

    fp.status = ForkPointStatus.generating
    await session.flush()

    persona = await _get_latest_persona(user_id, session)
    persona_text = persona.persona_summary if persona else "（用户尚未生成画像）"

    template = await get_template("life_timeline", session)
    prompt = render_template(template, {
        "persona": persona_text,
        "fork_date": str(fp.happened_at) if fp.happened_at else "不确定",
        "fork_title": fp.title,
        "fork_description": fp.description or "",
        "actual_choice": fp.actual_choice,
        "alternative_choice": fp.alternative_choice,
        "emotional_context": json.dumps(fp.emotional_context, ensure_ascii=False) if fp.emotional_context else "未提供",
        "current_year": str(datetime.now().year),
    })

    life = AlternativeLife(
        fork_point_id=fork_point_id,
        user_id=user_id,
        persona_snapshot_id=persona.id if persona else None,
        status=LifeStatus.generating,
    )
    session.add(life)
    await session.flush()

    task = GenerationTask(
        user_id=user_id,
        task_type=TaskType.life_timeline,
        related_id=life.id,
        status=TaskStatus.processing,
        started_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.flush()

    try:
        data, usage = await call_llm_json([
            {"role": "system", "content": "你是一位叙事作家。请用 JSON 格式回复。"},
            {"role": "user", "content": prompt},
        ], temperature=0.85, max_tokens=8192)

        life.overview = data.get("overview", "")
        life.status = LifeStatus.completed
        life.generation_metadata = usage

        events = data.get("events", [])
        for i, evt in enumerate(events):
            event_date = None
            if evt.get("event_date"):
                try:
                    event_date = date.fromisoformat(evt["event_date"])
                except (ValueError, TypeError):
                    pass

            event = LifeTimelineEvent(
                alternative_life_id=life.id,
                event_date=event_date,
                title=evt.get("title", f"事件 {i + 1}"),
                summary=evt.get("summary", ""),
                emotional_tone=evt.get("emotional_tone"),
                sort_order=i,
            )
            session.add(event)

        fp.status = ForkPointStatus.completed

        task.status = TaskStatus.completed
        task.output_data = data
        task.tokens_used = usage
        task.model_used = usage.get("model", "")
        task.completed_at = datetime.now(timezone.utc)

        await session.commit()

        result = await session.execute(
            select(AlternativeLife)
            .where(AlternativeLife.id == life.id)
            .options(selectinload(AlternativeLife.events))
        )
        return result.scalar_one()

    except Exception as e:
        life.status = LifeStatus.failed
        fp.status = ForkPointStatus.failed
        task.status = TaskStatus.failed
        task.error_message = str(e)
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        raise


async def generate_event_detail(
    life_id: int,
    event_id: int,
    session: AsyncSession,
) -> LifeTimelineEvent:
    """Generate detailed narrative for a specific timeline event."""
    result = await session.execute(
        select(AlternativeLife)
        .where(AlternativeLife.id == life_id)
        .options(selectinload(AlternativeLife.events))
    )
    life = result.scalar_one_or_none()
    if not life:
        raise ValueError("Alternative life not found")

    result = await session.execute(
        select(LifeTimelineEvent).where(LifeTimelineEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise ValueError("Event not found")

    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == life.fork_point_id)
    )
    fp = result.scalar_one()

    persona = None
    if life.persona_snapshot_id:
        result = await session.execute(
            select(UserPersona).where(UserPersona.id == life.persona_snapshot_id)
        )
        persona = result.scalar_one_or_none()

    previous_events = [
        e for e in sorted(life.events, key=lambda e: e.sort_order)
        if e.sort_order < event.sort_order
    ]
    prev_text = "\n".join(
        f"- {e.event_date or '?'}: {e.title} — {e.summary}" for e in previous_events[-5:]
    ) or "（这是第一个事件）"

    fork_context = f"标题：{fp.title}\n背景：{fp.description or ''}\n实际选择：{fp.actual_choice}\n另一条路：{fp.alternative_choice}"

    template = await get_template("event_detail", session)
    prompt = render_template(template, {
        "persona": persona.persona_summary if persona else "（无画像）",
        "fork_context": fork_context,
        "previous_events": prev_text,
        "event_date": str(event.event_date) if event.event_date else "不确定",
        "event_title": event.title,
        "event_summary": event.summary,
        "emotional_tone": json.dumps(event.emotional_tone, ensure_ascii=False) if event.emotional_tone else "未指定",
    })

    task = GenerationTask(
        user_id=life.user_id,
        task_type=TaskType.event_detail,
        related_id=event.id,
        status=TaskStatus.processing,
        started_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.flush()

    try:
        response = await call_llm([
            {"role": "system", "content": "你是一位细腻的第一人称叙事作家。"},
            {"role": "user", "content": prompt},
        ], temperature=0.9, max_tokens=2048)

        narrative = extract_content(response)
        usage = extract_usage(response)

        event.detailed_narrative = narrative

        task.status = TaskStatus.completed
        task.output_data = {"narrative_length": len(narrative)}
        task.tokens_used = usage
        task.model_used = usage.get("model", "")
        task.completed_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(event)
        return event

    except Exception as e:
        task.status = TaskStatus.failed
        task.error_message = str(e)
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        raise


async def generate_story(
    user_id: int,
    fork_point_id: int,
    session: AsyncSession,
) -> AlternativeLife:
    """Generate a Markdown story for a fork point."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise ValueError("Fork point not found")

    fp.status = ForkPointStatus.generating
    await session.flush()

    persona = await _get_latest_persona(user_id, session)
    persona_text = persona.persona_summary if persona else "（用户尚未生成画像）"

    # Load quiz answers from persona raw_input_data if available
    quiz_answers_text = "（未提供）"
    if persona and persona.raw_input_data:
        qa = persona.raw_input_data.get("quiz_answers")
        if qa:
            quiz_answers_text = "\n".join(
                f"- {k}: {v if isinstance(v, str) else ', '.join(v)}"
                for k, v in qa.items()
            )

    template = await get_template("story_generation", session)
    prompt = render_template(template, {
        "persona": persona_text,
        "fork_date": str(fp.happened_at) if fp.happened_at else "不确定",
        "fork_title": fp.title,
        "fork_description": fp.description or "",
        "actual_choice": fp.actual_choice,
        "alternative_choice": fp.alternative_choice,
        "quiz_answers": quiz_answers_text,
        "current_year": str(datetime.now().year),
    })

    life = AlternativeLife(
        fork_point_id=fork_point_id,
        user_id=user_id,
        persona_snapshot_id=persona.id if persona else None,
        status=LifeStatus.generating,
        content_type="story",
    )
    session.add(life)
    await session.flush()

    task = GenerationTask(
        user_id=user_id,
        task_type=TaskType.story_generation,
        related_id=life.id,
        status=TaskStatus.processing,
        started_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.flush()

    try:
        response = await call_llm([
            {"role": "system", "content": "你是一位才华横溢的叙事作家。请用 Markdown 格式写一篇感人的人生故事。"},
            {"role": "user", "content": prompt},
        ], temperature=0.9, max_tokens=16384)

        story_text = extract_content(response)
        usage = extract_usage(response)

        # Extract title from first markdown heading if present
        story_title = None
        for line in story_text.split("\n"):
            line = line.strip()
            if line.startswith("# "):
                story_title = line[2:].strip()
                break

        life.story_markdown = story_text
        life.story_title = story_title or fp.title
        life.overview = story_title or fp.title
        life.status = LifeStatus.completed
        life.generation_metadata = usage

        # Create a single text scene for future extensibility
        scene = LifeScene(
            alternative_life_id=life.id,
            scene_type="text",
            title=story_title or fp.title,
            content=story_text,
            sort_order=0,
        )
        session.add(scene)

        fp.status = ForkPointStatus.completed

        task.status = TaskStatus.completed
        task.output_data = {"story_length": len(story_text), "story_title": story_title}
        task.tokens_used = usage
        task.model_used = usage.get("model", "")
        task.completed_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(life)
        return life

    except Exception as e:
        life.status = LifeStatus.failed
        fp.status = ForkPointStatus.failed
        task.status = TaskStatus.failed
        task.error_message = str(e)
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        raise


async def generate_story_stream(
    user_id: int,
    fork_point_id: int,
    session: AsyncSession,
):
    """Stream a Markdown story, saving to DB when generation completes.

    Yields str text chunks. On error, raises after updating DB status.
    """
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise ValueError("Fork point not found")

    fp.status = ForkPointStatus.generating
    await session.flush()

    persona = await _get_latest_persona(user_id, session)
    persona_text = persona.persona_summary if persona else "（用户尚未生成画像）"

    quiz_answers_text = "（未提供）"
    if persona and persona.raw_input_data:
        qa = persona.raw_input_data.get("quiz_answers")
        if qa:
            quiz_answers_text = "\n".join(
                f"- {k}: {v if isinstance(v, str) else ', '.join(v)}"
                for k, v in qa.items()
            )

    template = await get_template("story_generation", session)
    prompt = render_template(template, {
        "persona": persona_text,
        "fork_date": str(fp.happened_at) if fp.happened_at else "不确定",
        "fork_title": fp.title,
        "fork_description": fp.description or "",
        "actual_choice": fp.actual_choice,
        "alternative_choice": fp.alternative_choice,
        "quiz_answers": quiz_answers_text,
        "current_year": str(datetime.now().year),
    })

    life = AlternativeLife(
        fork_point_id=fork_point_id,
        user_id=user_id,
        persona_snapshot_id=persona.id if persona else None,
        status=LifeStatus.generating,
        content_type="story",
    )
    session.add(life)
    await session.flush()

    task = GenerationTask(
        user_id=user_id,
        task_type=TaskType.story_generation,
        related_id=life.id,
        status=TaskStatus.processing,
        started_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.flush()
    await session.commit()

    full_text = ""
    try:
        async for chunk in call_llm_stream(
            [
                {"role": "system", "content": "你是一位才华横溢的叙事作家。请用 Markdown 格式写一篇感人的人生故事。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.9,
            max_tokens=8192,
        ):
            full_text += chunk
            yield chunk

        story_title = None
        for line in full_text.split("\n"):
            line = line.strip()
            if line.startswith("# "):
                story_title = line[2:].strip()
                break

        life.story_markdown = full_text
        life.story_title = story_title or fp.title
        life.overview = story_title or fp.title
        life.status = LifeStatus.completed

        scene = LifeScene(
            alternative_life_id=life.id,
            scene_type="text",
            title=story_title or fp.title,
            content=full_text,
            sort_order=0,
        )
        session.add(scene)

        fp.status = ForkPointStatus.completed
        task.status = TaskStatus.completed
        task.output_data = {"story_length": len(full_text), "story_title": story_title}
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()

    except Exception as e:
        life.status = LifeStatus.failed
        fp.status = ForkPointStatus.failed
        task.status = TaskStatus.failed
        task.error_message = str(e)
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        raise


async def generate_story_questions(
    user_id: int,
    fork_point_id: int,
    session: AsyncSession,
) -> list[dict]:
    """Generate personalized story questions for a fork point."""
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise ValueError("Fork point not found")

    persona = await _get_latest_persona(user_id, session)
    persona_text = persona.persona_summary if persona else "（用户尚未生成画像）"

    template = await get_template("story_questions", session)
    prompt = render_template(template, {
        "persona": persona_text,
        "fork_title": fp.title,
        "actual_choice": fp.actual_choice,
        "alternative_choice": fp.alternative_choice,
    })

    data, _ = await call_llm_json([
        {"role": "system", "content": "你是一位故事策划师。请用 JSON 格式回复。"},
        {"role": "user", "content": prompt},
    ], temperature=0.8)

    return data.get("questions", [])


async def generate_life_blocks_stream(
    user_id: int,
    fork_point_id: int,
    session: AsyncSession,
    user_answers: list[dict] | None = None,
):
    """Stream life blocks, yielding structured SSE events.

    Events yielded (as dicts):
      {"type": "block_start", "index": n, "title": "..."}
      {"type": "content", "index": n, "text": "..."}
      {"type": "block_end", "index": n}
    """
    result = await session.execute(
        select(ForkPoint).where(ForkPoint.id == fork_point_id)
    )
    fp = result.scalar_one_or_none()
    if not fp:
        raise ValueError("Fork point not found")

    fp.status = ForkPointStatus.generating
    await session.flush()

    persona = await _get_latest_persona(user_id, session)
    persona_text = persona.persona_summary if persona else "（用户尚未生成画像）"

    quiz_answers_text = "（未提供）"
    if persona and persona.raw_input_data:
        qa = persona.raw_input_data.get("quiz_answers")
        if qa:
            quiz_answers_text = "\n".join(
                f"- {k}: {v if isinstance(v, str) else ', '.join(v)}"
                for k, v in qa.items()
            )

    template = await get_template("life_blocks", session)
    prompt = render_template(template, {
        "persona": persona_text,
        "fork_date": str(fp.happened_at) if fp.happened_at else "不确定",
        "fork_title": fp.title,
        "fork_description": fp.description or "",
        "actual_choice": fp.actual_choice,
        "alternative_choice": fp.alternative_choice,
        "quiz_answers": quiz_answers_text,
        "current_year": str(datetime.now().year),
    })

    if user_answers:
        answers_text = "\n".join(
            f"- {a.get('question', '?')}：{a.get('answer', '?')}"
            for a in user_answers
        )
        prompt += f"\n\n## 用户对故事的期望\n{answers_text}"

    # Include user memories (from past fork points they chose to add)
    mem_result = await session.execute(
        select(UserMemory).where(UserMemory.user_id == user_id).order_by(UserMemory.created_at.desc())
    )
    memories = mem_result.scalars().all()
    if memories:
        mem_text = "\n\n---\n\n".join(m.content for m in memories)
        prompt += f"\n\n## 用户过往选择加入的记忆（请作为理解用户的参考）\n{mem_text}"

    life = AlternativeLife(
        fork_point_id=fork_point_id,
        user_id=user_id,
        persona_snapshot_id=persona.id if persona else None,
        status=LifeStatus.generating,
        content_type="blocks",
    )
    session.add(life)
    await session.flush()

    task = GenerationTask(
        user_id=user_id,
        task_type=TaskType.story_generation,
        related_id=life.id,
        status=TaskStatus.processing,
        started_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.flush()
    await session.commit()

    full_text = ""
    buffer = ""
    current_block_index = 0
    current_block_title = ""
    block_started = False

    _BLOCK_MARKER = _re.compile(r"<!--\s*BLOCK\s+(\d+)\s*-->")
    _HEADING = _re.compile(r"^##\s+(.+)$", _re.MULTILINE)

    try:  # noqa: SIM105
        async for chunk in call_llm_stream(
            [
                {"role": "system", "content": "你是一位才华横溢的叙事作家。请用 Markdown 格式写故事，用 <!-- BLOCK n --> 分隔章节。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.9,
            max_tokens=12288,
            reasoning_split=True,
        ):
            full_text += chunk
            buffer += chunk

            # Try to detect block markers in buffer
            while True:
                marker_match = _BLOCK_MARKER.search(buffer)
                if not marker_match:
                    # No marker found; emit buffered content (keep tail for partial marker)
                    safe_len = len(buffer) - 20  # keep last 20 chars for partial "<!-- BLOCK"
                    if safe_len > 0 and block_started:
                        emit_text = buffer[:safe_len]
                        buffer = buffer[safe_len:]
                        if emit_text:
                            yield {"type": "content", "index": current_block_index, "text": emit_text}
                    break

                # Found a marker
                before_marker = buffer[:marker_match.start()]
                after_marker = buffer[marker_match.end():]
                new_index = int(marker_match.group(1))

                # Emit remaining content of previous block
                if block_started and before_marker.strip():
                    yield {"type": "content", "index": current_block_index, "text": before_marker}

                # End previous block
                if block_started:
                    yield {"type": "block_end", "index": current_block_index}

                current_block_index = new_index
                current_block_title = ""
                block_started = True
                buffer = after_marker

                # Try to extract heading from the beginning of after_marker
                heading_match = _HEADING.search(buffer)
                if heading_match and heading_match.start() < 100:
                    current_block_title = heading_match.group(1).strip()

                yield {"type": "block_start", "index": current_block_index, "title": current_block_title}

        # Flush remaining buffer
        if buffer.strip() and block_started:
            yield {"type": "content", "index": current_block_index, "text": buffer}

        if block_started:
            yield {"type": "block_end", "index": current_block_index}

        # ── Parse full_text into blocks for DB persistence ──
        parts = _BLOCK_MARKER.split(full_text)
        # parts: [preamble, "1", content1, "2", content2, ...]
        parsed_blocks: list[dict] = []
        for i in range(1, len(parts), 2):
            block_idx = int(parts[i])
            block_content = parts[i + 1] if i + 1 < len(parts) else ""
            block_title_match = _HEADING.search(block_content[:200])
            title = block_title_match.group(1).strip() if block_title_match else f"第{block_idx}章"
            parsed_blocks.append({"index": block_idx, "title": title, "content": block_content.strip()})

        # Save to DB
        life.story_markdown = full_text
        life.story_title = parsed_blocks[0]["title"] if parsed_blocks else fp.title
        life.overview = fp.title
        life.status = LifeStatus.completed
        if user_answers:
            life.generation_metadata = {"user_answers": user_answers}

        db_scenes: list[LifeScene] = []
        for pb in parsed_blocks:
            scene = LifeScene(
                alternative_life_id=life.id,
                scene_type="text",
                title=pb["title"],
                content=pb["content"],
                sort_order=pb["index"],
            )
            session.add(scene)
            db_scenes.append(scene)

        fp.status = ForkPointStatus.completed
        task.status = TaskStatus.completed
        task.output_data = {"block_count": len(parsed_blocks), "total_length": len(full_text)}
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        # scene.id values are now populated (expire_on_commit=False)

        # ── Generate story illustrations ──
        async for img_event in _plan_and_generate_images(
            user_id, parsed_blocks, db_scenes, session
        ):
            yield img_event

    except BaseException as e:
        # BaseException catches CancelledError (client disconnect) in addition to
        # regular exceptions, ensuring fp.status never stays stuck as 'generating'.
        life.status = LifeStatus.failed
        fp.status = ForkPointStatus.failed
        task.status = TaskStatus.failed
        task.error_message = str(e)
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()
        raise


async def _plan_and_generate_images(
    user_id: int,
    parsed_blocks: list[dict],
    db_scenes: list[LifeScene],
    session: AsyncSession,
):
    """Plan image prompts via LLM, concurrently generate + upload to OSS, update LifeScene.media_url.

    Yields SSE-compatible dicts:
      {"type": "image_generating", "count": N}
      {"type": "image_ready", "block_index": N, "scene_id": N, "image_url": "..."}
      {"type": "images_done"}

    Errors are logged and swallowed — illustrations are optional.
    """
    if not parsed_blocks or not db_scenes:
        return

    from app.services.image_gen_service import generate_image
    from app.services.oss_service import upload_from_url, new_key, sign_url

    # Fetch user's comic avatar URL (used as reference image for character consistency)
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    comic_avatar_url: str | None = user.comic_avatar_url if user else None

    # Sign the avatar URL so the external image generation API can fetch it
    if comic_avatar_url:
        try:
            comic_avatar_url = sign_url(comic_avatar_url, expires=3600)
        except Exception as e:
            logger.warning(f"Failed to sign comic avatar URL, falling back to text-to-image: {e}")
            comic_avatar_url = None

    # ── Step 1: Ask LLM to plan image prompts ──
    blocks_summary = "\n".join(
        f"Block {pb['index']}: {pb['title']}\n{pb['content'][:300]}..."
        for pb in parsed_blocks
    )
    plan_prompt = (
        f"You are a visual art director for a narrative story. "
        f"The story has {len(parsed_blocks)} chapters listed below.\n\n"
        f"{blocks_summary}\n\n"
        f"Design one illustration prompt per chapter. Requirements:\n"
        f"- Write prompts in English for best image quality\n"
        f"- Style: warm, delicate storybook illustration, soft watercolor tones\n"
        f"- Each prompt: describe scene, atmosphere, character's action/emotion, lighting\n"
        f"- Make prompts coherent across chapters (same character, consistent world)\n"
        f"- If a reference character image is provided, mention 'the same character'\n\n"
        f"Reply in JSON: {{\"image_plans\": ["
        f"{{\"block_index\": 1, \"prompt\": \"...\"}}, ...]}}"
    )

    try:
        plan_data, _ = await call_llm_json(
            [
                {"role": "system", "content": "You are a visual art director. Reply in JSON."},
                {"role": "user", "content": plan_prompt},
            ],
            temperature=0.7,
        )
        image_plans: list[dict] = plan_data.get("image_plans", [])
    except Exception as e:
        logger.error(f"Image planning LLM call failed: {e}")
        return

    if not image_plans:
        return

    yield {"type": "image_generating", "count": len(image_plans)}

    # Build a map: block_index → scene
    scene_by_index: dict[int, LifeScene] = {s.sort_order: s for s in db_scenes}

    # ── Step 2: Concurrently generate + upload images (max 2 at a time) ──
    sem = asyncio.Semaphore(2)

    async def _gen_one(plan: dict) -> dict | None:
        block_index = plan.get("block_index")
        prompt = plan.get("prompt", "")
        if not prompt or block_index is None:
            return None
        scene = scene_by_index.get(block_index)
        if scene is None:
            return None
        async with sem:
            try:
                img_url = await generate_image(
                    prompt=prompt,
                    reference_image_url=comic_avatar_url,
                )
                oss_key = new_key(f"story-images/{user_id}")
                oss_url = await upload_from_url(img_url, oss_key)
                return {"block_index": block_index, "scene_id": scene.id, "image_url": oss_url}
            except Exception as e:
                logger.error(f"Image generation failed for block {block_index}: {e}")
                return None

    results = await asyncio.gather(*[_gen_one(p) for p in image_plans])

    # ── Step 3: Persist image URLs and yield events ──
    for res in results:
        if res is None:
            continue
        scene = scene_by_index.get(res["block_index"])
        if scene:
            scene.media_url = res["image_url"]  # Store unsigned URL in DB
        # Send signed URL to frontend so it can display the image
        try:
            signed_image_url = sign_url(res["image_url"], expires=3600)
        except Exception:
            signed_image_url = res["image_url"]
        yield {
            "type": "image_ready",
            "block_index": res["block_index"],
            "scene_id": res["scene_id"],
            "image_url": signed_image_url,
        }

    try:
        await session.commit()
    except Exception as e:
        logger.error(f"Failed to persist image URLs: {e}")

    yield {"type": "images_done"}
