"""
AutoCorrect FastAPI Backend
Neural model enhancement with literature training
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
from contextlib import asynccontextmanager

from backend.config import settings
from backend.api.correction_endpoint import (
    get_correction_service,
    CorrectionRequest,
    CorrectionResponse,
    HealthResponse
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(settings.LOG_FILE)
    ]
)

logger = logging.getLogger(__name__)


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Starting AutoCorrect API server...")
    logger.info(f"Using model: {settings.PRETRAINED_MODEL_NAME if not settings.USE_SMALL_MODEL else settings.SMALL_MODEL_NAME}")
    logger.info(f"N-gram order: {settings.NGRAM_ORDER}")
    logger.info(f"Cache enabled: {settings.ENABLE_CACHE}")

    # Initialize correction service (lazy load)
    service = get_correction_service()
    logger.info("Correction service initialized (models will load on first request)")

    yield

    # Shutdown
    logger.info("Shutting down AutoCorrect API server...")


# Create FastAPI app
app = FastAPI(
    title="AutoCorrect API",
    description="Neural model-enhanced autocorrect with literature training",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers"""
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000  # ms
    response.headers["X-Process-Time-Ms"] = str(round(process_time, 2))
    return response


# Privacy middleware - ensure no text storage
@app.middleware("http")
async def privacy_check(request: Request, call_next):
    """Ensure privacy compliance - no text storage beyond request"""
    if settings.NO_TEXT_STORAGE:
        # This is a reminder - actual implementation should ensure
        # no database writes of user text
        pass
    response = await call_next(request)
    return response


# Routes
@app.get("/", tags=["General"])
async def root():
    """Root endpoint"""
    return {
        "service": "AutoCorrect API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse, tags=["General"])
async def health_check():
    """
    Health check endpoint
    Returns status of loaded models and cache statistics
    """
    service = get_correction_service()

    models_loaded = {
        "spell_checker": service.spell_checker is not None,
        "neural_corrector": service.neural_corrector is not None,
        "ngram_model": service.ngram_model is not None and service.ngram_model.trained,
        "cache": service.cache is not None
    }

    cache_stats = {}
    if service.cache:
        cache_stats = service.cache.get_stats()

    return HealthResponse(
        status="healthy" if any(models_loaded.values()) else "degraded",
        models_loaded=models_loaded,
        cache_stats=cache_stats
    )


@app.post("/correct", response_model=CorrectionResponse, tags=["Correction"])
async def correct_text(request: CorrectionRequest):
    """
    Main correction endpoint

    Integrates:
    1. Levenshtein spell checker (first pass)
    2. Neural grammar correction (second pass)
    3. N-gram context ranking

    Args:
        request: CorrectionRequest with text and options

    Returns:
        CorrectionResponse with corrected text and suggestions

    Example:
        ```
        POST /correct
        {
            "text": "I has a apple",
            "context": ["yesterday"],
            "mode": "auto",
            "max_suggestions": 3
        }
        ```

        Response:
        ```
        {
            "original": "I has a apple",
            "corrected": "I have an apple",
            "suggestions": [
                {
                    "text": "I have an apple",
                    "confidence": 0.95,
                    "source": "neural"
                }
            ],
            "confidence": 0.95,
            "processing_time_ms": 245.3,
            "cached": false,
            "changes_made": true
        }
        ```
    """
    try:
        service = get_correction_service()
        result = await service.correct_text(request)
        return result

    except Exception as e:
        logger.error(f"Correction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats", tags=["General"])
async def get_statistics():
    """
    Get API usage statistics

    Returns:
        Statistics including request count, average processing time, cache hit rate
    """
    service = get_correction_service()

    avg_processing_time = (
        service.total_processing_time / service.total_requests
        if service.total_requests > 0
        else 0.0
    )

    stats = {
        "total_requests": service.total_requests,
        "average_processing_time_ms": round(avg_processing_time, 2),
        "cache_stats": service.cache.get_stats() if service.cache else {},
        "performance_target_ms": settings.MAX_RESPONSE_TIME_MS,
        "meeting_performance_target": avg_processing_time <= settings.MAX_RESPONSE_TIME_MS
    }

    # Add neural model stats if available
    if service.neural_corrector:
        stats["neural_model_stats"] = service.neural_corrector.get_performance_stats()

    return stats


@app.post("/cache/clear", tags=["Admin"])
async def clear_cache():
    """
    Clear all cached corrections

    Returns:
        Success message
    """
    try:
        service = get_correction_service()
        if service.cache:
            service.cache.clear()
            return {"status": "success", "message": "Cache cleared"}
        else:
            return {"status": "error", "message": "Cache not initialized"}

    except Exception as e:
        logger.error(f"Cache clear failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models", tags=["Admin"])
async def list_models():
    """
    List available and loaded models

    Returns:
        Information about current models
    """
    service = get_correction_service()

    models_info = {
        "current_model": settings.SMALL_MODEL_NAME if settings.USE_SMALL_MODEL else settings.PRETRAINED_MODEL_NAME,
        "use_small_model": settings.USE_SMALL_MODEL,
        "ngram_order": settings.NGRAM_ORDER,
        "models": {
            "spell_checker": {
                "loaded": service.spell_checker is not None,
                "type": "Levenshtein Distance",
                "dictionary_size": len(service.spell_checker.dictionary) if service.spell_checker else 0
            },
            "neural_corrector": {
                "loaded": service.neural_corrector is not None,
                "type": "Transformer (T5/BERT)",
                "model_name": service.neural_corrector.model_name if service.neural_corrector else "Not loaded",
                "device": service.neural_corrector.device if service.neural_corrector else "N/A"
            },
            "ngram_model": {
                "loaded": service.ngram_model is not None,
                "trained": service.ngram_model.trained if service.ngram_model else False,
                "order": service.ngram_model.order if service.ngram_model else settings.NGRAM_ORDER,
                "vocabulary_size": len(service.ngram_model.vocabulary) if service.ngram_model and service.ngram_model.trained else 0
            }
        }
    }

    return models_info


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """General exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        workers=settings.API_WORKERS,
        log_level=settings.LOG_LEVEL.lower()
    )
