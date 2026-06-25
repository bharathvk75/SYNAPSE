"""
SYNAPSE — WebSocket Routes
WS /ws/{session_id}  → real-time streaming for a review session
WS /ws/hermes/{session_id} → real-time Hermes conversation
"""
from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.websocket("/{session_id}")
async def review_ws(websocket: WebSocket, session_id: str):
    """
    Stream real-time events for a review session.
    The client receives JSON messages with: type, session_id, agent, data, timestamp.
    """
    await websocket.accept()
    logger.info("WS connected", session_id=session_id)

    svc = websocket.app.state.review_service  # type: ignore[attr-defined]

    async def send_cb(message: str):
        try:
            await websocket.send_text(message)
        except Exception:
            pass  # Client disconnected

    svc.subscribe(session_id, send_cb)

    # Send the current state immediately in case the review already started
    try:
        review = await svc.get_review(session_id)
        if review:
            await websocket.send_text(json.dumps({
                "type": "current_state",
                "session_id": session_id,
                "data": review.model_dump(mode="json"),
            }))
    except Exception:
        pass

    try:
        while True:
            # Keep-alive ping/pong
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                data = json.loads(msg)
                if data.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "session_id": session_id}))
            except asyncio.TimeoutError:
                # Send keep-alive
                try:
                    await websocket.send_text(json.dumps({"type": "ping", "session_id": session_id}))
                except Exception:
                    break
    except WebSocketDisconnect:
        logger.info("WS disconnected", session_id=session_id)
    finally:
        svc.unsubscribe(session_id, send_cb)


@router.websocket("/hermes/{session_id}")
async def hermes_ws(websocket: WebSocket, session_id: str):
    """
    Bidirectional Hermes conversation over WebSocket.
    Client sends: {"message": "..."} 
    Server sends: {"type": "hermes_message", "content": "..."}
    """
    await websocket.accept()
    logger.info("Hermes WS connected", session_id=session_id)

    svc = websocket.app.state.review_service  # type: ignore[attr-defined]

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            message = data.get("message", "")
            if not message:
                continue

            state = svc.get_active_state(session_id)
            if not state:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "content": f"Session {session_id} not found",
                }))
                continue

            from app.agents.hermes import HermesAgent
            agent = HermesAgent()

            # Stream Hermes response token-by-token
            history = state.hermes_conversation or []

            full_response = ""
            async for token in svc.workflow._graph.astream_events(state):
                pass  # We use direct Hermes chat instead

            response = await agent.chat_response(session_id, message, history)

            state.hermes_conversation.append({"role": "user", "content": message})
            state.hermes_conversation.append({"role": "assistant", "content": response})

            await websocket.send_text(json.dumps({
                "type": "hermes_message",
                "session_id": session_id,
                "content": response,
                "role": "hermes",
            }))

    except WebSocketDisconnect:
        logger.info("Hermes WS disconnected", session_id=session_id)
    except Exception as exc:
        logger.error("Hermes WS error", error=str(exc))
        try:
            await websocket.send_text(json.dumps({"type": "error", "content": str(exc)}))
        except Exception:
            pass
