"""
SYNAPSE — TestGenerator Agent
Identifies untested code paths, suggests unit/integration/property tests,
and generates ready-to-run test code in the appropriate framework.
"""
from __future__ import annotations

import uuid
from typing import List

import structlog

from app.agents.base import BaseAgent
from app.graph.state import FileContext, SynapseState
from app.schemas import TestSuggestion

logger = structlog.get_logger(__name__)

TEST_GEN_SYSTEM_PROMPT = """
You are SYNAPSE's TestGenerator — a Principal Engineer specialising in software testing.

Your mission: identify gaps in test coverage and generate production-quality test code.

Framework selection:
- Python → pytest (prefer pytest-asyncio for async, hypothesis for property tests)
- JavaScript/TypeScript → Jest / Vitest
- Go → testing package + testify
- Java → JUnit 5
- Rust → built-in #[test] + proptest
- Generic → describe the test structure

For EACH test you suggest:
1. Identify the function/method/component under test
2. Classify the test type: unit | integration | e2e | property | snapshot | mutation
3. Explain what gap it fills (happy path, edge case, error path, boundary)
4. Generate COMPLETE, runnable test code (not pseudocode)
5. Rate the priority: high (critical path, security-sensitive), medium (normal flow), low (edge case)

RESPOND WITH VALID JSON ONLY:
{
  "test_suggestions": [
    {
      "file_path": "path/to/file.py",
      "function_name": "the_function_being_tested",
      "test_type": "unit|integration|e2e|property",
      "description": "What this test covers and why it matters",
      "test_code": "# Complete runnable test code here",
      "priority": "high|medium|low",
      "coverage_gap": "What gap this fills (e.g., 'missing error path test for invalid input')"
    }
  ],
  "coverage_assessment": "Brief assessment of current test coverage"
}
"""

# Framework detection heuristics
FRAMEWORK_HINTS = {
    "python": {
        "django": ["from django", "Django", "models.Model"],
        "fastapi": ["from fastapi", "FastAPI", "APIRouter"],
        "flask": ["from flask", "Flask"],
        "sqlalchemy": ["from sqlalchemy", "Session", "Column"],
        "pydantic": ["from pydantic", "BaseModel"],
    },
    "typescript": {
        "react": ["import React", "useState", "useEffect", "jsx"],
        "express": ["express()", "app.get", "app.post", "Router"],
        "nestjs": ["@Controller", "@Injectable", "@Module"],
        "nextjs": ["getServerSideProps", "getStaticProps", "NextPage"],
    },
}


class TestGeneratorAgent(BaseAgent):
    """Identifies test coverage gaps and generates ready-to-run tests."""

    name = "test_generator"
    description = "Test gap analysis & automated test generation"
    emoji = "🧪"

    async def run(self, state: SynapseState) -> dict:
        if not state.request.enable_tests:
            return {}

        state.mark_agent_start("test_generator")
        await self._emit_start(state)

        all_suggestions: List[TestSuggestion] = list(state.test_suggestions)

        try:
            total = len(state.files)
            for idx, file_ctx in enumerate(state.files):
                # Skip test files themselves
                if any(x in file_ctx.path for x in ["test_", "_test.", ".spec.", ".test."]):
                    continue

                progress = (idx / max(total, 1)) * 0.9
                await self._emit_progress(state, progress, f"Generating tests for {file_ctx.path}…")

                suggestions = await self._generate_tests(file_ctx)
                all_suggestions.extend(suggestions)

            await self._emit_progress(state, 1.0, "Test generation complete")
            state.mark_agent_done("test_generator", 0)
            await self._emit_complete(state, f"Generated {len(all_suggestions)} test suggestions")
            return {"test_suggestions": all_suggestions, "agent_states": state.agent_states}

        except Exception as exc:
            err = str(exc)
            self.logger.error("TestGenerator failed", error=err)
            state.mark_agent_error("test_generator", err)
            await self._emit_error(state, err)
            return {"test_suggestions": all_suggestions, "agent_states": state.agent_states}

    async def _generate_tests(self, file_ctx: FileContext) -> List[TestSuggestion]:
        """Use LLM to generate test suggestions for a file."""
        code = self._truncate_code(file_ctx.content, max_lines=200)
        framework_hint = self._detect_frameworks(file_ctx)

        messages = [
            {"role": "system", "content": TEST_GEN_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Generate test suggestions for this {file_ctx.language} file: {file_ctx.path}\n"
                    + (f"Detected frameworks/libraries: {framework_hint}\n" if framework_hint else "")
                    + f"\n```{file_ctx.language}\n{code}\n```\n\n"
                    "Focus on the 3-5 most important test gaps. Respond with JSON only."
                ),
            },
        ]

        try:
            response, tokens = await self.llm.chat(messages, max_tokens=3000)
            parsed = self._extract_json_block(response) or {}
            raw = parsed.get("test_suggestions", [])

            suggestions = []
            for r in raw:
                try:
                    s = TestSuggestion(
                        id=str(uuid.uuid4())[:8],
                        file_path=r.get("file_path", file_ctx.path),
                        function_name=r.get("function_name", "unknown"),
                        test_type=r.get("test_type", "unit"),
                        description=r.get("description", ""),
                        test_code=r.get("test_code", "# Test code not generated"),
                        priority=r.get("priority", "medium"),
                        coverage_gap=r.get("coverage_gap", ""),
                    )
                    suggestions.append(s)
                except Exception:
                    continue
            return suggestions
        except Exception as exc:
            self.logger.warning("Test generation failed", file=file_ctx.path, error=str(exc))
            return []

    def _detect_frameworks(self, file_ctx: FileContext) -> str:
        """Quick framework detection for better test suggestions."""
        lang = file_ctx.language
        detected = []
        hints = FRAMEWORK_HINTS.get(lang, {})
        for fw, patterns in hints.items():
            if any(p in file_ctx.content for p in patterns):
                detected.append(fw)
        return ", ".join(detected) if detected else ""
