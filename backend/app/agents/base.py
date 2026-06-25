"""
SYNAPSE — BaseAgent
Abstract base class every specialist agent inherits from.
"""
from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Callable, Coroutine, Dict, Optional

import structlog

from app.graph.state import SynapseState


class BaseAgent(ABC):
    """Abstract base for all SYNAPSE agents."""

    name: str = "base"
    description: str = "Base agent"
    emoji: str = "🤖"

    def __init__(self) -> None:
        self.logger = structlog.get_logger(f"synapse.agent.{self.name}")
        self._llm: Optional[Any] = None

    # ── LLM lazy property ──────────────────────────────────────────────────────
    @property
    def llm(self):
        if self._llm is None:
            from app.services.llm_service import LLMService  # noqa: PLC0415

            self._llm = LLMService()
        return self._llm

    # ── Abstract interface ─────────────────────────────────────────────────────
    @abstractmethod
    async def run(self, state: SynapseState) -> dict:
        """Execute the agent.  Returns a dict of SynapseState field updates."""
        ...

    # ── Event helpers ──────────────────────────────────────────────────────────
    async def _emit(self, state: SynapseState, event_type: str, data: Dict[str, Any]) -> None:
        cb: Optional[Callable[..., Coroutine]] = getattr(state, "stream_callback", None)
        if cb is None:
            return
        try:
            await cb(event_type, {"agent": self.name, **data})
        except Exception as exc:
            self.logger.warning("Event emit failed", error=str(exc))

    async def _emit_start(self, state: SynapseState) -> None:
        await self._emit(
            state,
            "agent_start",
            {
                "name": self.name,
                "description": self.description,
                "emoji": self.emoji,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    async def _emit_progress(self, state: SynapseState, progress: float, task: str = "") -> None:
        await self._emit(state, "agent_progress", {"progress": progress, "task": task})

    async def _emit_complete(self, state: SynapseState, result_summary: str = "") -> None:
        await self._emit(
            state,
            "agent_complete",
            {"result_summary": result_summary, "timestamp": datetime.utcnow().isoformat()},
        )

    async def _emit_error(self, state: SynapseState, error: str) -> None:
        await self._emit(state, "agent_error", {"error": error})

    async def _emit_hermes_message(self, state: SynapseState, content: str) -> None:
        await self._emit(state, "hermes_message", {"content": content, "role": "hermes"})

    async def _stream_tokens(self, state: SynapseState, text: str) -> None:
        """Simulate token streaming for a pre-generated text block."""
        words = text.split()
        buffer = ""
        for i, word in enumerate(words):
            buffer += word + " "
            if i % 5 == 4 or i == len(words) - 1:
                await self._emit(state, "stream_token", {"token": buffer.rstrip() + " "})
                buffer = ""

    # ── Utility helpers ────────────────────────────────────────────────────────
    @staticmethod
    def _extract_json_block(text: str) -> Optional[dict]:
        """Extract the first JSON object/array from a raw LLM response string."""
        match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        # Fallback: find the first '{' ... last '}'
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
        return None

    @staticmethod
    def _detect_language(file_path: str, content: str) -> str:
        ext_map = {
            ".py": "python", ".js": "javascript", ".ts": "typescript",
            ".tsx": "typescript", ".jsx": "javascript", ".go": "go",
            ".rs": "rust", ".java": "java", ".cs": "csharp", ".cpp": "cpp",
            ".c": "c", ".rb": "ruby", ".php": "php", ".swift": "swift",
            ".kt": "kotlin", ".sh": "bash", ".yaml": "yaml", ".yml": "yaml",
            ".json": "json", ".html": "html", ".css": "css", ".sql": "sql",
            ".md": "markdown", ".toml": "toml", ".env": "env",
        }
        if "." in file_path:
            ext = "." + file_path.rsplit(".", 1)[-1].lower()
            if ext in ext_map:
                return ext_map[ext]
        # Shebang detection
        first_line = content.split("\n")[0] if content else ""
        if "python" in first_line:
            return "python"
        if "node" in first_line or "javascript" in first_line:
            return "javascript"
        if "bash" in first_line or "sh" in first_line:
            return "bash"
        return "unknown"

    def _truncate_code(self, code: str, max_lines: int = 300) -> str:
        lines = code.split("\n")
        if len(lines) <= max_lines:
            return code
        half = max_lines // 2
        return "\n".join(lines[:half] + ["", "# ... (truncated for context) ...", ""] + lines[-half:])
