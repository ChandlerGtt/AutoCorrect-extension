"""
Configuration settings for AutoCorrect FastAPI Backend
"""
import os
from pathlib import Path
from typing import Optional

try:
    from pydantic_settings import BaseSettings
except ImportError:
    # Fallback for older pydantic versions (< 2.0)
    try:
        from pydantic import BaseSettings
    except ImportError:
        raise ImportError(
            "pydantic-settings is required. Install it with: pip install pydantic-settings"
        )

# Base directory
BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    """Application settings"""

    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_WORKERS: int = 1
    DEBUG: bool = True

    # Model Settings
    PRETRAINED_MODEL_NAME: str = "vennify/t5-base-grammar-correction"
    # Alternative: "google/flan-t5-base"

    MODEL_CACHE_DIR: Path = BASE_DIR / "models" / "cache"
    CUSTOM_MODEL_PATH: Optional[Path] = None

    # Use smaller model for faster loading/inference during development
    USE_SMALL_MODEL: bool = False  # Set to False for production
    SMALL_MODEL_NAME: str = "google/flan-t5-small"  # Official Google model that exists!

    # Performance Settings
    MAX_RESPONSE_TIME_MS: int = 500
    MAX_INPUT_LENGTH: int = 512
    BATCH_SIZE: int = 8
    USE_GPU: bool = False  # Set to True if GPU available

    # Caching Settings
    ENABLE_CACHE: bool = True
    CACHE_TYPE: str = "disk"  # "disk" or "redis"
    CACHE_DIR: Path = BASE_DIR / "cache"
    CACHE_TTL: int = 86400  # 24 hours in seconds
    CACHE_MAX_SIZE: int = 1000  # Max cached items

    # Redis Settings (if using Redis cache)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # N-gram Model Settings
    NGRAM_ORDER: int = 4  # 1=unigram, 2=bigram, 3=trigram, 4=4-gram
    NGRAM_MODEL_PATH: Path = BASE_DIR / "models" / "ngram_model.pkl"
    NGRAM_VOCAB_PATH: Path = BASE_DIR / "models" / "ngram_vocab.pkl"

    # Training Data Settings
    CORPUS_DIR: Path = BASE_DIR / "training" / "corpus"
    TRAINING_DATA_DIR: Path = BASE_DIR / "training" / "data"
    MAX_CORPUS_SIZE: int = 1000  # Number of books to download
    MIN_BOOK_LENGTH: int = 10000  # Minimum characters per book

    # Error Generation Settings
    TYPO_ERROR_RATE: float = 0.15  # 15% of words get typo errors
    GRAMMAR_ERROR_RATE: float = 0.10  # 10% of sentences get grammar errors

    # Privacy & Security
    TLS_ENABLED: bool = False  # Set to True in production
    CERT_FILE: Optional[Path] = None
    KEY_FILE: Optional[Path] = None
    NO_TEXT_STORAGE: bool = True  # Never store user text beyond request
    MAX_REQUEST_SIZE: int = 10000  # Max characters per request

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Path = BASE_DIR / "logs" / "autocorrect.log"

    # Model Evaluation
    MIN_SPELLING_ACCURACY: float = 0.90  # 90%
    MIN_GRAMMAR_ACCURACY: float = 0.80  # 80%
    MIN_SUGGESTIONS: int = 2
    CONTEXT_WINDOW: int = 30  # Words to consider for context (increased for better accuracy)
    MIN_CONFIDENCE_THRESHOLD: float = 0.95  # Only apply corrections with 95%+ confidence

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()

# Create necessary directories
settings.MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
settings.CACHE_DIR.mkdir(parents=True, exist_ok=True)
settings.CORPUS_DIR.mkdir(parents=True, exist_ok=True)
settings.TRAINING_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.LOG_FILE.parent.mkdir(parents=True, exist_ok=True)