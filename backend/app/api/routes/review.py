"""
SYNAPSE — Review API Routes
POST /api/review/          → start a new review
GET  /api/review/          → list all reviews
GET  /api/review/{id}      → get review by session_id
DELETE /api/review/{id}    → delete a review
POST /api/review/{id}/approve → submit approval decision
POST /api/review/{id}/hermes  → chat with Hermes
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.schemas import (
    ApprovalRequest,
    HermesMessage,
    ReviewRequest,
    ReviewResponse,
)

router = APIRouter()


def _service(request: Request):
    return request.app.state.review_service


@router.post("/", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
async def start_review(body: ReviewRequest, request: Request):
    """Kick off an async review. Returns session_id immediately."""
    svc = _service(request)
    session_id = await svc.start_review(body)
    return {"session_id": session_id, "status": "running", "message": "Review started"}


@router.get("/", response_model=List[ReviewResponse])
async def list_reviews(limit: int = 20, offset: int = 0, request: Request = None):
    svc = _service(request)
    return await svc.list_reviews(limit=limit, offset=offset)


@router.get("/{session_id}", response_model=ReviewResponse)
async def get_review(session_id: str, request: Request):
    svc = _service(request)
    review = await svc.get_review(session_id)
    if not review:
        raise HTTPException(status_code=404, detail=f"Review {session_id} not found")
    return review


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(session_id: str, request: Request):
    svc = _service(request)
    deleted = await svc.delete_review(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Review {session_id} not found")


@router.post("/{session_id}/approve")
async def submit_approval(session_id: str, body: ApprovalRequest, request: Request):
    """Hermes approval gate — approve or reject the review."""
    svc = _service(request)
    success = await svc.submit_approval(
        session_id=session_id,
        decision=body.decision,
        comment=body.comment,
    )
    if not success:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found or not awaiting approval")
    return {"session_id": session_id, "decision": body.decision, "status": "recorded"}


@router.post("/{session_id}/hermes")
async def chat_with_hermes(session_id: str, body: HermesMessage, request: Request):
    """Send a message to Hermes for the given review session."""
    svc = _service(request)
    state = svc.get_active_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Active session {session_id} not found")

    from app.agents.hermes import HermesAgent

    agent = HermesAgent()
    history = state.hermes_conversation or []
    response = await agent.chat_response(session_id, body.message, history)

    # Persist in conversation history
    state.hermes_conversation.append({"role": "user", "content": body.message})
    state.hermes_conversation.append({"role": "assistant", "content": response})

    return {"session_id": session_id, "response": response, "role": "hermes"}
