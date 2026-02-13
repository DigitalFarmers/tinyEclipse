from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://tinyeclipse:changeme@localhost:5432/tinyeclipse"

    # Groq (free tier LLM)
    groq_api_key: str = ""
    groq_chat_model: str = "llama-3.3-70b-versatile"

    # Embeddings (local, free)
    embedding_model: str = "all-MiniLM-L6-v2"

    # Application
    app_secret_key: str = "change-this-to-a-random-string"
    admin_api_key: str = "change-this-to-a-random-string"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Rate Limits
    rate_limit_per_minute: int = 20
    rate_limit_per_day: int = 500

    # Confidence
    confidence_escalate_threshold: float = 0.6
    confidence_refuse_threshold: float = 0.3

    # Widget
    widget_base_url: str = "http://localhost:8000"

    # Logging
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
