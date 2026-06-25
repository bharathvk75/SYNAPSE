"""
SYNAPSE — Agents API Routes
GET /api/agents/          → list all agents with descriptions
GET /api/agents/{name}    → get specific agent info
GET /api/agents/status/{session_id} → get agent run states for a session
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

router = APIRouter()

AGENT_REGISTRY = [
    {
        "name": "hermes",
        "display_name": "Hermes",
        "emoji": "🧠",
        "role": "Master Orchestrator",
        "description": (
            "Hermes is the intelligence backbone of SYNAPSE. He greets your code, "
            "coordinates all specialist agents, synthesises their findings into a "
            "coherent senior-engineer narrative, and converses with you for approval "
            "before any changes touch your GitHub PR."
        ),
        "capabilities": [
            "Multi-agent orchestration via LangGraph",
            "Code context analysis & language detection",
            "Executive + technical narrative synthesis",
            "Human-in-the-loop approval conversations",
            "Conversational Q&A about the review",
        ],
        "runs_at": ["start", "end"],
    },
    {
        "name": "code_analyzer",
        "display_name": "CodeAnalyzer",
        "emoji": "🔍",
        "role": "Static Analysis Engine",
        "description": (
            "CodeAnalyzer performs exhaustive deep-dive analysis: Python AST parsing, "
            "complexity scoring, performance anti-patterns, maintainability checks, "
            "and best-practice violations across all popular languages."
        ),
        "capabilities": [
            "Python AST-based analysis (syntax errors, mutable defaults, bare except)",
            "Cyclomatic complexity & function length",
            "N+1 query detection, blocking async I/O",
            "Type hint completeness (Python/TypeScript)",
            "Dead code & duplicate logic detection",
            "Language-agnostic regex checks (TODOs, console.log, print statements)",
        ],
        "runs_at": ["after_hermes_init"],
    },
    {
        "name": "security_scanner",
        "display_name": "SecurityScanner",
        "emoji": "🛡️",
        "role": "OWASP Security Auditor",
        "description": (
            "SecurityScanner is your embedded AppSec engineer. It maps findings to "
            "OWASP Top 10 (2021), assigns CVSS scores, detects hardcoded secrets, "
            "injection vulnerabilities, cryptographic weaknesses, and more."
        ),
        "capabilities": [
            "OWASP Top 10 (2021) full coverage",
            "SQL/Command/LDAP injection detection",
            "Hardcoded secrets & API keys",
            "Weak cryptography (MD5/SHA1/DES/ECB)",
            "Insecure deserialization (pickle, YAML.load)",
            "Prototype pollution (JS/TS)",
            "CVSS 3.1 base score estimation",
            "CVE reference lookup",
        ],
        "runs_at": ["after_code_analyzer"],
    },
    {
        "name": "test_generator",
        "display_name": "TestGenerator",
        "emoji": "🧪",
        "role": "Coverage Gap Analyst",
        "description": (
            "TestGenerator identifies exactly what is NOT tested and generates "
            "production-quality, runnable test code in the right framework for "
            "your stack — pytest, Jest, Vitest, JUnit, and more."
        ),
        "capabilities": [
            "Coverage gap identification",
            "Unit, integration, E2E, and property test generation",
            "Framework auto-detection (pytest, Jest, Vitest, JUnit, etc.)",
            "Edge case and error path coverage",
            "Async test patterns",
            "Hypothesis/property-based test suggestions",
        ],
        "runs_at": ["after_security_scanner"],
    },
    {
        "name": "fix_suggester",
        "display_name": "FixSuggester",
        "emoji": "🔧",
        "role": "Automated Refactoring Engineer",
        "description": (
            "FixSuggester consolidates all findings and produces diff-backed, "
            "production-ready fix suggestions. Each fix includes the original code, "
            "the corrected replacement, a unified diff, and a flag for whether it "
            "is safe to auto-apply."
        ),
        "capabilities": [
            "Unified diff generation for each issue",
            "Combined fixes for co-located issues",
            "Auto-applicable flag for safe deterministic changes",
            "Confidence scoring per fix",
            "Critical + high + medium issue coverage",
        ],
        "runs_at": ["after_test_generator"],
    },
    {
        "name": "pr_manager",
        "display_name": "PRManager",
        "emoji": "🐙",
        "role": "GitHub PR Publisher",
        "description": (
            "PRManager is the final agent in the pipeline. After Hermes receives "
            "your approval, PRManager posts the full review to GitHub as a formal "
            "PR review with inline comments on every high/critical issue."
        ),
        "capabilities": [
            "GitHub PR review submission (APPROVE / REQUEST_CHANGES / COMMENT)",
            "Inline comments on high/critical issues",
            "Summary comment with SYNAPSE score card",
            "Hermes narrative posted to PR body",
            "Rate-limit aware (max 10 inline comments)",
        ],
        "runs_at": ["after_approval"],
    },
]


@router.get("/")
async def list_agents():
    return {"agents": AGENT_REGISTRY}


@router.get("/{name}")
async def get_agent(name: str):
    agent = next((a for a in AGENT_REGISTRY if a["name"] == name), None)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    return agent


@router.get("/status/{session_id}")
async def agent_status(session_id: str, request: Request):
    svc = request.app.state.review_service
    state = svc.get_active_state(session_id)
    if not state:
        # Try DB
        review = await svc.get_review(session_id)
        if review:
            return {
                "session_id": session_id,
                "agent_states": {k: v.model_dump() for k, v in review.agent_states.items()},
            }
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    return {
        "session_id": session_id,
        "current_agent": state.current_agent,
        "agent_states": {k: v.model_dump() for k, v in state.agent_states.items()},
        "status": state.status.value,
    }
