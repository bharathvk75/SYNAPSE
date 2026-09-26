"""
SYNAPSE — Pydantic Schemas (request / response models)
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────────
class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IssueCategory(str, Enum):
    SECURITY = "security"
    PERFORMANCE = "performance"
    MAINTAINABILITY = "maintainability"
    BUG = "bug"
    STYLE = "style"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    BEST_PRACTICE = "best_practice"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    WAITING = "waiting"


class LLMProvider(str, Enum):
    OLLAMA = "ollama"
    LMSTUDIO = "lmstudio"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    GROQ = "groq"
    COHERE = "cohere"
    AZURE = "azure"
    DEEPSEEK = "deepseek"
    NVIDIA = "nvidia"
    OPENAI_COMPATIBLE = "openai_compatible"
    MOCK = "mock"


# ── Core Issue Models ──────────────────────────────────────────────────────────
class CodeIssue(BaseModel):
    id: str
    file_path: str
    line_start: int
    line_end: Optional[int] = None
    category: IssueCategory
    severity: Severity
    title: str
    description: str
    suggestion: str
    code_snippet: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    rule_id: Optional[str] = None
    references: List[str] = []
    reasoning: Optional[str] = None


class SecurityVulnerability(BaseModel):
    id: str
    file_path: str
    line_start: int
    line_end: Optional[int] = None
    cve_id: Optional[str] = None
    owasp_category: Optional[str] = None
    severity: Severity
    title: str
    description: str
    remediation: str
    code_snippet: Optional[str] = None
    exploit_likelihood: float = Field(ge=0.0, le=1.0, default=0.5)
    cvss_score: Optional[float] = None
    reasoning: Optional[str] = None
    exploit_scenario: Optional[str] = None


class TestSuggestion(BaseModel):
    id: str
    file_path: str
    function_name: str
    test_type: str  # unit | integration | e2e | property
    description: str
    test_code: str
    priority: str  # high | medium | low
    coverage_gap: str


class FixSuggestion(BaseModel):
    id: str
    issue_ids: List[str]
    file_path: str
    original_code: str
    fixed_code: str
    diff: str
    explanation: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    auto_applicable: bool = False
    ast_valid: bool = True
    verification_status: str = "verified_clean"  # verified_clean | syntax_valid | warning
    verification_notes: Optional[str] = None


class ImpactAssessment(BaseModel):
    blast_radius_score: int = Field(ge=0, le=100, default=25)
    risk_level: str = "low"  # low | medium | high | critical
    breaking_change_risk: bool = False
    api_contracts_affected: List[str] = []
    database_impact: str = "No database schema migrations or unindexed queries detected."
    performance_impact: str = "Low execution overhead."
    dependency_risk: str = "No vulnerable or deprecated external dependencies detected."
    architectural_recommendations: List[str] = []


# ── Agent State Models ─────────────────────────────────────────────────────────
class AgentState(BaseModel):
    name: str
    status: AgentStatus = AgentStatus.IDLE
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    tokens_used: int = 0
    error: Optional[str] = None
    progress: float = Field(ge=0.0, le=1.0, default=0.0)
    current_task: Optional[str] = None
    reasoning_trace: List[str] = Field(default_factory=list)
    thought_process: Optional[str] = None
    confidence_score: Optional[float] = None


# ── Review Request / Response ──────────────────────────────────────────────────
class ReviewRequest(BaseModel):
    session_id: Optional[str] = None
    title: str = "Code Review"
    description: Optional[str] = None

    # Source: either raw code paste or GitHub PR
    source_type: str = Field(default="paste", description="paste | github_pr | github_repo")
    code_content: Optional[str] = None       # for paste / single file
    file_name: Optional[str] = "code.py"
    language: Optional[str] = None           # auto-detected if None

    # GitHub source
    github_repo: Optional[str] = None        # "owner/repo"
    pr_number: Optional[int] = None
    branch: Optional[str] = None
    commit_sha: Optional[str] = None

    # LLM override
    llm_provider: Optional[LLMProvider] = None
    llm_model: Optional[str] = None

    # Feature flags
    enable_security: bool = True
    enable_tests: bool = True
    enable_fixes: bool = True
    auto_post_to_pr: bool = False
    require_approval: bool = True


class ReviewSummary(BaseModel):
    total_issues: int = 0
    critical_issues: int = 0
    high_issues: int = 0
    medium_issues: int = 0
    low_issues: int = 0
    security_vulnerabilities: int = 0
    tests_suggested: int = 0
    fixes_available: int = 0
    overall_score: float = Field(ge=0.0, le=10.0, default=0.0)
    risk_level: str = "unknown"  # low | medium | high | critical
    files_analyzed: int = 0
    lines_analyzed: int = 0
    ai_confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    blast_radius_score: Optional[int] = 25


class ReviewResponse(BaseModel):
    session_id: str
    status: ReviewStatus
    title: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None

    summary: ReviewSummary = ReviewSummary()
    issues: List[CodeIssue] = []
    vulnerabilities: List[SecurityVulnerability] = []
    test_suggestions: List[TestSuggestion] = []
    fix_suggestions: List[FixSuggestion] = []
    impact_assessment: Optional[ImpactAssessment] = None

    hermes_narrative: Optional[str] = None
    hermes_approval_message: Optional[str] = None
    requires_approval: bool = False
    approved_by: Optional[str] = None

    agent_states: Dict[str, AgentState] = {}
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    error: Optional[str] = None


# ── WebSocket Message Models ───────────────────────────────────────────────────
class WSMessageType(str, Enum):
    AGENT_START = "agent_start"
    AGENT_PROGRESS = "agent_progress"
    AGENT_COMPLETE = "agent_complete"
    AGENT_ERROR = "agent_error"
    STREAM_TOKEN = "stream_token"
    STREAM_THOUGHT = "stream_thought"
    FIX_VERIFIED = "fix_verified"
    IMPACT_EVALUATED = "impact_evaluated"
    REVIEW_COMPLETE = "review_complete"
    APPROVAL_REQUIRED = "approval_required"
    APPROVAL_RECEIVED = "approval_received"
    HERMES_MESSAGE = "hermes_message"
    PR_POSTED = "pr_posted"
    ERROR = "error"
    PING = "ping"
    PONG = "pong"


class WSMessage(BaseModel):
    type: WSMessageType
    session_id: str
    agent: Optional[str] = None
    data: Any = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ── Settings Models ────────────────────────────────────────────────────────────
class LLMProviderConfig(BaseModel):
    provider: LLMProvider
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_active: bool = False
    is_local: bool = False
    display_name: str = ""
    description: str = ""


class SettingsResponse(BaseModel):
    active_provider: str
    active_model: str
    hermes_provider: str
    hermes_model: str
    providers: List[LLMProviderConfig] = []
    github_connected: bool = False
    github_user: Optional[str] = None
    review_settings: Dict[str, Any] = {}
    notification_settings: Dict[str, Any] = {}


class SettingsUpdateRequest(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    hermes_provider: Optional[str] = None
    hermes_model: Optional[str] = None
    github_token: Optional[str] = None
    review_settings: Optional[Dict[str, Any]] = None
    notification_settings: Optional[Dict[str, Any]] = None
    api_keys: Optional[Dict[str, str]] = None
    base_urls: Optional[Dict[str, str]] = None


# ── GitHub Models ──────────────────────────────────────────────────────────────
class GitHubPRInfo(BaseModel):
    repo: str
    pr_number: int
    title: str
    body: Optional[str] = None
    author: str
    base_branch: str
    head_branch: str
    files_changed: int
    additions: int
    deletions: int
    state: str
    url: str
    created_at: datetime
    updated_at: datetime


class GitHubRepoInfo(BaseModel):
    full_name: str
    description: Optional[str] = None
    default_branch: str
    language: Optional[str] = None
    stars: int = 0
    open_prs: int = 0
    private: bool = False


class ApprovalRequest(BaseModel):
    session_id: str
    decision: str  # approve | reject
    comment: Optional[str] = None
    reviewer: str = "user"


class HermesMessage(BaseModel):
    session_id: str
    message: str
    role: str = "user"  # user | hermes
