"""Application configuration."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from pathlib import Path
import os

# Project root paths
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ROOT_ENV = ROOT_DIR / ".env"
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_ENV = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "PulmoScan AI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./pulmoscan.db"

    # File storage
    UPLOAD_DIR: str = "./data/uploads"
    DEMO_DATA_DIR: str = "./data/demo"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]

    # AI Configuration
    DEMO_MODE: bool = True
    MODEL_DIR: str = "./models"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Processing
    MAX_UPLOAD_SIZE_MB: int = 500

    model_config = SettingsConfigDict(
        env_file=(ROOT_ENV, BACKEND_ENV, ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
