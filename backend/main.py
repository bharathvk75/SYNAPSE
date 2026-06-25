"""
SYNAPSE — Multi-Agent Automated Code Reviewer & PR Bot
Main FastAPI Application Entry Point
"""
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database.connection import init_db

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan — startup and graceful shutdown."""
    logger.info(
        "🚀 SYNAPSE booting up",
        version="1.0.0",
        agents=["Hermes", "CodeAnalyzer", "SecurityScanner", "TestGenerator", "FixSuggester", "PRManager"],
    )

    # Init database
    await init_db()
    logger.info("✅ Database initialised")

    # Build & cache the workflow graph once at startup
    from app.graph.workflow import SynapseWorkflow

    app.state.workflow = SynapseWorkflow()
    logger.info("✅ LangGraph multi-agent workflow compiled")

    # Seed default LLM settings if table is empty
    from app.services.review_service import ReviewService

    app.state.review_service = ReviewService(app.state.workflow)
    logger.info("✅ ReviewService ready")

    logger.info("🧠 SYNAPSE ready", host=settings.host, port=settings.port, debug=settings.debug)
    yield

    logger.info("🛑 SYNAPSE shutting down gracefully…")


# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SYNAPSE",
    description="Multi-Agent Automated Code Reviewer & PR Bot — powered by LangGraph + LiteLLM + Hermes",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routers ────────────────────────────────────────────────────────────────────
from app.api.routes import agents, github, review, settings_router, ws  # noqa: E402

app.include_router(review.router, prefix="/api/review", tags=["Review"])
app.include_router(github.router, prefix="/api/github", tags=["GitHub"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(ws.router, prefix="/ws", tags=["WebSocket"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "service": "SYNAPSE",
        "version": "1.0.0",
        "agents": ["Hermes", "CodeAnalyzer", "SecurityScanner", "TestGenerator", "FixSuggester", "PRManager"],
    }


# ── Global error handler ───────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", exc_info=exc, path=str(request.url))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )
