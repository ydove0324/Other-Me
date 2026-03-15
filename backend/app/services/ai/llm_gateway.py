from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    """Get or create a singleton AsyncOpenAI client configured for MiniMax."""
    global _client
    if _client is None:
        api_key = settings.AI_OPENAI_API_KEY
        if not api_key:
            raise RuntimeError("AI_OPENAI_API_KEY is not configured")
        _client = AsyncOpenAI(
            api_key=api_key,
            base_url=settings.AI_DEFAULT_API_BASE,
            timeout=settings.AI_TIMEOUT_SECONDS,
            max_retries=settings.AI_MAX_RETRIES,
        )
    return _client


def reset_client() -> None:
    """Reset the singleton client (useful for testing or config changes)."""
    global _client
    _client = None


async def call_llm(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.8,
    max_tokens: int = 4096,
    response_format: dict | None = None,
    reasoning_split: bool | None = None,
) -> dict[str, Any]:
    """
    Call an OpenAI-compatible chat completions endpoint (async).
    Returns a dict with 'content', 'reasoning', and 'usage' keys.
    """
    client = get_openai_client()
    model = model or settings.AI_DEFAULT_MODEL

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        kwargs["response_format"] = response_format

    use_reasoning = reasoning_split if reasoning_split is not None else settings.AI_REASONING_SPLIT
    if use_reasoning:
        kwargs["extra_body"] = {"reasoning_split": True}

    response = await client.chat.completions.create(**kwargs)

    message = response.choices[0].message
    result: dict[str, Any] = {
        "content": message.content or "",
        "reasoning": None,
        "raw_response": response,
    }

    # Extract reasoning if available
    if hasattr(message, "reasoning_details") and message.reasoning_details:
        reasoning_parts = []
        for detail in message.reasoning_details:
            if isinstance(detail, dict) and "text" in detail:
                reasoning_parts.append(detail["text"])
        if reasoning_parts:
            result["reasoning"] = "\n".join(reasoning_parts)

    # Extract usage
    usage = response.usage
    result["usage"] = {
        "prompt_tokens": usage.prompt_tokens if usage else 0,
        "completion_tokens": usage.completion_tokens if usage else 0,
        "total_tokens": usage.total_tokens if usage else 0,
        "model": response.model or model,
    }

    return result


def extract_content(response: dict) -> str:
    """Extract the assistant message content from a call_llm result."""
    return response["content"]


def extract_reasoning(response: dict) -> str | None:
    """Extract the reasoning/thinking content from a call_llm result."""
    return response.get("reasoning")


def extract_usage(response: dict) -> dict:
    """Extract token usage info."""
    return response.get("usage", {})


async def call_llm_stream(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.8,
    max_tokens: int = 4096,
    reasoning_split: bool | None = None,
) -> AsyncIterator[str]:
    """
    Streaming version of call_llm. Yields text chunks as they arrive.
    When reasoning_split is enabled, only content chunks are yielded (reasoning is skipped).
    Usage: async for chunk in call_llm_stream(...): ...
    """
    client = get_openai_client()
    model = model or settings.AI_DEFAULT_MODEL

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    use_reasoning = reasoning_split if reasoning_split is not None else settings.AI_REASONING_SPLIT
    if use_reasoning:
        kwargs["extra_body"] = {"reasoning_split": True}

    stream = await client.chat.completions.create(**kwargs)

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


def _clean_json(text: str) -> str:
    """Best-effort cleanup of LLM output into parseable JSON."""
    cleaned = text.strip()
    if not cleaned:
        raise json.JSONDecodeError("Empty response from LLM", cleaned, 0)
    # Strip markdown code fences
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
        cleaned = "\n".join(lines).strip()
    # Find first { or [ and last } or ]
    start = -1
    for i, ch in enumerate(cleaned):
        if ch in "{[":
            start = i
            break
    if start == -1:
        raise json.JSONDecodeError("No JSON object/array found", cleaned, 0)
    end = -1
    for i in range(len(cleaned) - 1, start - 1, -1):
        if cleaned[i] in "}]":
            end = i
            break
    if end == -1:
        raise json.JSONDecodeError("No closing bracket found", cleaned, 0)
    return cleaned[start:end + 1]


async def call_llm_json(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    max_retries: int = 2,
) -> tuple[Any, dict]:
    """
    Call LLM and parse response as JSON.
    Retries up to max_retries times on JSON parse failure.
    Returns (parsed_data, usage_info).
    """
    last_error: Exception | None = None

    for attempt in range(1 + max_retries):
        response = await call_llm(
            messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        content = extract_content(response)
        usage = extract_usage(response)

        try:
            data = json.loads(content)
            return data, usage
        except json.JSONDecodeError:
            pass

        # Try cleaning the content
        try:
            cleaned = _clean_json(content)
            data = json.loads(cleaned)
            return data, usage
        except json.JSONDecodeError as e:
            last_error = e
            logger.warning(
                f"LLM JSON parse failed (attempt {attempt + 1}/{1 + max_retries}): {e}. "
                f"Raw content (first 500 chars): {content[:500]!r}"
            )

    raise last_error  # type: ignore[misc]
