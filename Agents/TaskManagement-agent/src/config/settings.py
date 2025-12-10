"""
Configuration settings for TaskManagement Agent Service
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Gemini Configuration (REQUIRED)
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Database Configuration (REQUIRED)
    DATABASE_URL: str

    # Backend API URL (for polling data)
    BACKEND_API_URL: str = "http://localhost:3000"

    # Service Configuration
    HOST: str = "localhost"
    PORT: int = 8004
    LOG_LEVEL: str = "INFO"

    # Data Polling Configuration
    DATA_POLL_INTERVAL: int = 300  # seconds (5 minutes)
    DATA_CACHE_TTL: int = 300  # seconds (5 minutes)

    # Task Extraction Configuration
    MIN_CONFIDENCE_SCORE: float = 0.7  # Minimum confidence for auto-extraction
    CLARIFICATION_THRESHOLD: float = 0.5  # Below this, ask for clarification

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Global settings instance
settings = Settings()

