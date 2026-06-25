"""
SYNAPSE — PRManager Agent
Posts SYNAPSE review results to GitHub PRs as inline comments and full review.
Runs only when auto_post_to_pr=True and approved by Hermes/user.
"""
from __future__ import annotations

import structlog

from app.agents.base import BaseAgent
from app.graph.state import SynapseState
from app.schemas import ReviewStatus

logger = structlog.get_logger(__name__)


class PRManagerAgent(BaseAgent):
    """GitHub PR review submission agent — posts reviews and inline comments."""

    name = "pr_manager"
    description = "GitHub PR review poster — publishes SYNAPSE analysis to your pull request"
    emoji = "🐙"

    async def run(self, state: SynapseState) -> dict:
        state.mark_agent_start("pr_manager")
        await self._emit_start(state)

        if state.approval_decision == "reject":
            await self._emit_hermes_message(
                state,
                "PR review posting was rejected. No changes have been pushed to GitHub.\n\n"
                "The full review report is available in your SYNAPSE dashboard.\n\n"
                "— Hermes, SYNAPSE Orchestrator",
            )
            state.mark_agent_done("pr_manager")
            await self._emit_complete(state, "PR posting skipped (rejected by user)")
            return {
                "status": ReviewStatus.COMPLETED,
                "agent_states": state.agent_states,
            }

        if not state.request.github_repo or not state.request.pr_number:
            await self._emit_hermes_message(
                state,
                "No GitHub PR context found — skipping PR posting. "
                "Review results are saved in your SYNAPSE dashboard.",
            )
            state.mark_agent_done("pr_manager")
            return {
                "status": ReviewStatus.COMPLETED,
                "agent_states": state.agent_states,
            }

        try:
            from app.services.github_service import GitHubService

            gh = GitHubService()

            await self._emit_progress(state, 0.3, "Connecting to GitHub…")

            # Determine review verdict from summary
            summary = state.summary
            if summary.overall_score >= 8.0 and summary.critical_issues == 0:
                verdict = "APPROVE"
                verdict_emoji = "✅"
            elif summary.critical_issues > 0 or summary.security_vulnerabilities > 0:
                verdict = "REQUEST_CHANGES"
                verdict_emoji = "🔴"
            else:
                verdict = "COMMENT"
                verdict_emoji = "💬"

            await self._emit_progress(state, 0.5, "Posting review to GitHub…")

            narrative = state.hermes_narrative or f"SYNAPSE review complete. Score: {summary.overall_score}/10"
            comment_url = await gh.post_pr_review(
                repo=state.request.github_repo,
                pr_number=state.request.pr_number,
                summary=summary,
                issues=state.issues,
                vulnerabilities=state.vulnerabilities,
                hermes_narrative=narrative,
                verdict=verdict,
            )

            await self._emit_progress(state, 1.0, "Review posted successfully")

            success_message = (
                f"{verdict_emoji} Review successfully posted to GitHub PR #{state.request.pr_number}!\n\n"
                f"**Verdict:** {verdict}\n"
                f"**Score:** {summary.overall_score}/10\n"
                f"**View review:** {comment_url}\n\n"
                f"All {summary.total_issues} issues and {summary.security_vulnerabilities} "
                f"vulnerabilities have been posted as inline comments.\n\n"
                f"— Hermes, SYNAPSE Orchestrator"
            )

            await self._emit_hermes_message(state, success_message)
            state.mark_agent_done("pr_manager")
            await self._emit_complete(state, f"Review posted — verdict: {verdict}")

            return {
                "pr_comment_posted": True,
                "pr_review_submitted": True,
                "github_comment_url": comment_url,
                "status": ReviewStatus.COMPLETED,
                "agent_states": state.agent_states,
            }

        except Exception as exc:
            err = str(exc)
            self.logger.error("PRManager failed", error=err)
            state.mark_agent_error("pr_manager", err)
            await self._emit_error(state, err)

            await self._emit_hermes_message(
                state,
                f"⚠️ Failed to post review to GitHub: {err}\n\n"
                "The review results are still available in your SYNAPSE dashboard.\n"
                "Please check your GitHub token and repository permissions.\n\n"
                "— Hermes, SYNAPSE Orchestrator",
            )

            return {
                "pr_comment_posted": False,
                "error_message": err,
                "status": ReviewStatus.COMPLETED,
                "agent_states": state.agent_states,
            }
