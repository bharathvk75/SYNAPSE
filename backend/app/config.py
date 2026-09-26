"""
SYNAPSE — Application Configuration
Manages all runtime settings via environment variables + .env file.
"""
from functools import lru_cache
from typing import Any, List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ─────────────────────────────────────────────────────────────────
    app_name: str = "SYNAPSE"
    version: str = "2.12"
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    secret_key: str = "synapse-super-secret-key-CHANGE-IN-PRODUCTION"
    log_level: str = "info"

    # ── CORS ───────────────────────────────────────────────────────────────────
    cors_origins: Any = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./synapse.db"

    # ── GitHub ─────────────────────────────────────────────────────────────────
    github_token: Optional[str] = None
    github_webhook_secret: Optional[str] = None
    github_app_id: Optional[str] = None
    github_app_private_key_path: Optional[str] = None

    # ── LLM — Primary provider (LiteLLM routes to any backend) ────────────────
    # Options: ollama | lmstudio | openai | anthropic | gemini | groq | azure | cohere
    llm_provider: str = "ollama"
    llm_model: str = "hermes3"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 4096
    llm_streaming: bool = True
    llm_timeout: int = 120

    # ── Local LLMs ─────────────────────────────────────────────────────────────
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "hermes3"
    lmstudio_base_url: str = "http://localhost:1234/v1"
    lmstudio_model: str = "local-model"
    lmstudio_api_key: str = "lm-studio"          # LM Studio ignores key but LiteLLM needs one

    # ── Cloud LLMs ─────────────────────────────────────────────────────────────
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"
    openai_base_url: Optional[str] = None        # Custom base for OpenAI-compatible APIs

    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    google_api_key: Optional[str] = None
    google_model: str = "gemini-1.5-pro"

    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.3-70b-versatile"

    cohere_api_key: Optional[str] = None
    cohere_model: str = "command-r-plus"

    azure_openai_api_key: Optional[str] = None
    azure_openai_endpoint: Optional[str] = None
    azure_openai_deployment: str = "gpt-4o"
    azure_api_version: str = "2024-02-15-preview"

    deepseek_api_key: Optional[str] = None
    deepseek_model: str = "deepseek-coder"
    deepseek_base_url: str = "https://api.deepseek.com"

    nvidia_api_key: Optional[str] = None
    nvidia_model: str = "meta/llama-3.1-405b-instruct"
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"

    openai_compatible_api_key: Optional[str] = None
    openai_compatible_model: str = "custom-model"
    openai_compatible_base_url: Optional[str] = None

    # ── Hermes — Master Orchestrator (can use a different model than reviewers) ─
    hermes_provider: str = "ollama"
    hermes_model: str = "hermes3"
    hermes_temperature: float = 0.2
    hermes_max_tokens: int = 2048

    # ── Review settings ────────────────────────────────────────────────────────
    auto_approve_low_severity: bool = False
    require_approval_for_pr: bool = True
    max_file_size_kb: int = 500
    max_files_per_review: int = 50
    review_timeout_seconds: int = 300
    enable_ast_analysis: bool = True
    enable_security_scan: bool = True
    enable_test_generation: bool = True
    enable_fix_suggestions: bool = True

    # ── Notifications ──────────────────────────────────────────────────────────
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    whatsapp_recipient_number: Optional[str] = None
    enable_telegram_notifications: bool = False
    enable_whatsapp_notifications: bool = False

    # ── Webhooks ───────────────────────────────────────────────────────────────
    webhook_enabled: bool = True
    webhook_path: str = "/api/github/webhook"

    # ── Cache ──────────────────────────────────────────────────────────────────
    cache_ttl_seconds: int = 3600
    max_cache_size: int = 100

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",")]
        return v

    def get_llm_config(self, provider: Optional[str] = None) -> dict:
        """Build LiteLLM-compatible config for a given provider."""
        p = provider or self.llm_provider
        configs = {
            "ollama": {
                "model": f"ollama/{self.ollama_model}",
                "api_base": self.ollama_base_url,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "lmstudio": {
                "model": f"openai/{self.lmstudio_model}",
                "api_base": self.lmstudio_base_url,
                "api_key": self.lmstudio_api_key,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "openai": {
                "model": self.openai_model,
                "api_key": self.openai_api_key,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
                **({"api_base": self.openai_base_url} if self.openai_base_url else {}),
            },
            "anthropic": {
                "model": f"anthropic/{self.anthropic_model}",
                "api_key": self.anthropic_api_key,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "gemini": {
                "model": f"gemini/{self.google_model}",
                "api_key": self.google_api_key,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "groq": {
                "model": f"groq/{self.groq_model}",
                "api_key": self.groq_api_key,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "cohere": {
                "model": f"cohere/{self.cohere_model}",
                "api_key": self.cohere_api_key,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "azure": {
                "model": f"azure/{self.azure_openai_deployment}",
                "api_key": self.azure_openai_api_key,
                "api_base": self.azure_openai_endpoint,
                "api_version": self.azure_api_version,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "deepseek": {
                "model": f"openai/{self.deepseek_model}",
                "api_key": self.deepseek_api_key,
                "api_base": self.deepseek_base_url,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "nvidia": {
                "model": f"openai/{self.nvidia_model}" if not self.nvidia_model.startswith("openai/") else self.nvidia_model,
                "api_key": self.nvidia_api_key,
                "api_base": self.nvidia_base_url,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "openai_compatible": {
                "model": f"openai/{self.openai_compatible_model}" if not self.openai_compatible_model.startswith("openai/") else self.openai_compatible_model,
                "api_key": self.openai_compatible_api_key,
                "api_base": self.openai_compatible_base_url,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "mock": {
                "model": "mock",
                "temperature": 0.0,
                "max_tokens": 100,
            },
        }
        return configs.get(p, configs["ollama"])

    def get_hermes_config(self) -> dict:
        """LiteLLM config specifically for Hermes orchestrator."""
        cfg = self.get_llm_config(self.hermes_provider)
        if self.hermes_provider == "ollama":
            cfg["model"] = f"ollama/{self.hermes_model}"
        elif self.hermes_provider in ("lmstudio", "deepseek", "nvidia", "openai_compatible"):
            cfg["model"] = f"openai/{self.hermes_model}"
        cfg["temperature"] = self.hermes_temperature
        cfg["max_tokens"] = self.hermes_max_tokens
        return cfg


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
