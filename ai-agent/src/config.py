"""Configuration for ALIVE AI Agent."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Database
    database_url: str = Field(default="postgresql://localhost:5432/alive")
    redis_url: str = Field(default="redis://localhost:6379")

    # AI Providers
    openai_api_key: str = Field(default="")
    anthropic_api_key: str = Field(default="")

    # X (Twitter) API
    twitter_api_key: str = Field(default="")
    twitter_api_secret: str = Field(default="")
    twitter_access_token: str = Field(default="")
    twitter_access_secret: str = Field(default="")
    twitter_bearer_token: str = Field(default="")

    # Backend API
    backend_url: str = Field(default="http://localhost:3001")
    internal_api_key: str = Field(default="")

    # Agent Settings
    tweet_interval_minutes: int = Field(default=60)
    beef_detection_interval_minutes: int = Field(default=15)
    vitality_check_interval_minutes: int = Field(default=5)

    # Personality Tuning
    feral_aggression: float = Field(default=0.8)  # 0-1
    copium_delusion: float = Field(default=0.7)
    alpha_confidence: float = Field(default=0.9)
    schizo_chaos: float = Field(default=0.85)
    wholesome_kindness: float = Field(default=0.75)
    menace_threat: float = Field(default=0.85)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
