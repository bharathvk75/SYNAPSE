"""
SYNAPSE — CodeAnalyzer Agent
Deep static analysis: AST parsing, complexity metrics, best-practice checks,
performance smells, maintainability scoring.
"""
from __future__ import annotations

import ast
import re
import uuid
from typing import List

import structlog

from app.agents.base import BaseAgent
from app.graph.state import FileContext, SynapseState
from app.schemas import CodeIssue, IssueCategory, Severity

logger = structlog.get_logger(__name__)

CODE_ANALYZER_SYSTEM_PROMPT = """
You are SYNAPSE's CodeAnalyzer — a world-class static analysis engine powered by AI.

Your mission: perform exhaustive code quality analysis and return a structured JSON report.

Analyse for:
1. BUGS — null pointer dereferences, off-by-one errors, race conditions, unhandled exceptions, 
   unreachable code, logic errors, incorrect comparisons
2. PERFORMANCE — O(n²) loops hidden in library calls, unnecessary DB queries in loops (N+1), 
   blocking I/O in async context, memory leaks, inefficient data structures
3. MAINTAINABILITY — cyclomatic complexity > 10, functions > 50 lines, deep nesting > 4 levels,
   god classes, missing type hints (Python/TS), inconsistent naming, dead code, duplicate logic
4. BEST PRACTICES — language-specific idioms, framework conventions, error handling patterns,
   resource management (context managers, RAII), logging best practices
5. DOCUMENTATION — missing docstrings on public APIs, misleading comments, outdated TODOs

For each issue, provide:
- Exact file path and line numbers
- Clear, actionable title (max 10 words)
- Detailed description explaining WHY it is an issue
- Concrete suggestion for how to fix it
- A relevant code snippet showing the problematic code
- Confidence score (0.0–1.0)

CRITICAL RULES:
- Only report real issues. No false positives. Quality over quantity.
- If code is well-written, say so with fewer, lower-severity issues.
- Severity guidelines:
  * critical: will cause crashes, data loss, or incorrect behaviour in production
  * high: likely to cause bugs under normal usage
  * medium: code smell or suboptimal pattern that should be addressed
  * low: style/preference issues
  * info: suggestions for improvements

RESPOND WITH A VALID JSON OBJECT ONLY — no markdown fences, no preamble:
{
  "issues": [
    {
      "file_path": "path/to/file.py",
      "line_start": 42,
      "line_end": 45,
      "category": "bug|performance|maintainability|best_practice|style|documentation",
      "severity": "critical|high|medium|low|info",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the issue and why it matters",
      "suggestion": "Specific, actionable fix suggestion with example if helpful",
      "code_snippet": "the problematic code fragment",
      "confidence": 0.95,
      "rule_id": "CA001"
    }
  ],
  "quality_summary": "2-3 sentence summary of overall code quality"
}
"""


