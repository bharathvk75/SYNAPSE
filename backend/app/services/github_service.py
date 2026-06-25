"""
SYNAPSE — GitHub Service
Handles all GitHub API interactions: PR fetching, file content, review posting, webhooks.
"""
from __future__ import annotations

import hashlib
import hmac
import asyncio
from typing import Dict, List, Optional, Tuple

import structlog
from github import Github, GithubException, InputGitAuthor
from github.PullRequest import PullRequest
from github.Repository import Repository

from app.config import settings
from app.schemas import CodeIssue, GitHubPRInfo, GitHubRepoInfo, ReviewSummary, SecurityVulnerability

logger = structlog.get_logger(__name__)


class GitHubService:
    """Async-friendly wrapper around PyGithub."""

    def __init__(self, token: Optional[str] = None) -> None:
        tok = token or settings.github_token
        self._client: Optional[Github] = Github(tok) if tok else None
        self.logger = structlog.get_logger(self.__class__.__name__)

    @property
    def client(self) -> Github:
        if not self._client:
            raise ValueError(
                "GitHub token is not configured. "
                "Add GITHUB_TOKEN to your .env or configure it in Settings."
            )
        return self._client

    # ── Auth ───────────────────────────────────────────────────────────────────

    async def verify_token(self) -> Optional[str]:
        """Return the authenticated GitHub username, or None if token is invalid."""
        try:
            user = await asyncio.to_thread(lambda: self.client.get_user())
            return user.login
        except GithubException:
            return None
        except ValueError:
            return None

    def set_token(self, token: str) -> None:
        self._client = Github(token)

    # ── Repository ─────────────────────────────────────────────────────────────

    async def get_repo_info(self, full_name: str) -> GitHubRepoInfo:
        def _fetch():
            repo: Repository = self.client.get_repo(full_name)
            open_prs = repo.get_pulls(state="open").totalCount
            return GitHubRepoInfo(
                full_name=repo.full_name,
                description=repo.description,
                default_branch=repo.default_branch,
                language=repo.language,
                stars=repo.stargazers_count,
                open_prs=open_prs,
                private=repo.private,
            )

        return await asyncio.to_thread(_fetch)

    async def list_repos(self, limit: int = 30) -> List[GitHubRepoInfo]:
        def _fetch():
            user = self.client.get_user()
            repos = list(user.get_repos(sort="updated")[:limit])
            result = []
            for r in repos:
                result.append(
                    GitHubRepoInfo(
                        full_name=r.full_name,
                        description=r.description,
                        default_branch=r.default_branch,
                        language=r.language,
                        stars=r.stargazers_count,
                        open_prs=0,
                        private=r.private,
                    )
                )
            return result

        return await asyncio.to_thread(_fetch)

    # ── Pull Requests ──────────────────────────────────────────────────────────

    async def get_pr_info(self, repo: str, pr_number: int) -> GitHubPRInfo:
        def _fetch():
            r = self.client.get_repo(repo)
            pr: PullRequest = r.get_pull(pr_number)
            return GitHubPRInfo(
                repo=repo,
                pr_number=pr_number,
                title=pr.title,
                body=pr.body,
                author=pr.user.login,
                base_branch=pr.base.ref,
                head_branch=pr.head.ref,
                files_changed=pr.changed_files,
                additions=pr.additions,
                deletions=pr.deletions,
                state=pr.state,
                url=pr.html_url,
                created_at=pr.created_at,
                updated_at=pr.updated_at,
            )

        return await asyncio.to_thread(_fetch)

    async def list_prs(self, repo: str, state: str = "open", limit: int = 20) -> List[GitHubPRInfo]:
        def _fetch():
            r = self.client.get_repo(repo)
            prs = list(r.get_pulls(state=state, sort="updated")[:limit])
            result = []
            for pr in prs:
                result.append(
                    GitHubPRInfo(
                        repo=repo,
                        pr_number=pr.number,
                        title=pr.title,
                        body=pr.body,
                        author=pr.user.login,
                        base_branch=pr.base.ref,
                        head_branch=pr.head.ref,
                        files_changed=pr.changed_files,
                        additions=pr.additions,
                        deletions=pr.deletions,
                        state=pr.state,
                        url=pr.html_url,
                        created_at=pr.created_at,
                        updated_at=pr.updated_at,
                    )
                )
            return result

        return await asyncio.to_thread(_fetch)

    async def get_pr_files(self, repo: str, pr_number: int) -> List[Dict]:
        """Return list of changed files with their content (patch + decoded blob)."""
        def _fetch():
            r = self.client.get_repo(repo)
            pr: PullRequest = r.get_pull(pr_number)
            result = []
            for f in pr.get_files():
                file_data = {
                    "filename": f.filename,
                    "status": f.status,  # added | modified | removed | renamed
                    "additions": f.additions,
                    "deletions": f.deletions,
                    "changes": f.changes,
                    "patch": f.patch or "",
                    "content": "",
                    "sha": f.sha or "",
                }
                # Try to get the full file content from the head commit
                try:
                    if f.status != "removed":
                        blob = r.get_contents(f.filename, ref=pr.head.sha)
                        if hasattr(blob, "decoded_content"):
                            file_data["content"] = blob.decoded_content.decode(
                                "utf-8", errors="replace"
                            )
                except Exception:
                    # Fall back to patch if full content unavailable
                    file_data["content"] = f.patch or ""
                result.append(file_data)
            return result

        return await asyncio.to_thread(_fetch)

    # ── Review posting ─────────────────────────────────────────────────────────

    async def post_pr_review(
        self,
        repo: str,
        pr_number: int,
        summary: ReviewSummary,
        issues: List[CodeIssue],
        vulnerabilities: List[SecurityVulnerability],
        hermes_narrative: str,
        verdict: str = "REQUEST_CHANGES",  # APPROVE | REQUEST_CHANGES | COMMENT
    ) -> str:
        """Post a full GitHub PR review with inline comments."""

        def _post():
            r = self.client.get_repo(repo)
            pr: PullRequest = r.get_pull(pr_number)

            # Build the review body markdown
            body_lines = [
                "## 🧠 SYNAPSE Code Review",
                "",
                f"**Score:** `{summary.overall_score}/10` | **Risk:** `{summary.risk_level.upper()}`",
                f"**Issues:** {summary.total_issues} total · "
                f"🔴 {summary.critical_issues} critical · "
                f"🟠 {summary.high_issues} high · "
                f"🟡 {summary.medium_issues} medium",
                f"**Security Vulnerabilities:** {summary.security_vulnerabilities}",
                f"**Fixes Available:** {summary.fixes_available}",
                "",
                "---",
                "",
                hermes_narrative,
                "",
                "---",
                "_Reviewed by **SYNAPSE Multi-Agent System** · [Configure](http://localhost:5173/settings)_",
            ]
            body = "\n".join(body_lines)

            # Map verdict string to GitHub event
            event_map = {
                "APPROVE": "APPROVE",
                "REQUEST_CHANGES": "REQUEST_CHANGES",
                "COMMENT": "COMMENT",
            }
            github_event = event_map.get(verdict, "COMMENT")

            # Build inline comments for high/critical issues
            comments = []
            for issue in issues:
                if issue.severity.value in ("critical", "high"):
                    comments.append(
                        {
                            "path": issue.file_path,
                            "line": issue.line_start,
                            "body": (
                                f"**[{issue.severity.value.upper()}] {issue.title}**\n\n"
                                f"{issue.description}\n\n"
                                f"**💡 Suggestion:** {issue.suggestion}"
                            ),
                        }
                    )

            # Post the review
            review = pr.create_review(
                body=body,
                event=github_event,
                comments=comments[:10],  # GitHub limits inline comments
            )
            return review.html_url

        url = await asyncio.to_thread(_post)
        self.logger.info("PR review posted", repo=repo, pr=pr_number, url=url)
        return url

    async def post_pr_comment(self, repo: str, pr_number: int, body: str) -> str:
        """Post a simple comment on the PR."""
        def _post():
            r = self.client.get_repo(repo)
            pr: PullRequest = r.get_pull(pr_number)
            comment = pr.create_issue_comment(body)
            return comment.html_url

        return await asyncio.to_thread(_post)

    # ── Webhook verification ───────────────────────────────────────────────────

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Validate the X-Hub-Signature-256 header."""
        secret = settings.github_webhook_secret
        if not secret:
            return True  # Signature checking disabled
        expected = "sha256=" + hmac.new(
            secret.encode(), payload, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def parse_webhook_event(self, event_type: str, payload: dict) -> Optional[dict]:
        """
        Parse a raw GitHub webhook payload into a normalised SYNAPSE event dict.
        Returns None if event type is not handled.
        """
        if event_type == "pull_request":
            action = payload.get("action")
            if action not in ("opened", "synchronize", "reopened"):
                return None
            pr = payload["pull_request"]
            return {
                "type": "pr_opened",
                "repo": payload["repository"]["full_name"],
                "pr_number": pr["number"],
                "title": pr["title"],
                "author": pr["user"]["login"],
                "base_branch": pr["base"]["ref"],
                "head_branch": pr["head"]["ref"],
                "url": pr["html_url"],
                "action": action,
            }
        if event_type == "push":
            return {
                "type": "push",
                "repo": payload["repository"]["full_name"],
                "branch": payload["ref"].split("/")[-1],
                "commits": len(payload.get("commits", [])),
                "pusher": payload.get("pusher", {}).get("name", "unknown"),
            }
        return None
