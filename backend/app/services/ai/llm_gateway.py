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


async def call_llm_json(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> tuple[Any, dict]:
    """
    Call LLM and parse response as JSON.
    Returns (parsed_data, usage_info).
    """
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
    except json.JSONDecodeError:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        data = json.loads(cleaned)

    return data, usage
