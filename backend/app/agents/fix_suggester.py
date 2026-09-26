"""
SYNAPSE — FixSuggester Agent
Consolidates all findings from CodeAnalyzer + SecurityScanner and generates
concrete, diff-backed fix suggestions that can be auto-applied with approval.
"""
from __future__ import annotations

import uuid
from typing import List

import structlog

from app.agents.base import BaseAgent
from app.graph.state import FileContext, SynapseState
from app.schemas import FixSuggestion, Severity

logger = structlog.get_logger(__name__)

FIX_SUGGESTER_SYSTEM_PROMPT = """
You are SYNAPSE's FixSuggester — a world-class refactoring engineer.

You receive a list of code issues and security vulnerabilities for a file, along with the
original source code. Your job is to produce CONCRETE, COMPLETE fix suggestions.

For each significant issue (critical/high severity), generate:
1. The EXACT original code snippet causing the problem
2. The COMPLETE fixed code that replaces it
3. A unified diff showing the change
4. A clear explanation of what was changed and why
5. Whether the fix is safe to auto-apply (auto_applicable: true) or requires manual review

RULES:
- Each fix must be minimal — change only what's needed to fix the issue
- Fixes must be syntactically correct and runnable
- For security fixes, always prefer the most robust solution
- If multiple issues affect the same code block, produce ONE combined fix
- Mark auto_applicable=true ONLY when the fix is safe, deterministic, and well-understood
- Do NOT auto-apply fixes that change business logic or require architectural decisions

UNIFIED DIFF FORMAT (standard format):
```
--- a/path/to/file.py
+++ b/path/to/file.py
@@ -42,7 +42,7 @@
 context line
-old line
+new line
 context line
```

RESPOND WITH VALID JSON ONLY:
{
  "fixes": [
    {
      "issue_ids": ["id1", "id2"],
      "file_path": "path/to/file.py",
      "original_code": "the exact original code block",
      "fixed_code": "the complete replacement code block",
      "diff": "unified diff string",
      "explanation": "What was changed and why this is the correct fix",
      "confidence": 0.95,
      "auto_applicable": true
    }
  ]
}
"""


class FixSuggesterAgent(BaseAgent):
    """Generates diff-backed fix suggestions for all discovered issues."""

    name = "fix_suggester"
    description = "Automated fix generation with diffs for all discovered issues"
    emoji = "🔧"

    async def run(self, state: SynapseState) -> dict:
        if not state.request.enable_fixes:
            return {}

        state.mark_agent_start("fix_suggester")
        await self._emit_start(state)

        all_fixes: List[FixSuggestion] = list(state.fix_suggestions)

        try:
            # Group issues by file
            files_with_issues = {}
            for issue in state.issues:
                if issue.severity.value in ("critical", "high", "medium"):
                    files_with_issues.setdefault(issue.file_path, []).append(issue)

            for vuln in state.vulnerabilities:
                if vuln.severity.value in ("critical", "high"):
                    files_with_issues.setdefault(vuln.file_path, []).append(vuln)

            total = len(files_with_issues)
            for idx, (file_path, issues) in enumerate(files_with_issues.items()):
                progress = (idx / max(total, 1)) * 0.9
                await self._emit_progress(state, progress, f"Generating fixes for {file_path}…")

                # Find the FileContext for this path
                file_ctx = next((f for f in state.files if f.path == file_path), None)
                if file_ctx is None:
                    continue

                fixes = await self._generate_fixes(file_ctx, issues)
                all_fixes.extend(fixes)

            await self._emit_progress(state, 1.0, "Fix generation complete")
            state.mark_agent_done("fix_suggester", 0)
            await self._emit_complete(state, f"Generated {len(all_fixes)} fix suggestions")
            return {"fix_suggestions": all_fixes, "agent_states": state.agent_states}

        except Exception as exc:
            err = str(exc)
            self.logger.error("FixSuggester failed", error=err)
            state.mark_agent_error("fix_suggester", err)
            await self._emit_error(state, err)
            return {"fix_suggestions": all_fixes, "agent_states": state.agent_states}

    async def _generate_fixes(self, file_ctx: FileContext, issues: list) -> List[FixSuggestion]:
        """Generate fixes for a specific file given its issues."""
        code = self._truncate_code(file_ctx.content, max_lines=250)

        # Build issue digest
        issue_digest = []
        issue_ids = []
        for issue in issues[:10]:  # Cap at 10 per file
            issue_ids.append(issue.id)
            title = getattr(issue, "title", "Issue")
            desc = getattr(issue, "description", "")
            sev = issue.severity.value if hasattr(issue.severity, "value") else str(issue.severity)
            line = getattr(issue, "line_start", 0)
            issue_digest.append(f"- [{sev.upper()}] Line {line}: {title}\n  {desc[:200]}")

        issues_text = "\n".join(issue_digest)

        messages = [
            {"role": "system", "content": FIX_SUGGESTER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Generate fixes for these issues in {file_ctx.path} ({file_ctx.language}):\n\n"
                    f"ISSUES:\n{issues_text}\n\n"
                    f"SOURCE CODE:\n```{file_ctx.language}\n{code}\n```\n\n"
                    "Generate fixes for the most impactful issues. Respond with JSON only."
                ),
            },
        ]

        try:
            response, tokens = await self.llm.chat(messages, max_tokens=3500)
            parsed = self._extract_json_block(response) or {}
            raw = parsed.get("fixes", [])

            fixes = []
            from app.services.patch_verifier import patch_verifier

            for r in raw:
                try:
                    orig_code = r.get("original_code", "")
                    fixed_code = r.get("fixed_code", "")
                    diff_str = r.get("diff", self._generate_simple_diff(
                        orig_code,
                        fixed_code,
                        file_ctx.path,
                    ))

                    # Automated Sandbox & AST Verification
                    v_res = patch_verifier.verify_fix(
                        original_code=orig_code,
                        fixed_code=fixed_code,
                        file_path=file_ctx.path,
                        diff=diff_str,
                        language=file_ctx.language,
                    )
                    conf = max(0.1, min(1.0, float(r.get("confidence", 0.85)) + v_res["confidence_modifier"]))

                    fix = FixSuggestion(
                        id=str(uuid.uuid4())[:8],
                        issue_ids=r.get("issue_ids", issue_ids[:2]),
                        file_path=r.get("file_path", file_ctx.path),
                        original_code=orig_code,
                        fixed_code=fixed_code,
                        diff=diff_str,
                        explanation=r.get("explanation", ""),
                        confidence=conf,
                        auto_applicable=bool(r.get("auto_applicable", False) and v_res["ast_valid"]),
                        ast_valid=v_res["ast_valid"],
                        verification_status=v_res["verification_status"],
                        verification_notes=v_res["verification_notes"],
                    )
                    fixes.append(fix)
                except Exception:
                    continue
            return fixes
        except Exception as exc:
            self.logger.warning("Fix generation failed", file=file_ctx.path, error=str(exc))
            return []

    @staticmethod
    def _generate_simple_diff(original: str, fixed: str, path: str) -> str:
        """Generate a minimal unified diff without external tools."""
        orig_lines = original.splitlines(keepends=True)
        fix_lines = fixed.splitlines(keepends=True)

        header = f"--- a/{path}\n+++ b/{path}\n"
        chunk = "@@ -1,{} +1,{} @@\n".format(len(orig_lines), len(fix_lines))
        removed = "".join(f"-{line}" for line in orig_lines)
        added = "".join(f"+{line}" for line in fix_lines)
        return header + chunk + removed + added
