"""Canopy chat agent — Groq streaming with 429 fallback."""
from __future__ import annotations

import os
from typing import AsyncIterator

from groq import AsyncGroq, APIStatusError

_DEFAULT_MODEL = "llama-3.3-70b-versatile"

# Models known NOT to support function/tool calling (unused here, kept for parity).
_NO_TOOL_MODELS: set[str] = {"llama-3.2-1b-preview", "llama-3.2-3b-preview"}

# On 429, retry through this chain after the configured model.
_FALLBACK_CHAIN = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]


def agent_model() -> str:
    return os.getenv("CANOPY_AGENT_MODEL", _DEFAULT_MODEL).strip() or _DEFAULT_MODEL


def _client() -> AsyncGroq:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return AsyncGroq(api_key=api_key)


async def stream_agent(
    *,
    messages: list[dict],
    model: str | None = None,
) -> AsyncIterator[dict]:
    """Yield {delta: str} or {error: str} events."""
    client = _client()
    effective_model = model or agent_model()
    chain = [effective_model] + [m for m in _FALLBACK_CHAIN if m != effective_model]

    last_exc: APIStatusError | None = None
    stream = None
    for model_id in chain:
        try:
            stream = await client.chat.completions.create(
                model=model_id,
                messages=messages,
                max_tokens=1024,
                temperature=0.7,
                stream=True,
            )
            break
        except APIStatusError as exc:
            if exc.status_code == 429:
                last_exc = exc
                continue
            yield {"error": str(exc)}
            return
        except Exception as exc:
            yield {"error": str(exc)}
            return

    if stream is None:
        yield {"error": "Rate limit reached on all available models. Try again later."}
        return

    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield {"delta": delta}
