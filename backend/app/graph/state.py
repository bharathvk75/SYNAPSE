"""
SYNAPSE — LangGraph State Definition
The shared state object that flows through all nodes in the multi-agent graph.
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional, Sequence

from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from pydantic import BaseModel, Field

from app.schemas import (
    AgentState,
    AgentStatus,
    CodeIssue,
    FixSuggestion,
    ImpactAssessment,
    ReviewRequest,
    ReviewStatus,
    ReviewSummary,
    SecurityVulnerability,
    TestSuggestion,
)


class FileContext(BaseModel):
    """Represents a single file being reviewed."""
    path: str
    content: str
    language: str = "unknown"
    lines: int = 0
    size_bytes: int = 0


class SynapseState(BaseModel):
    """
    Central state shared across all SYNAPSE agents in the LangGraph workflow.
    Every field is either set once or accumulated (List fields use append semantics).
    """

    # ── Identity ───────────────────────────────────────────────────────────────
    session_id: str
    request: ReviewRequest

    # ── LangChain messages (Hermes conversation history) ───────────────────────
    messages: Annotated[Sequence[BaseMessage], add_messages] = Field(default_factory=list)

    # ── Files being reviewed ───────────────────────────────────────────────────
    files: List[FileContext] = Field(default_factory=list)
    primary_language: str = "unknown"

    # ── Workflow control ───────────────────────────────────────────────────────
    status: ReviewStatus = ReviewStatus.PENDING
    current_agent: str = "hermes"
    should_continue: bool = True
    awaiting_approval: bool = False
    approval_decision: Optional[str] = None   # "approve" | "reject"
    approval_comment: Optional[str] = None
    error_message: Optional[str] = None

    # ── Agent states ──────────────────────────────────────────────────────────
    agent_states: Dict[str, AgentState] = Field(default_factory=dict)

    # ── Analysis results accumulated by specialist agents ─────────────────────
    issues: List[CodeIssue] = Field(default_factory=list)
    vulnerabilities: List[SecurityVulnerability] = Field(default_factory=list)
    test_suggestions: List[TestSuggestion] = Field(default_factory=list)
    fix_suggestions: List[FixSuggestion] = Field(default_factory=list)
    impact_assessment: Optional[ImpactAssessment] = None

    # ── Hermes outputs ─────────────────────────────────────────────────────────
    hermes_narrative: Optional[str] = None
    hermes_approval_message: Optional[str] = None
    hermes_conversation: List[Dict[str, str]] = Field(default_factory=list)

    # ── Summary ───────────────────────────────────────────────────────────────
    summary: ReviewSummary = Field(default_factory=ReviewSummary)

    # ── GitHub ────────────────────────────────────────────────────────────────
    pr_comment_posted: bool = False
    pr_review_submitted: bool = False
    github_comment_url: Optional[str] = None

    # ── Token tracking ────────────────────────────────────────────────────────
    total_tokens_used: int = 0

    # ── Timing ────────────────────────────────────────────────────────────────
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    # ── Streaming callback (not serialised — set by the service layer) ─────────
    stream_callback: Optional[Any] = Field(default=None, exclude=True)

    class Config:
        arbitrary_types_allowed = True

    def mark_agent_start(self, name: str) -> None:
        self.agent_states[name] = AgentState(
            name=name,
            status=AgentStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        self.current_agent = name

    def mark_agent_done(self, name: str, tokens: int = 0) -> None:
        if name in self.agent_states:
            state = self.agent_states[name]
            state.status = AgentStatus.COMPLETED
            state.completed_at = datetime.utcnow()
            state.tokens_used = tokens
            state.progress = 1.0
        self.total_tokens_used += tokens

    def mark_agent_error(self, name: str, error: str) -> None:
        if name in self.agent_states:
            state = self.agent_states[name]
            state.status = AgentStatus.FAILED
            state.error = error
            state.completed_at = datetime.utcnow()

    def compute_summary(self) -> ReviewSummary:
        from app.schemas import Severity

        sev_count = {s: 0 for s in Severity}
        for issue in self.issues:
            sev_count[issue.severity] += 1

        total = len(self.issues)
        score = 10.0
        score -= sev_count[Severity.CRITICAL] * 3.0
        score -= sev_count[Severity.HIGH] * 1.5
        score -= sev_count[Severity.MEDIUM] * 0.5
        score -= sev_count[Severity.LOW] * 0.1
        score -= len(self.vulnerabilities) * 2.0
        score = max(0.0, min(10.0, score))

        risk = "low"
        if sev_count[Severity.CRITICAL] > 0 or len(self.vulnerabilities) > 2:
            risk = "critical"
        elif sev_count[Severity.HIGH] > 0 or len(self.vulnerabilities) > 0:
            risk = "high"
        elif sev_count[Severity.MEDIUM] > 2:
            risk = "medium"

        total_lines = sum(f.lines for f in self.files)

        self.summary = ReviewSummary(
            total_issues=total,
            critical_issues=sev_count[Severity.CRITICAL],
            high_issues=sev_count[Severity.HIGH],
            medium_issues=sev_count[Severity.MEDIUM],
            low_issues=sev_count[Severity.LOW],
            security_vulnerabilities=len(self.vulnerabilities),
            tests_suggested=len(self.test_suggestions),
            fixes_available=len(self.fix_suggestions),
            overall_score=round(score, 1),
            risk_level=risk,
            files_analyzed=len(self.files),
            lines_analyzed=total_lines,
            ai_confidence=0.88,
        )
        return self.summary
