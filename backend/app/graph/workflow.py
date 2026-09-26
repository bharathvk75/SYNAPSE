"""
SYNAPSE — LangGraph Multi-Agent Workflow
Defines the StateGraph that orchestrates all SYNAPSE agents.

Graph topology:
  START → hermes_init → code_analyzer → security_scanner
        → test_generator → fix_suggester → hermes_synthesize
        → [approval gate] → pr_manager → END
"""
from __future__ import annotations

from typing import Literal

import structlog
from langgraph.graph import END, START, StateGraph

from app.graph.state import SynapseState

logger = structlog.get_logger(__name__)


# ── Node wrappers (lazy import to avoid circular deps) ────────────────────────

async def _node_hermes_init(state: SynapseState) -> dict:
    from app.agents.hermes import HermesAgent
    agent = HermesAgent()
    return await agent.run_init(state)


async def _node_code_analyzer(state: SynapseState) -> dict:
    from app.agents.code_analyzer import CodeAnalyzerAgent
    agent = CodeAnalyzerAgent()
    return await agent.run(state)


async def _node_security_scanner(state: SynapseState) -> dict:
    from app.agents.security_scanner import SecurityScannerAgent
    agent = SecurityScannerAgent()
    return await agent.run(state)


async def _node_impact_analyzer(state: SynapseState) -> dict:
    from app.agents.impact_analyzer import ImpactAnalyzerAgent
    agent = ImpactAnalyzerAgent()
    return await agent.run(state)


async def _node_test_generator(state: SynapseState) -> dict:
    from app.agents.test_generator import TestGeneratorAgent
    agent = TestGeneratorAgent()
    return await agent.run(state)


async def _node_fix_suggester(state: SynapseState) -> dict:
    from app.agents.fix_suggester import FixSuggesterAgent
    agent = FixSuggesterAgent()
    return await agent.run(state)


async def _node_hermes_synthesize(state: SynapseState) -> dict:
    from app.agents.hermes import HermesAgent
    agent = HermesAgent()
    return await agent.run_synthesize(state)


async def _node_pr_manager(state: SynapseState) -> dict:
    from app.agents.pr_manager import PRManagerAgent
    agent = PRManagerAgent()
    return await agent.run(state)


async def _node_approval_wait(state: SynapseState) -> dict:
    """
    Approval gate — Hermes has posted an approval request via WebSocket.
    The actual wait is handled externally (REST endpoint sets approval_decision).
    This node just checks the state and passes through.
    """
    if state.awaiting_approval and state.approval_decision is None:
        # Still waiting — this shouldn't be reached; the service layer
        # will resume the graph once approval arrives.
        return {"awaiting_approval": True}
    return {"awaiting_approval": False}


# ── Routing conditions ────────────────────────────────────────────────────────

def _route_after_init(state: SynapseState) -> Literal["code_analyzer", END]:
    if not state.should_continue:
        return END
    return "code_analyzer"


def _route_after_impact(state: SynapseState) -> Literal["test_generator", "fix_suggester"]:
    if state.request.enable_tests:
        return "test_generator"
    return "fix_suggester"


def _route_after_tests(state: SynapseState) -> Literal["fix_suggester", "hermes_synthesize"]:
    if state.request.enable_fixes:
        return "fix_suggester"
    return "hermes_synthesize"


def _route_after_synthesize(
    state: SynapseState,
) -> Literal["approval_wait", "pr_manager", END]:
    if state.request.require_approval and state.awaiting_approval:
        return "approval_wait"
    if state.request.auto_post_to_pr and state.request.source_type == "github_pr":
        return "pr_manager"
    return END


def _route_after_approval(
    state: SynapseState,
) -> Literal["pr_manager", END]:
    if state.approval_decision == "approve" and state.request.auto_post_to_pr:
        return "pr_manager"
    return END


# ── Graph construction ────────────────────────────────────────────────────────

class SynapseWorkflow:
    """
    Compiled LangGraph StateGraph — built once at application startup.
    Call `invoke(state)` or `astream(state)` to run a review session.
    """

    def __init__(self) -> None:
        self._graph = self._build()

    def _build(self):
        builder = StateGraph(SynapseState)

        # Register nodes
        builder.add_node("hermes_init", _node_hermes_init)
        builder.add_node("code_analyzer", _node_code_analyzer)
        builder.add_node("security_scanner", _node_security_scanner)
        builder.add_node("impact_analyzer", _node_impact_analyzer)
        builder.add_node("test_generator", _node_test_generator)
        builder.add_node("fix_suggester", _node_fix_suggester)
        builder.add_node("hermes_synthesize", _node_hermes_synthesize)
        builder.add_node("approval_wait", _node_approval_wait)
        builder.add_node("pr_manager", _node_pr_manager)

        # Entry edge
        builder.add_edge(START, "hermes_init")

        # Conditional edges
        builder.add_conditional_edges("hermes_init", _route_after_init)
        builder.add_edge("code_analyzer", "security_scanner")
        builder.add_edge("security_scanner", "impact_analyzer")
        builder.add_conditional_edges("impact_analyzer", _route_after_impact)
        builder.add_conditional_edges("test_generator", _route_after_tests)
        builder.add_edge("fix_suggester", "hermes_synthesize")
        builder.add_conditional_edges("hermes_synthesize", _route_after_synthesize)
        builder.add_conditional_edges("approval_wait", _route_after_approval)
        builder.add_edge("pr_manager", END)

        return builder.compile()

    async def ainvoke(self, state: SynapseState) -> SynapseState:
        result = await self._graph.ainvoke(state)
        return result

    async def astream(self, state: SynapseState):
        async for chunk in self._graph.astream(state, stream_mode="updates"):
            yield chunk
