"""
SYNAPSE — GitHub API Routes
GET  /api/github/status          → connection status + user info
POST /api/github/connect         → set/update GitHub token
GET  /api/github/repos           → list user repos
GET  /api/github/repos/{owner}/{repo}/prs  → list PRs
GET  /api/github/repos/{owner}/{repo}/prs/{number}  → PR info
POST /api/github/webhook         → GitHub webhook endpoint
POST /api/github/review-pr       → trigger review for a specific PR
"""
from __future__ import annotations

import hashlib
import hmac
import json

import structlog
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.config import settings
from app.schemas import ReviewRequest

router = APIRouter()
logger = structlog.get_logger(__name__)


class ConnectGitHubRequest(BaseModel):
    token: str


class ReviewPRRequest(BaseModel):
    repo: str
    pr_number: int
    llm_provider: str | None = None
    llm_model: str | None = None
    auto_post: bool = False
    require_approval: bool = True


@router.get("/status")
async def github_status():
    """Check GitHub connection status."""
    from app.services.github_service import GitHubService
    gh = GitHubService()
    username = await gh.verify_token()
    return {
        "connected": username is not None,
        "user": username,
        "token_configured": bool(settings.github_token),
    }


@router.post("/connect")
async def connect_github(body: ConnectGitHubRequest):
    """Validate and store a GitHub personal access token."""
    from app.services.github_service import GitHubService
    from app.database.connection import AsyncSessionLocal
    from app.database.models import Setting
    from sqlalchemy import select

    gh = GitHubService(token=body.token)
    username = await gh.verify_token()
    if not username:
        raise HTTPException(status_code=401, detail="Invalid GitHub token or insufficient permissions")

    # Persist token to settings table
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Setting).where(Setting.key == "github_token"))
        record = result.scalar_one_or_none()
        if record:
            record.value = body.token
        else:
            db.add(Setting(key="github_token", value=body.token, description="GitHub PAT"))
        await db.commit()

    # Update in-memory config (will not survive restart — use env for persistence)
    settings.github_token = body.token

    return {"connected": True, "user": username, "message": f"Connected as @{username}"}


@router.get("/repos")
async def list_repos(limit: int = 30):
    from app.services.github_service import GitHubService
    gh = GitHubService()
    try:
        repos = await gh.list_repos(limit=limit)
        return {"repos": [r.model_dump() for r in repos]}
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/repos/{owner}/{repo}/prs")
async def list_prs(owner: str, repo: str, state: str = "open"):
    from app.services.github_service import GitHubService
    gh = GitHubService()
    full_name = f"{owner}/{repo}"
    try:
        prs = await gh.list_prs(full_name, state=state)
        return {"prs": [p.model_dump() for p in prs]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/repos/{owner}/{repo}/prs/{pr_number}")
async def get_pr(owner: str, repo: str, pr_number: int):
    from app.services.github_service import GitHubService
    gh = GitHubService()
    try:
        info = await gh.get_pr_info(f"{owner}/{repo}", pr_number)
        return info.model_dump()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/review-pr", status_code=status.HTTP_202_ACCEPTED)
async def review_pr(body: ReviewPRRequest, request: Request):
    """Trigger a SYNAPSE review for a specific GitHub PR."""
    from app.schemas import LLMProvider

    review_request = ReviewRequest(
        title=f"PR #{body.pr_number} — {body.repo}",
        source_type="github_pr",
        github_repo=body.repo,
        pr_number=body.pr_number,
        llm_provider=LLMProvider(body.llm_provider) if body.llm_provider else None,
        llm_model=body.llm_model,
        auto_post_to_pr=body.auto_post,
        require_approval=body.require_approval,
    )

    svc = request.app.state.review_service
    session_id = await svc.start_review(review_request)
    return {"session_id": session_id, "status": "running", "pr": body.pr_number, "repo": body.repo}


@router.post("/webhook")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
):
    """Receive GitHub webhook events and trigger automatic PR reviews."""
    payload = await request.body()

    # Verify signature
    if settings.github_webhook_secret and x_hub_signature_256:
        from app.services.github_service import GitHubService
        gh = GitHubService()
        if not gh.verify_webhook_signature(payload, x_hub_signature_256):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    try:
        data = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    from app.services.github_service import GitHubService
    gh = GitHubService()
    event = gh.parse_webhook_event(x_github_event or "", data)

    if event and event["type"] == "pr_opened":
        logger.info("Webhook: PR event received", repo=event["repo"], pr=event["pr_number"])

        from app.schemas import ReviewRequest
        review_request = ReviewRequest(
            title=f"[Webhook] PR #{event['pr_number']} — {event['repo']}",
            source_type="github_pr",
            github_repo=event["repo"],
            pr_number=event["pr_number"],
            auto_post_to_pr=True,
            require_approval=settings.require_approval_for_pr,
        )

        svc = request.app.state.review_service
        background_tasks.add_task(svc.start_review, review_request)

    return {"status": "received", "event": x_github_event}
