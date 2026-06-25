"""
SYNAPSE — Universal LLM Service (powered by LiteLLM)
Supports: Ollama · LM Studio · OpenAI · Anthropic · Gemini · Groq · Cohere · Azure · DeepSeek
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator, List, Optional, Tuple

import litellm
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings

logger = structlog.get_logger(__name__)

# LiteLLM global config
litellm.set_verbose = False
litellm.drop_params = True  # Silently drop params not supported by a provider
litellm.request_timeout = settings.llm_timeout


class LLMService:
    """
    Single entry-point to ANY LLM.
    LiteLLM translates the unified API to each provider's native format.
    """

    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.provider = provider or settings.llm_provider
        self.model = model
        self.logger = structlog.get_logger(self.__class__.__name__)

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _cfg(self, provider: Optional[str] = None, model: Optional[str] = None) -> dict:
        """Resolve the LiteLLM call kwargs for the given provider/model."""
        p = provider or self.provider
        cfg = settings.get_llm_config(p)
        if model:
            if p == "ollama":
                cfg["model"] = f"ollama/{model}"
            elif p in ("lmstudio", "deepseek"):
                cfg["model"] = f"openai/{model}"
            else:
                cfg["model"] = model
        elif self.model:
            if p == "ollama":
                cfg["model"] = f"ollama/{self.model}"
            elif p in ("lmstudio", "deepseek"):
                cfg["model"] = f"openai/{self.model}"
            else:
                cfg["model"] = self.model
        return cfg

    # ── Primary chat method ────────────────────────────────────────────────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=20),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def chat(
        self,
        messages: List[dict],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Tuple[str, int]:
        """
        Blocking (non-streaming) chat call.
        Returns (response_text, total_tokens_used).
        """
        cfg = self._cfg(provider, model)
        if temperature is not None:
            cfg["temperature"] = temperature
        if max_tokens is not None:
            cfg["max_tokens"] = max_tokens

        self.logger.debug("LLM chat", model=cfg.get("model"), msgs=len(messages))

        response = await litellm.acompletion(messages=messages, stream=False, **cfg)
        content: str = response.choices[0].message.content or ""
        tokens: int = getattr(getattr(response, "usage", None), "total_tokens", 0) or 0
        return content, tokens

    # ── Streaming method ───────────────────────────────────────────────────────

    async def stream_chat(
        self,
        messages: List[dict],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
    ) -> AsyncIterator[str]:
        """Async generator that yields token chunks as they arrive."""
        cfg = self._cfg(provider, model)
        if temperature is not None:
            cfg["temperature"] = temperature

        response = await litellm.acompletion(messages=messages, stream=True, **cfg)

        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content

    # ── Hermes-specific chat ───────────────────────────────────────────────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=20),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def hermes_chat(
        self,
        messages: List[dict],
        temperature: Optional[float] = None,
    ) -> Tuple[str, int]:
        """Use the Hermes-dedicated LLM config (may differ from the reviewer model)."""
        cfg = settings.get_hermes_config()
        if temperature is not None:
            cfg["temperature"] = temperature

        response = await litellm.acompletion(messages=messages, stream=False, **cfg)
        content = response.choices[0].message.content or ""
        tokens = getattr(getattr(response, "usage", None), "total_tokens", 0) or 0
        return content, tokens

    async def hermes_stream(
        self,
        messages: List[dict],
    ) -> AsyncIterator[str]:
        """Streaming version of hermes_chat."""
        cfg = settings.get_hermes_config()
        response = await litellm.acompletion(messages=messages, stream=True, **cfg)
        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content

    # ── Utility ────────────────────────────────────────────────────────────────

    async def check_connection(self, provider: Optional[str] = None) -> dict:
        """Ping the LLM and return latency + model info."""
        import time

        start = time.perf_counter()
        try:
            _, tokens = await self.chat(
                [{"role": "user", "content": "Reply with exactly: SYNAPSE_OK"}],
                provider=provider,
                max_tokens=16,
                temperature=0.0,
            )
            latency_ms = int((time.perf_counter() - start) * 1000)
            return {"status": "ok", "latency_ms": latency_ms, "provider": provider or self.provider}
        except Exception as exc:
            return {"status": "error", "error": str(exc), "provider": provider or self.provider}

    async def count_tokens(
        self, messages: List[dict], provider: Optional[str] = None
    ) -> int:
        """Estimate token usage without making a real call."""
        try:
            cfg = self._cfg(provider)
            return litellm.token_counter(model=cfg.get("model", "gpt-3.5-turbo"), messages=messages)
        except Exception:
            total_chars = sum(len(str(m.get("content", ""))) for m in messages)
            return total_chars // 4  # rough 4-char-per-token estimate

    async def list_ollama_models(self) -> List[str]:
        """Query local Ollama for available model names."""
        import httpx

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{settings.ollama_base_url}/api/tags")
                resp.raise_for_status()
                return [m["name"] for m in resp.json().get("models", [])]
        except Exception:
            return []

    async def list_lmstudio_models(self) -> List[str]:
        """Query local LM Studio for loaded models."""
        import httpx

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{settings.lmstudio_base_url}/models",
                    headers={"Authorization": f"Bearer {settings.lmstudio_api_key}"},
                )
                resp.raise_for_status()
                return [m["id"] for m in resp.json().get("data", [])]
        except Exception:
            return []
