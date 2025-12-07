"""
Configuration settings for BabelBot Agent Service
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Gemini Configuration (REQUIRED)
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Service Configuration
    HOST: str = "localhost"
    PORT: int = 8003
    LOG_LEVEL: str = "INFO"

    # Conversation Management
    CONVERSATION_TTL: int = 3600  # seconds
    MAX_CONTEXT_MESSAGES: int = 20  # Keep last N messages for context

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Global settings instance
settings = Settings()

