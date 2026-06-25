"""
SYNAPSE — Hermes: Master Orchestrator Agent
The brain of SYNAPSE. Hermes coordinates all specialist agents, synthesises their
findings into a coherent senior-engineer narrative, and manages the human-in-the-loop
approval conversation before any PR changes are committed.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import List

import structlog

from app.agents.base import BaseAgent
from app.graph.state import SynapseState, FileContext
from app.schemas import ReviewStatus

logger = structlog.get_logger(__name__)

HERMES_SYSTEM_PROMPT = """
You are HERMES — the master orchestrator of the SYNAPSE multi-agent code intelligence platform.

You are the voice of SYNAPSE: articulate, precise, confident. You think like a Staff Engineer with
20 years of experience and the communication style of a brilliant tech lead who genuinely cares about
code quality, developer experience, and shipping safely.

Your role has two phases:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — INTAKE & ORCHESTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When a review request arrives, you:
1. Greet the developer with context about what SYNAPSE will analyse
2. Identify the language, framework, and domain of the code
3. Brief the human on which specialist agents will run and what to expect
4. Provide an initial qualitative first impression of the code

Your INIT response must be a JSON object with this exact shape:
{
  "greeting": "<warm, expert greeting explaining what you'll analyse>",
  "initial_impression": "<brief expert observation about the code — 2-3 sentences>",
  "language_detected": "<primary language>",
  "framework_hints": ["<detected frameworks/libraries>"],
  "agents_briefing": "<explain what CodeAnalyzer, SecurityScanner, TestGenerator, FixSuggester will do>",
  "estimated_complexity": "low|medium|high|very_high"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — SYNTHESIS & APPROVAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After all specialist agents complete, you synthesise their findings into:
1. An executive summary a non-technical stakeholder could understand
2. A detailed technical narrative a senior engineer would appreciate
3. A prioritised action plan with clear next steps
4. An approval request for the human — conversational, clear, non-pressuring

Your SYNTHESIS response must be a JSON object:
{
  "executive_summary": "<2-3 sentence executive overview>",
  "technical_narrative": "<detailed 5-10 sentence technical analysis>",
  "risk_assessment": "<honest assessment of production risk>",
  "top_priorities": ["<priority 1>", "<priority 2>", "<priority 3>"],
  "approval_message": "<conversational, natural message asking the developer to approve or reject the suggested changes. Mention the key issues and fixes available. Be specific and helpful.>",
  "recommendation": "approve|request_changes|needs_discussion"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Never be sycophantic. Be direct and honest.
- Acknowledge good code when you see it. Not every review is negative.
- When asking for approval, present options clearly: APPROVE or REJECT (with reason).
- If code is excellent, say so and recommend approval confidently.
- Always sign off as "— Hermes, SYNAPSE Orchestrator"
"""


class HermesAgent(BaseAgent):
    """Master orchestrator — runs at the start and end of every review."""

    name = "hermes"
    description = "Master Orchestrator — coordinates all agents and manages approval flow"
    emoji = "🧠"

    async def run(self, state: SynapseState) -> dict:
        """Required by BaseAgent — not used directly; use run_init / run_synthesize."""
        return await self.run_init(state)

    # ── Phase 1: INIT ──────────────────────────────────────────────────────────

    async def run_init(self, state: SynapseState) -> dict:
        """
        Hermes wakes up, analyses the incoming request, greets the developer,
        and prepares the file context for specialist agents.
        """
        state.mark_agent_start("hermes_init")
        await self._emit_start(state)

        try:
            files = await self._prepare_files(state)
            await self._emit_progress(state, 0.3, "Analysing code context…")

            # Build a condensed view for the LLM
            code_preview = self._build_code_preview(files)

            messages = [
                {"role": "system", "content": HERMES_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"New review request: '{state.request.title}'\n\n"
                        f"Source type: {state.request.source_type}\n"
                        f"Files to review ({len(files)}):\n"
                        + "\n".join(f"  • {f.path} ({f.lines} lines, {f.size_bytes} bytes)" for f in files)
                        + f"\n\nCode preview:\n```\n{code_preview}\n```\n\n"
                        "Perform PHASE 1 — INTAKE. Respond with the JSON object only."
                    ),
                },
            ]

            await self._emit_progress(state, 0.6, "Hermes initialising review session…")
            response, tokens = await self.llm.hermes_chat(messages)

            parsed = self._extract_json_block(response) or {}
            greeting = parsed.get("greeting", "SYNAPSE is initialising your code review…")
            initial_impression = parsed.get("initial_impression", "")
            agents_briefing = parsed.get("agents_briefing", "")

            hermes_intro = f"{greeting}\n\n{initial_impression}\n\n{agents_briefing}\n\n— Hermes, SYNAPSE Orchestrator"

            await self._emit_hermes_message(state, hermes_intro)
            await self._emit_progress(state, 1.0, "Initialisation complete")

            primary_lang = parsed.get("language_detected", "unknown")
            if primary_lang == "unknown" and files:
                primary_lang = files[0].language

            state.mark_agent_done("hermes_init", tokens)
            await self._emit_complete(state, f"Initialised — {len(files)} file(s), lang={primary_lang}")

            return {
                "files": files,
                "primary_language": primary_lang,
                "status": ReviewStatus.RUNNING,
                "should_continue": True,
                "hermes_narrative": hermes_intro,
                "agent_states": state.agent_states,
                "total_tokens_used": state.total_tokens_used + tokens,
            }

        except Exception as exc:
            err = str(exc)
            self.logger.error("Hermes init failed", error=err)
            state.mark_agent_error("hermes_init", err)
            await self._emit_error(state, err)
            return {
                "should_continue": False,
                "error_message": f"Hermes init failed: {err}",
                "status": ReviewStatus.FAILED,
            }

    # ── Phase 2: SYNTHESIZE ────────────────────────────────────────────────────

    async def run_synthesize(self, state: SynapseState) -> dict:
        """
        After all specialist agents complete, Hermes synthesises their output,
        produces the final narrative, and requests approval if configured.
        """
        state.mark_agent_start("hermes_synthesize")
        await self._emit_start(state)

        try:
            summary = state.compute_summary()
            await self._emit_progress(state, 0.2, "Synthesising agent findings…")

            # Build findings digest for the LLM
            findings_text = self._build_findings_digest(state)

            messages = [
                {"role": "system", "content": HERMES_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Review session '{state.request.title}' complete.\n\n"
                        f"FINDINGS DIGEST:\n{findings_text}\n\n"
                        f"SCORE: {summary.overall_score}/10 | RISK: {summary.risk_level.upper()}\n\n"
                        "Perform PHASE 2 — SYNTHESIS. Respond with the JSON object only."
                    ),
                },
            ]

            await self._emit_progress(state, 0.5, "Hermes composing synthesis narrative…")
            response, tokens = await self.llm.hermes_chat(messages)
            parsed = self._extract_json_block(response) or {}

            technical_narrative = parsed.get(
                "technical_narrative",
                f"SYNAPSE completed the review. Found {summary.total_issues} issues with a score of {summary.overall_score}/10.",
            )
            approval_message = parsed.get(
                "approval_message",
                self._default_approval_message(summary),
            )

            full_narrative = (
                f"## 🧠 SYNAPSE Review Complete\n\n"
                f"**Score:** {summary.overall_score}/10 | **Risk:** {summary.risk_level.upper()}\n\n"
                f"{technical_narrative}\n\n"
                f"— Hermes, SYNAPSE Orchestrator"
            )

            await self._emit_hermes_message(state, approval_message)
            await self._emit_progress(state, 1.0, "Synthesis complete")

            state.mark_agent_done("hermes_synthesize", tokens)
            await self._emit_complete(state, f"Synthesis done — score {summary.overall_score}/10")

            requires_approval = state.request.require_approval
            if requires_approval:
                await self._emit(state, "approval_required", {
                    "session_id": state.session_id,
                    "message": approval_message,
                    "score": summary.overall_score,
                    "risk": summary.risk_level,
                })

            return {
                "summary": summary,
                "hermes_narrative": full_narrative,
                "hermes_approval_message": approval_message,
                "awaiting_approval": requires_approval,
                "status": ReviewStatus.AWAITING_APPROVAL if requires_approval else ReviewStatus.COMPLETED,
                "completed_at": datetime.utcnow(),
                "agent_states": state.agent_states,
                "total_tokens_used": state.total_tokens_used + tokens,
            }

        except Exception as exc:
            err = str(exc)
            self.logger.error("Hermes synthesize failed", error=err)
            state.mark_agent_error("hermes_synthesize", err)
            await self._emit_error(state, err)
            summary = state.compute_summary()
            return {
                "summary": summary,
                "hermes_narrative": f"Review completed with {summary.total_issues} issues found.",
                "hermes_approval_message": self._default_approval_message(summary),
                "awaiting_approval": state.request.require_approval,
                "status": ReviewStatus.AWAITING_APPROVAL if state.request.require_approval else ReviewStatus.COMPLETED,
                "completed_at": datetime.utcnow(),
            }

    # ── Conversational response ────────────────────────────────────────────────

    async def chat_response(self, session_id: str, user_message: str, history: list) -> str:
        """Handle a freeform message from the developer during the approval flow."""
        messages = [
            {"role": "system", "content": HERMES_SYSTEM_PROMPT},
            *history[-10:],  # Keep last 10 messages for context
            {"role": "user", "content": user_message},
        ]
        response, _ = await self.llm.hermes_chat(messages)
        return response

    # ── Private helpers ────────────────────────────────────────────────────────

    async def _prepare_files(self, state: SynapseState) -> List[FileContext]:
        """Build FileContext objects from the review request."""
        files: List[FileContext] = []

        if state.request.source_type == "paste" and state.request.code_content:
            file_path = state.request.file_name or "code.py"
            content = state.request.code_content
            lang = state.request.language or self._detect_language(file_path, content)
            files.append(FileContext(
                path=file_path,
                content=content,
                language=lang,
                lines=len(content.splitlines()),
                size_bytes=len(content.encode()),
            ))

        elif state.request.source_type == "github_pr":
            from app.services.github_service import GitHubService
            gh = GitHubService()
            pr_files = await gh.get_pr_files(
                state.request.github_repo,
                state.request.pr_number,
            )
            for f in pr_files:
                if f["status"] == "removed":
                    continue
                content = f.get("content") or f.get("patch", "")
                lang = self._detect_language(f["filename"], content)
                files.append(FileContext(
                    path=f["filename"],
                    content=content,
                    language=lang,
                    lines=len(content.splitlines()),
                    size_bytes=len(content.encode()),
                ))

        return files[:50]  # Cap at 50 files

    def _build_code_preview(self, files: List[FileContext], max_lines: int = 80) -> str:
        """Build a condensed multi-file preview for Hermes' initial analysis."""
        chunks = []
        per_file = max(5, max_lines // max(len(files), 1))
        for f in files:
            lines = f.content.splitlines()[:per_file]
            chunks.append(f"# File: {f.path}\n" + "\n".join(lines))
        return "\n\n".join(chunks)

    def _build_findings_digest(self, state: SynapseState) -> str:
        """Compact text digest of all agent findings for synthesis prompt."""
        lines = []
        lines.append(f"Issues found: {len(state.issues)}")

        if state.issues:
            from app.schemas import Severity
            for sev in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM]:
                sev_issues = [i for i in state.issues if i.severity == sev]
                if sev_issues:
                    lines.append(f"\n{sev.value.upper()} issues ({len(sev_issues)}):")
                    for iss in sev_issues[:5]:
                        lines.append(f"  • [{iss.category.value}] {iss.title} ({iss.file_path}:{iss.line_start})")

        if state.vulnerabilities:
            lines.append(f"\nSecurity vulnerabilities ({len(state.vulnerabilities)}):")
            for v in state.vulnerabilities[:5]:
                lines.append(f"  • [{v.severity.value}] {v.title} - {v.owasp_category or 'N/A'}")

        if state.test_suggestions:
            lines.append(f"\nTest gaps identified: {len(state.test_suggestions)}")

        if state.fix_suggestions:
            lines.append(f"\nAuto-fixes available: {len(state.fix_suggestions)}")

        return "\n".join(lines)

    def _default_approval_message(self, summary) -> str:
        score = summary.overall_score
        if score >= 8.0:
            verdict = "The code looks solid overall."
        elif score >= 6.0:
            verdict = "There are some issues that should be addressed before merging."
        else:
            verdict = "There are significant issues that need attention before this is production-ready."

        return (
            f"Review complete! {verdict}\n\n"
            f"**Summary:** {summary.total_issues} issues · "
            f"{summary.security_vulnerabilities} security vulnerabilities · "
            f"Score: {score}/10\n\n"
            f"I have {summary.fixes_available} fix suggestion(s) ready to apply. "
            f"Would you like me to **APPROVE** and post this review to GitHub, "
            f"or **REJECT** and let you make manual changes first?\n\n"
            f"— Hermes, SYNAPSE Orchestrator"
        )