class CodeAnalyzerAgent(BaseAgent):
    """Deep code quality analysis using LLM + optional Python AST."""

    name = "code_analyzer"
    description = "Deep code analysis — bugs, performance, maintainability, best practices"
    emoji = "🔍"

    async def run(self, state: SynapseState) -> dict:
        state.mark_agent_start("code_analyzer")
        await self._emit_start(state)

        all_issues: List[CodeIssue] = list(state.issues)

        try:
            total_files = len(state.files)
            for idx, file_ctx in enumerate(state.files):
                progress = (idx / max(total_files, 1)) * 0.9
                await self._emit_progress(state, progress, f"Analysing {file_ctx.path}…")

                # Run language-specific local analysis
                local_issues = self._local_analysis(file_ctx)
                all_issues.extend(local_issues)

                # Run LLM analysis (batch files to save tokens)
                llm_issues = await self._llm_analysis(file_ctx)
                all_issues.extend(llm_issues)

            await self._emit_progress(state, 1.0, "Analysis complete")
            state.mark_agent_done("code_analyzer", 0)

            await self._emit_complete(state, f"Found {len(all_issues)} code quality issues")
            return {"issues": all_issues, "agent_states": state.agent_states}

        except Exception as exc:
            err = str(exc)
            self.logger.error("CodeAnalyzer failed", error=err)
            state.mark_agent_error("code_analyzer", err)
            await self._emit_error(state, err)
            return {"issues": all_issues, "agent_states": state.agent_states}

    # ── LLM analysis ──────────────────────────────────────────────────────────

    async def _llm_analysis(self, file_ctx: FileContext) -> List[CodeIssue]:
        """Ask the LLM to analyse the file and return structured issues."""
        code = self._truncate_code(file_ctx.content, max_lines=250)

        messages = [
            {"role": "system", "content": CODE_ANALYZER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Analyse this {file_ctx.language} file: {file_ctx.path}\n\n"
                    f"```{file_ctx.language}\n{code}\n```"
                ),
            },
        ]

        try:
            response, tokens = await self.llm.chat(messages, max_tokens=3000)
            parsed = self._extract_json_block(response) or {}
            raw_issues = parsed.get("issues", [])

            issues = []
            for r in raw_issues:
                try:
                    issue = CodeIssue(
                        id=str(uuid.uuid4())[:8],
                        file_path=r.get("file_path", file_ctx.path),
                        line_start=int(r.get("line_start", 1)),
                        line_end=r.get("line_end"),
                        category=IssueCategory(r.get("category", "maintainability")),
                        severity=Severity(r.get("severity", "medium")),
                        title=r.get("title", "Code issue"),
                        description=r.get("description", ""),
                        suggestion=r.get("suggestion", ""),
                        code_snippet=r.get("code_snippet"),
                        confidence=float(r.get("confidence", 0.8)),
                        rule_id=r.get("rule_id"),
                    )
                    issues.append(issue)
                except Exception:
                    continue
            return issues
        except Exception as exc:
            self.logger.warning("LLM analysis failed for file", file=file_ctx.path, error=str(exc))
            return []

    # ── Local AST / regex analysis ─────────────────────────────────────────────

    def _local_analysis(self, file_ctx: FileContext) -> List[CodeIssue]:
        """Run fast, deterministic checks without an LLM call."""
        issues: List[CodeIssue] = []

        if file_ctx.language == "python":
            issues.extend(self._python_ast_analysis(file_ctx))

        # Language-agnostic regex checks
        issues.extend(self._generic_checks(file_ctx))
        return issues

    def _python_ast_analysis(self, file_ctx: FileContext) -> List[CodeIssue]:
        """Python-specific AST checks."""
        issues: List[CodeIssue] = []
        try:
            tree = ast.parse(file_ctx.content)
        except SyntaxError as exc:
            issues.append(CodeIssue(
                id=str(uuid.uuid4())[:8],
                file_path=file_ctx.path,
                line_start=exc.lineno or 1,
                category=IssueCategory.BUG,
                severity=Severity.CRITICAL,
                title="Python syntax error",
                description=f"File contains a syntax error: {exc.msg}",
                suggestion="Fix the syntax error before continuing.",
                confidence=1.0,
                rule_id="PY-SYNTAX",
            ))
            return issues

        for node in ast.walk(tree):
            # Check function complexity (line count proxy)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func_lines = (node.end_lineno or node.lineno) - node.lineno
                if func_lines > 60:
                    issues.append(CodeIssue(
                        id=str(uuid.uuid4())[:8],
                        file_path=file_ctx.path,
                        line_start=node.lineno,
                        line_end=node.end_lineno,
                        category=IssueCategory.MAINTAINABILITY,
                        severity=Severity.MEDIUM,
                        title=f"Function '{node.name}' is too long ({func_lines} lines)",
                        description=(
                            f"The function `{node.name}` spans {func_lines} lines. "
                            "Functions longer than 60 lines are hard to reason about, test, and maintain."
                        ),
                        suggestion=(
                            "Extract logical sub-steps into well-named helper functions. "
                            "Aim for functions under 40 lines."
                        ),
                        confidence=0.95,
                        rule_id="PY-FUNC-LEN",
                    ))

                # Missing return type annotation
                if node.returns is None and not node.name.startswith("_test"):
                    issues.append(CodeIssue(
                        id=str(uuid.uuid4())[:8],
                        file_path=file_ctx.path,
                        line_start=node.lineno,
                        category=IssueCategory.BEST_PRACTICE,
                        severity=Severity.LOW,
                        title=f"Missing return type hint on '{node.name}'",
                        description=f"Function `{node.name}` has no return type annotation.",
                        suggestion=f"Add a return type: `def {node.name}(...) -> ReturnType:`",
                        confidence=0.9,
                        rule_id="PY-TYPE-HINT",
                    ))

            # Bare except
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                issues.append(CodeIssue(
                    id=str(uuid.uuid4())[:8],
                    file_path=file_ctx.path,
                    line_start=node.lineno,
                    category=IssueCategory.BUG,
                    severity=Severity.HIGH,
                    title="Bare `except:` clause catches all exceptions",
                    description=(
                        "A bare `except:` swallows ALL exceptions including `SystemExit` and `KeyboardInterrupt`. "
                        "This can hide bugs and make debugging extremely difficult."
                    ),
                    suggestion="Specify the exception type(s): `except (ValueError, TypeError) as exc:`",
                    code_snippet="except:",
                    confidence=1.0,
                    rule_id="PY-BARE-EXCEPT",
                ))

            # mutable default argument
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for default in node.args.defaults + node.args.kw_defaults:
                    if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                        issues.append(CodeIssue(
                            id=str(uuid.uuid4())[:8],
                            file_path=file_ctx.path,
                            line_start=node.lineno,
                            category=IssueCategory.BUG,
                            severity=Severity.HIGH,
                            title=f"Mutable default argument in '{node.name}'",
                            description=(
                                "Mutable default arguments (list, dict, set) are shared across all calls "
                                "to the function — a classic Python gotcha that causes subtle bugs."
                            ),
                            suggestion="Use `None` as the default and initialise inside the function:\n"
                                       "  `def fn(items=None):\\n      if items is None: items = []`",
                            confidence=1.0,
                            rule_id="PY-MUTABLE-DEFAULT",
                        ))

        return issues

    def _generic_checks(self, file_ctx: FileContext) -> List[CodeIssue]:
        """Language-agnostic regex checks applied to all files."""
        issues: List[CodeIssue] = []
        lines = file_ctx.content.splitlines()

        patterns = [
            # TODO / FIXME / HACK
            (r"(?i)\b(TODO|FIXME|HACK|XXX|BUG)\b.*", IssueCategory.DOCUMENTATION, Severity.LOW,
             "Unresolved TODO/FIXME in code",
             "Address the TODO or create a tracked issue.",
             "CA-TODO", 0.7),
            # print statements in Python
            (r"^\s*print\(", IssueCategory.BEST_PRACTICE, Severity.LOW,
             "Debug print() statement left in code",
             "Replace print() with structured logging (e.g. logging.debug or structlog).",
             "CA-PRINT", 0.85) if file_ctx.language == "python" else None,
            # console.log in JS/TS
            (r"console\.(log|debug|warn)\(", IssueCategory.BEST_PRACTICE, Severity.LOW,
             "console.log() debug statement in production code",
             "Remove or replace with a proper logging library.",
             "CA-CONSOLE-LOG", 0.85) if file_ctx.language in ("javascript", "typescript") else None,
            # hardcoded passwords (generic)
            (r'(?i)(password|passwd|pwd|secret|api_key)\s*=\s*["\'].{4,}["\']',
             IssueCategory.SECURITY, Severity.CRITICAL,
             "Hardcoded credential detected",
             "Move credentials to environment variables or a secrets manager.",
             "CA-HARDCODED-CRED", 0.9),
        ]

        for line_no, line in enumerate(lines, start=1):
            for pattern_entry in patterns:
                if pattern_entry is None:
                    continue
                pattern, category, severity, title, suggestion, rule_id, confidence = pattern_entry
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        id=str(uuid.uuid4())[:8],
                        file_path=file_ctx.path,
                        line_start=line_no,
                        category=category,
                        severity=severity,
                        title=title,
                        description=f"Found on line {line_no}: `{line.strip()[:80]}`",
                        suggestion=suggestion,
                        code_snippet=line.strip()[:120],
                        confidence=confidence,
                        rule_id=rule_id,
                    ))

        # Very long lines
        for line_no, line in enumerate(lines, start=1):
            if len(line) > 200:
                issues.append(CodeIssue(
                    id=str(uuid.uuid4())[:8],
                    file_path=file_ctx.path,
                    line_start=line_no,
                    category=IssueCategory.STYLE,
                    severity=Severity.INFO,
                    title=f"Line {line_no} exceeds 200 characters ({len(line)} chars)",
                    description="Extremely long lines reduce readability and make code review harder.",
                    suggestion="Break the line into multiple shorter lines.",
                    confidence=1.0,
                    rule_id="CA-LINE-LEN",
                ))

        return issues
