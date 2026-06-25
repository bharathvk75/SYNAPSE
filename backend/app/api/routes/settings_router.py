"""
SYNAPSE — Settings API Routes
GET  /api/settings/              → get all settings
PUT  /api/settings/              → update settings
GET  /api/settings/providers     → list all LLM providers with status
POST /api/settings/test-llm      → test LLM connection
GET  /api/settings/ollama/models → list Ollama models
GET  /api/settings/lmstudio/models → list LM Studio models
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import LLMProvider, LLMProviderConfig, SettingsResponse, SettingsUpdateRequest

router = APIRouter()


@router.get("/", response_model=SettingsResponse)
async def get_settings():
    from app.services.github_service import GitHubService

    gh = GitHubService()
    github_user = await gh.verify_token()

    providers = _build_provider_list()

    return SettingsResponse(
        active_provider=settings.llm_provider,
        active_model=settings.llm_model,
        hermes_provider=settings.hermes_provider,
        hermes_model=settings.hermes_model,
        providers=providers,
        github_connected=github_user is not None,
        github_user=github_user,
        review_settings={
            "auto_approve_low_severity": settings.auto_approve_low_severity,
            "require_approval_for_pr": settings.require_approval_for_pr,
            "max_file_size_kb": settings.max_file_size_kb,
            "max_files_per_review": settings.max_files_per_review,
            "enable_ast_analysis": settings.enable_ast_analysis,
            "enable_security_scan": settings.enable_security_scan,
            "enable_test_generation": settings.enable_test_generation,
            "enable_fix_suggestions": settings.enable_fix_suggestions,
        },
    )


@router.put("/")
async def update_settings(body: SettingsUpdateRequest):
    """Update runtime settings (non-persistent — restart clears them)."""
    if body.llm_provider:
        settings.llm_provider = body.llm_provider
    if body.llm_model:
        settings.llm_model = body.llm_model
    if body.hermes_provider:
        settings.hermes_provider = body.hermes_provider
    if body.hermes_model:
        settings.hermes_model = body.hermes_model
    if body.github_token:
        settings.github_token = body.github_token
    if body.review_settings:
        for key, value in body.review_settings.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
    if body.api_keys:
        for key, value in body.api_keys.items():
            attr = f"{key}_api_key"
            if hasattr(settings, attr):
                setattr(settings, attr, value)

    return {"status": "updated", "active_provider": settings.llm_provider, "active_model": settings.llm_model}


@router.get("/providers")
async def list_providers():
    return {"providers": [p.model_dump() for p in _build_provider_list()]}


@router.post("/test-llm")
async def test_llm(provider: str | None = None, model: str | None = None):
    """Ping an LLM provider and return latency."""
    from app.services.llm_service import LLMService
    svc = LLMService(provider=provider)
    result = await svc.check_connection(provider=provider)
    return result


@router.get("/ollama/models")
async def ollama_models():
    from app.services.llm_service import LLMService
    svc = LLMService()
    models = await svc.list_ollama_models()
    return {"provider": "ollama", "models": models}


@router.get("/lmstudio/models")
async def lmstudio_models():
    from app.services.llm_service import LLMService
    svc = LLMService()
    models = await svc.list_lmstudio_models()
    return {"provider": "lmstudio", "models": models}


def _build_provider_list():
    return [
        LLMProviderConfig(
            provider=LLMProvider.OLLAMA,
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            is_active=settings.llm_provider == "ollama",
            is_local=True,
            display_name="Ollama (Local)",
            description="Run models locally with Ollama. Free, private, no API key needed.",
        ),
        LLMProviderConfig(
            provider=LLMProvider.LMSTUDIO,
            model=settings.lmstudio_model,
            base_url=settings.lmstudio_base_url,
            is_active=settings.llm_provider == "lmstudio",
            is_local=True,
            display_name="LM Studio (Local)",
            description="OpenAI-compatible local inference server. Free, private.",
        ),
        LLMProviderConfig(
            provider=LLMProvider.OPENAI,
            model=settings.openai_model,
            api_key="***" if settings.openai_api_key else None,
            is_active=settings.llm_provider == "openai",
            is_local=False,
            display_name="OpenAI",
            description="GPT-4o, GPT-4 Turbo, and more. Requires API key.",
        ),
        LLMProviderConfig(
            provider=LLMProvider.ANTHROPIC,
            model=settings.anthropic_model,
            api_key="***" if settings.anthropic_api_key else None,
            is_active=settings.llm_provider == "anthropic",
            is_local=False,
            display_name="Anthropic Claude",
            description="Claude 3.5 Sonnet, Haiku. Excellent for code analysis.",
        ),
        LLMProviderConfig(
            provider=LLMProvider.GEMINI,
            model=settings.google_model,
            api_key="***" if settings.google_api_key else None,
            is_active=settings.llm_provider == "gemini",
            is_local=False,
            display_name="Google Gemini",
            description="Gemini 1.5 Pro, Flash. Long context window.",
        ),
        LLMProviderConfig(
            provider=LLMProvider.GROQ,
            model=settings.groq_model,
            api_key="***" if settings.groq_api_key else None,
            is_active=settings.llm_provider == "groq",
            is_local=False,
            display_name="Groq (Fast Inference)",
            description="Llama 3.3 70B at blazing speed. Free tier available.",
        ),
        LLMProviderConfig(
            provider=LLMProvider.DEEPSEEK,
            model=settings.deepseek_model,
            api_key="***" if settings.deepseek_api_key else None,
            base_url=settings.deepseek_base_url,
            is_active=settings.llm_provider == "deepseek",
            is_local=False,
            display_name="DeepSeek Coder",
            description="DeepSeek's code-specialized models. Excellent for code tasks.",
        ),
        LLMProviderConfig(
            provider=LLMProvider.AZURE,
            model=settings.azure_openai_deployment,
            api_key="***" if settings.azure_openai_api_key else None,
            base_url=settings.azure_openai_endpoint,
            is_active=settings.llm_provider == "azure",
            is_local=False,
            display_name="Azure OpenAI",
            description="Enterprise Azure-hosted OpenAI models.",
        ),
    ]
