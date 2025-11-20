#!/usr/bin/env python3
"""
Run script for AutoCorrect Backend
"""
import sys
import os
import logging
from pathlib import Path

# Add backend to path
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

# Set PYTHONPATH for uvicorn subprocess
os.environ['PYTHONPATH'] = project_root

from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Run the FastAPI server"""
    import uvicorn

    logger.info("Starting AutoCorrect Backend Server...")
    logger.info(f"Host: {settings.API_HOST}")
    logger.info(f"Port: {settings.API_PORT}")
    logger.info(f"Model: {settings.SMALL_MODEL_NAME if settings.USE_SMALL_MODEL else settings.PRETRAINED_MODEL_NAME}")
    logger.info(f"Debug: {settings.DEBUG}")
    logger.info(f"Docs: http://{settings.API_HOST}:{settings.API_PORT}/docs")

    # Determine reload directories - only watch source code, not model cache
    reload_dirs = None
    reload_excludes = None

    if settings.DEBUG:
        backend_dir = Path(__file__).parent
        # Watch only Python source code directories, not model cache
        reload_dirs = [
            str(backend_dir / "api"),
            str(backend_dir / "utils"),
            str(backend_dir / "config.py"),
            str(backend_dir / "main.py"),
            str(backend_dir / "run.py"),
        ]
        # Comprehensive exclusions for model files and cache
        reload_excludes = [
            "*.pkl",
            "*.pth",
            "*.pt",
            "*.bin",
            "*.safetensors",
            "**/cache/**",
            "**/.cache/**",
            "**/models/cache/**",
            "**/models/**/*.pkl",
            "**/__pycache__/**",
            "**/.*/**",  # Exclude all hidden directories
            "**/.no_exist/**",  # Exclude model cache temp dirs
        ]
        logger.info("Auto-reload enabled (watching: api, utils, config, main only)")

    uvicorn.run(
        "backend.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        reload_dirs=reload_dirs,
        reload_excludes=reload_excludes,
        workers=settings.API_WORKERS,
        log_level=settings.LOG_LEVEL.lower()
    )


if __name__ == "__main__":
    main()
