"""
SYNAPSE — ReviewService
Orchestrates the full review lifecycle:
  • creates a DB record
  • builds SynapseState
  • runs the LangGraph workflow (streaming)
  • persists results
  • manages WebSocket connections per session
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, Optional

import structlog
from sqlalchemy import select

from app.config import settings
from app.database.connection import AsyncSessionLocal
from app.database.models import ReviewRecord
from app.graph.state import SynapseState
from app.graph.workflow import SynapseWorkflow
from app.schemas import (
    ReviewRequest,
    ReviewResponse,
    ReviewStatus,
)

logger = structlog.get_logger(__name__)

# in-process session store  {session_id: SynapseState}
_active_sessions: Dict[str, SynapseState] = {}

# websocket subscriber registry  {session_id: [callback, ...]}
_ws_subscribers: Dict[str, list] = {}


class ReviewService:
    def __init__(self, workflow: Optional[SynapseWorkflow] = None) -> None:
        self._workflow = workflow
        self.logger = structlog.get_logger(self.__class__.__name__)

    @property
    def workflow(self) -> SynapseWorkflow:
        if self._workflow is None:
            self._workflow = SynapseWorkflow()
        return self._workflow

    # ── WebSocket subscription ─────────────────────────────────────────────────

    def subscribe(self, session_id: str, callback: Callable) -> None:
        _ws_subscribers.setdefault(session_id, []).append(callback)

    def unsubscribe(self, session_id: str, callback: Callable) -> None:
        subs = _ws_subscribers.get(session_id, [])
        if callback in subs:
            subs.remove(callback)

    async def _broadcast(self, session_id: str, event_type: str, data: Any) -> None:
        """Broadcast an event to all WebSocket subscribers for a session."""
        message = json.dumps({
            "type": event_type,
            "session_id": session_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        })
        dead = []
        for cb in list(_ws_subscribers.get(session_id, [])):
            try:
                await cb(message)
            except Exception:
                dead.append(cb)
        for cb in dead:
            self.unsubscribe(session_id, cb)

    # ── Review lifecycle ───────────────────────────────────────────────────────

    async def start_review(self, request: ReviewRequest) -> str:
        """
        Create a session, persist a pending record, then kick off the workflow
        asynchronously (fire-and-forget). Returns the session_id immediately.
        """
        session_id = request.session_id or str(uuid.uuid4())

        # Persist initial record
        async with AsyncSessionLocal() as db:
            record = ReviewRecord(
                session_id=session_id,
                title=request.title,
                description=request.description,
                status=ReviewStatus.PENDING.value,
                source_type=request.source_type,
                github_repo=request.github_repo,
                pr_number=request.pr_number,
                llm_provider=request.llm_provider.value if request.llm_provider else settings.llm_provider,
                llm_model=request.llm_model or settings.llm_model,
                created_at=datetime.utcnow(),
            )
            db.add(record)
            await db.commit()

        # Build state
        state = SynapseState(session_id=session_id, request=request)
        _active_sessions[session_id] = state

        # Attach streaming callback
        async def _stream_cb(event_type: str, data: Any) -> None:
            await self._broadcast(session_id, event_type, data)

        state.stream_callback = _stream_cb

        # Fire workflow asynchronously
        asyncio.create_task(self._run_workflow(session_id, state))

        return session_id

    async def _run_workflow(self, session_id: str, state: SynapseState) -> None:
        """Execute the LangGraph workflow and persist the final result."""
        try:
            await self._update_db_status(session_id, ReviewStatus.RUNNING)

            final_state = await self.workflow.ainvoke(state)
            _active_sessions[session_id] = final_state

            # Determine final status
            final_status = final_state.status
            if final_status in (ReviewStatus.RUNNING, ReviewStatus.PENDING):
                final_status = ReviewStatus.COMPLETED

            await self._persist_results(session_id, final_state, final_status)

            # Broadcast review complete
            response = self._state_to_response(final_state)
            await self._broadcast(
                session_id,
                "review_complete",
                response.model_dump(mode="json"),
            )

        except Exception as exc:
            self.logger.error("Workflow execution failed", session_id=session_id, error=str(exc))
            await self._update_db_status(session_id, ReviewStatus.FAILED, error=str(exc))
            await self._broadcast(session_id, "error", {"message": str(exc)})

    async def _persist_results(
        self,
        session_id: str,
        state: SynapseState,
        status: ReviewStatus,
    ) -> None:
        """Update the DB record with full review results."""
        summary = state.summary
        now = datetime.utcnow()
        duration = (now - state.started_at).total_seconds()

        review_data = {
            "issues": [i.model_dump() for i in state.issues],
            "vulnerabilities": [v.model_dump() for v in state.vulnerabilities],
            "test_suggestions": [t.model_dump() for t in state.test_suggestions],
            "fix_suggestions": [f.model_dump() for f in state.fix_suggestions],
            "hermes_narrative": state.hermes_narrative,
            "hermes_approval_message": state.hermes_approval_message,
            "agent_states": {k: v.model_dump() for k, v in state.agent_states.items()},
        }

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReviewRecord).where(ReviewRecord.session_id == session_id)
            )
            record = result.scalar_one_or_none()
            if record:
                record.status = status.value
                record.total_issues = summary.total_issues
                record.critical_issues = summary.critical_issues
                record.security_issues = summary.security_vulnerabilities
                record.overall_score = summary.overall_score
                record.files_analyzed = summary.files_analyzed
                record.lines_analyzed = summary.lines_analyzed
                record.review_data = review_data
                record.requires_approval = state.awaiting_approval
                record.completed_at = now
                record.duration_seconds = duration
                await db.commit()

    async def _update_db_status(
        self, session_id: str, status: ReviewStatus, error: Optional[str] = None
    ) -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReviewRecord).where(ReviewRecord.session_id == session_id)
            )
            record = result.scalar_one_or_none()
            if record:
                record.status = status.value
                await db.commit()

    # ── Approval ───────────────────────────────────────────────────────────────

    async def submit_approval(
        self, session_id: str, decision: str, comment: Optional[str] = None
    ) -> bool:
        state = _active_sessions.get(session_id)
        if not state:
            return False

        state.approval_decision = decision
        state.approval_comment = comment
        state.awaiting_approval = False

        if decision == "approve":
            new_status = ReviewStatus.APPROVED
        else:
            new_status = ReviewStatus.REJECTED

        state.status = new_status
        await self._update_db_status(session_id, new_status)

        await self._broadcast(session_id, "approval_received", {
            "decision": decision,
            "comment": comment,
        })

        # If auto_post and approved, kick off PR manager step
        if decision == "approve" and state.request.auto_post_to_pr:
            asyncio.create_task(self._run_pr_manager(session_id, state))

        return True

    async def _run_pr_manager(self, session_id: str, state: SynapseState) -> None:
        try:
            from app.agents.pr_manager import PRManagerAgent
            agent = PRManagerAgent()
            updates = await agent.run(state)
            for k, v in updates.items():
                setattr(state, k, v)
            await self._persist_results(session_id, state, ReviewStatus.COMPLETED)
        except Exception as exc:
            self.logger.error("PR manager post-approval failed", error=str(exc))

    # ── Queries ────────────────────────────────────────────────────────────────

    async def get_review(self, session_id: str) -> Optional[ReviewResponse]:
        """Return live state if available, else reconstruct from DB."""
        state = _active_sessions.get(session_id)
        if state:
            return self._state_to_response(state)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReviewRecord).where(ReviewRecord.session_id == session_id)
            )
            record = result.scalar_one_or_none()
            if record:
                return self._record_to_response(record)
        return None

    async def list_reviews(self, limit: int = 20, offset: int = 0) -> list:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReviewRecord)
                .order_by(ReviewRecord.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            records = result.scalars().all()
            return [self._record_to_response(r) for r in records]

    async def delete_review(self, session_id: str) -> bool:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReviewRecord).where(ReviewRecord.session_id == session_id)
            )
            record = result.scalar_one_or_none()
            if record:
                await db.delete(record)
                await db.commit()
                _active_sessions.pop(session_id, None)
                return True
        return False

    def get_active_state(self, session_id: str) -> Optional[SynapseState]:
        return _active_sessions.get(session_id)

    # ── Serialisation helpers ──────────────────────────────────────────────────

    def _state_to_response(self, state: SynapseState) -> ReviewResponse:
        from app.schemas import AgentState as AgentStateSchema

        return ReviewResponse(
            session_id=state.session_id,
            status=state.status,
            title=state.request.title,
            created_at=state.started_at,
            completed_at=state.completed_at,
            duration_seconds=(
                (state.completed_at - state.started_at).total_seconds()
                if state.completed_at
                else None
            ),
            summary=state.summary,
            issues=state.issues,
            vulnerabilities=state.vulnerabilities,
            test_suggestions=state.test_suggestions,
            fix_suggestions=state.fix_suggestions,
            hermes_narrative=state.hermes_narrative,
            hermes_approval_message=state.hermes_approval_message,
            requires_approval=state.awaiting_approval,
            approved_by=state.approved_by if hasattr(state, "approved_by") else None,
            agent_states=state.agent_states,
            llm_provider=state.request.llm_provider.value if state.request.llm_provider else settings.llm_provider,
            llm_model=state.request.llm_model or settings.llm_model,
            error=state.error_message,
        )

    def _record_to_response(self, record: ReviewRecord) -> ReviewResponse:
        from app.schemas import AgentState, AgentStatus, ReviewSummary

        data = record.review_data or {}

        summary = ReviewSummary(
            total_issues=record.total_issues,
            critical_issues=record.critical_issues,
            security_vulnerabilities=record.security_issues,
            overall_score=record.overall_score,
            files_analyzed=record.files_analyzed,
            lines_analyzed=record.lines_analyzed,
        )

        def _parse_list(key, model_cls):
            items = data.get(key, [])
            result = []
            for item in items:
                try:
                    result.append(model_cls(**item))
                except Exception:
                    pass
            return result

        from app.schemas import CodeIssue, FixSuggestion, SecurityVulnerability, TestSuggestion

        agent_states = {}
        for k, v in data.get("agent_states", {}).items():
            try:
                agent_states[k] = AgentState(**v)
            except Exception:
                pass

        return ReviewResponse(
            session_id=record.session_id,
            status=ReviewStatus(record.status),
            title=record.title,
            created_at=record.created_at,
            completed_at=record.completed_at,
            duration_seconds=record.duration_seconds,
            summary=summary,
            issues=_parse_list("issues", CodeIssue),
            vulnerabilities=_parse_list("vulnerabilities", SecurityVulnerability),
            test_suggestions=_parse_list("test_suggestions", TestSuggestion),
            fix_suggestions=_parse_list("fix_suggestions", FixSuggestion),
            hermes_narrative=data.get("hermes_narrative"),
            hermes_approval_message=data.get("hermes_approval_message"),
            requires_approval=record.requires_approval,
            approved_by=record.approved_by,
            agent_states=agent_states,
            llm_provider=record.llm_provider,
            llm_model=record.llm_model,
        )
