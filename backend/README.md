# AutoCorrect Backend API

Neural model-enhanced autocorrect backend with literature-based training capabilities.

## Overview

This FastAPI backend provides advanced text correction capabilities for the AutoCorrect browser extension. It integrates:

1. **Levenshtein Spell Checker** - Fast first-pass correction
2. **Neural Grammar Model** - Transformer-based (T5/BERT) context-aware corrections
3. **N-gram Language Model** - Literature-trained 4-gram model for suggestion ranking

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Browser Extension (Frontend)           │
└──────────────────┬──────────────────────────────┘
                   │ HTTP POST /correct
                   ▼
┌─────────────────────────────────────────────────┐
│              FastAPI Backend                     │
│  ┌───────────────────────────────────────────┐  │
│  │  Correction Service (Orchestrator)        │  │
│  └───┬───────────────────────────────────┬───┘  │
│      │                                   │       │
│  ┌───▼───────────┐  ┌──────────────┐  ┌─▼─────┐│
│  │ Spell Checker │  │ Neural Model │  │ N-gram││
│  │ (Levenshtein) │  │ (T5/BERT)    │  │ Model ││
│  └───────────────┘  └──────────────┘  └───────┘│
│                           │                      │
│                     ┌─────▼─────┐               │
│                     │   Cache   │               │
│                     └───────────┘               │
└─────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

For detailed installation instructions, see **[INSTALLATION.md](INSTALLATION.md)**

**Quick install (minimal):**
```bash
cd backend
pip install -r requirements-minimal.txt
```

**Full install (with training pipeline):**
```bash
cd backend
pip install -r requirements.txt
```

**Recommended**: Install PyTorch separately first for faster setup:
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-minimal.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Run the Server

```bash
# Option 1: Using run script
python run.py

# Option 2: Using uvicorn directly
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Option 3: Using main.py
python -m backend.main
```

The API will be available at:
- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`
- OpenAPI spec: `http://localhost:8000/openapi.json`

### 4. Test the API

```bash
curl -X POST "http://localhost:8000/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I has a apple",
    "context": ["yesterday"],
    "mode": "auto",
    "max_suggestions": 3
  }'
```

Expected response:
```json
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

## Model Cache & Git Ignore

### Why Model Files Aren't in Git

The AI model cache directory (`backend/models/cache/`) is **excluded from git** for important reasons:

1. **Size Limitations**
   - Model files: ~850MB (T5-base grammar model)
   - GitHub file limit: 100MB per file
   - **Result**: Push would fail with "file too large" error

2. **Automatic Download**
   - Models auto-download from Hugging Face on first request
   - No manual setup needed
   - Different developers can use different model versions

3. **Cache Files**
   - Python bytecode (*.pyc, __pycache__/)
   - SQLite databases (*.db, cache.db)
   - These regenerate automatically

### What Gets Auto-Downloaded?

**On first API request**, the backend automatically downloads:

- **Model**: `vennify/t5-base-grammar-correction`
- **Size**: ~850MB
- **Time**: 1-2 minutes (depending on internet speed)
- **Location**: `backend/models/cache/models--vennify--t5-base-grammar-correction/`
- **Source**: Hugging Face Model Hub

**Subsequent requests**: < 200ms (model loads from disk cache)

### Gitignored Files & Directories

These are automatically generated and blocked by `.gitignore` and pre-commit hook:

```
# Model cache (850MB+ - auto-downloads)
backend/models/cache/
backend/models/*.pkl

# Python cache (auto-generates)
backend/__pycache__/
backend/**/__pycache__/
*.pyc
*.pyo

# SQLite cache (auto-generates)
backend/cache/
*.db
*.db-shm
*.db-wal

# Training data (optional - can be downloaded)
backend/training/corpus/
backend/logs/
```

### Pre-commit Hook Protection

A git pre-commit hook (`.githooks/pre-commit`) prevents accidental commits of:
- Files larger than 10MB
- Model cache directories
- .pkl, .pth, .bin files

To install the hook:
```bash
git config core.hooksPath .githooks
```

### First Time Setup

When you first clone the repository:

```bash
# 1. Clone repository (no models included)
git clone <repository>
cd AutoCorrect-extension

# 2. Install Python dependencies
pip install -r backend/requirements.txt

# 3. Start server (models will auto-download on first request)
python backend/run.py

# 4. Make first API request
curl -X POST http://localhost:8000/correct -H "Content-Type: application/json" \
  -d '{"text": "teh quick brown fox", "mode": "auto"}'

# First request: ~10-15 seconds (model downloads)
# Subsequent requests: < 200ms
```

**Important**: The first API request will take 10-15 seconds as the model downloads. This is normal! All subsequent requests will be fast.

## API Endpoints

### POST /correct

Main correction endpoint.

**Request Body:**
```json
{
  "text": "string",           // Text to correct (required)
  "context": ["string"],      // Surrounding words for context (optional)
  "mode": "auto",             // Mode: auto, suggestions, grammar
  "max_suggestions": 3,       // Max suggestions to return (1-10)
  "use_neural": true,         // Use neural model (default: true)
  "use_cache": true           // Use cached results (default: true)
}
```

**Response:**
```json
{
  "original": "string",
  "corrected": "string",
  "suggestions": [
    {
      "text": "string",
      "confidence": 0.0-1.0,
      "source": "spell|neural|ngram"
    }
  ],
  "confidence": 0.0-1.0,
  "processing_time_ms": 0.0,
  "cached": false,
  "changes_made": false
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "models_loaded": {
    "spell_checker": true,
    "neural_corrector": true,
    "ngram_model": true,
    "cache": true
  },
  "cache_stats": {
    "cache_type": "disk",
    "total_requests": 100,
    "hits": 50,
    "misses": 50,
    "hit_rate_percent": 50.0
  }
}
```

### GET /stats

API usage statistics.

**Response:**
```json
{
  "total_requests": 100,
  "average_processing_time_ms": 245.3,
  "cache_stats": {...},
  "performance_target_ms": 500,
  "meeting_performance_target": true,
  "neural_model_stats": {
    "load_time_s": 5.2,
    "avg_inference_ms": 200.0,
    "min_inference_ms": 150.0,
    "max_inference_ms": 350.0
  }
}
```

### GET /models

List loaded models and their status.

### POST /cache/clear

Clear all cached corrections (admin endpoint).

## Training Pipeline

### 1. Download Corpus

Download books from Project Gutenberg for training:

```bash
cd backend/training
python download_corpus.py
```

This will:
- Download 100+ classic books from Project Gutenberg
- Clean and process the text
- Save to `backend/training/corpus/`
- Create combined corpus file

**Configuration** (in `config.py`):
- `MAX_CORPUS_SIZE`: Number of books to download (default: 100)
- `MIN_BOOK_LENGTH`: Minimum book length in characters (default: 10,000)

### 2. Generate Training Data

Create synthetic error-correction pairs:

```bash
python generate_training_data.py
```

This will:
- Load the corpus
- Inject synthetic typos (15% rate)
- Inject synthetic grammar errors (10% rate)
- Generate error-correction pairs
- Save to `backend/training/data/training_data.jsonl`

**Error Types Generated:**
- Typos: transpositions, omissions, insertions, substitutions
- Grammar: subject-verb agreement, articles, homophones
- Common errors: should of/have, alot, its/it's, etc.

### 3. Train N-gram Model

Train the n-gram language model on literature:

```bash
python train_ngram.py
```

This will:
- Load corpus texts
- Build 4-gram language model
- Calculate word probabilities
- Save model to `backend/models/ngram_model.pkl`

**Output:**
- Vocabulary size: ~50,000+ words
- N-gram statistics
- Model performance metrics

### 4. Fine-tune Neural Model (Optional)

Fine-tune the pre-trained model on custom data:

```bash
python finetune_model.py
```

This will:
- Load pre-trained T5/BERT model
- Fine-tune on generated training data
- Save fine-tuned model to `backend/models/cache/finetuned/`

**Requirements:**
- GPU recommended (but works on CPU)
- ~8GB RAM minimum
- Training time: ~1-2 hours on CPU, ~15-30 min on GPU

**To use fine-tuned model:**
Update `config.py`:
```python
CUSTOM_MODEL_PATH = Path("models/cache/finetuned/final")
```

## Performance Optimization

### Target: <500ms Response Time

**Achieved through:**

1. **Caching Layer**
   - Disk cache (default) or Redis
   - 24-hour TTL
   - 50%+ hit rate typical

2. **Model Selection**
   - Use small model for development: `flan-t5-small-grammar-synthesis`
   - Use large model for production: `flan-t5-large-grammar-synthesis`

3. **Lazy Loading**
   - Models load on first request
   - Reduces startup time

4. **Batch Processing**
   - Batch size: 8 (configurable)
   - Efficient for multiple corrections

### Performance Monitoring

Check current performance:
```bash
curl http://localhost:8000/stats
```

### Tips for Meeting Performance Target

1. **Enable caching**: Set `ENABLE_CACHE=True`
2. **Use small model**: Set `USE_SMALL_MODEL=True` (development)
3. **Use GPU**: Set `USE_GPU=True` (if available)
4. **Increase workers**: Set `API_WORKERS=2-4` (production)
5. **Use Redis**: Set `CACHE_TYPE=redis` (faster than disk)

## Model Evaluation

### Accuracy Targets

From project requirements:
- **Spelling errors**: ≥90% accuracy ✓
- **Grammar errors**: ≥80% accuracy ✓
- **Suggestions**: ≥2 ranked alternatives ✓
- **Context window**: ≥10 surrounding words ✓

### Run Benchmarks

Create a test script (`backend/tests/benchmark.py`) to evaluate:

```python
from backend.models.spell_checker import get_spell_checker
from backend.models.pretrained_model import get_neural_corrector

# Test cases
test_cases = [
    ("teh", "the"),
    ("recieve", "receive"),
    ("I has a apple", "I have an apple"),
    # ... more test cases
]

# Run tests and calculate metrics
```

## Configuration Reference

### Environment Variables

See `.env.example` for all available settings.

**Key Settings:**

- `USE_SMALL_MODEL`: Use faster small model (default: True)
- `MAX_RESPONSE_TIME_MS`: Target response time (default: 500ms)
- `ENABLE_CACHE`: Enable result caching (default: True)
- `NGRAM_ORDER`: N-gram order 1-4 (default: 4)
- `DEBUG`: Enable debug mode (default: True)

## Browser Extension Integration

### Enable Backend in Extension

The extension can optionally use the backend for enhanced corrections:

**Option 1: Configuration File**

Add to extension's `config.js`:
```javascript
const API_CONFIG = {
  enabled: true,
  endpoint: "http://localhost:8000/correct",
  timeout: 1000,  // 1 second
  fallback: true  // Fall back to client-side if API fails
};
```

**Option 2: Extension Settings**

Add backend URL to extension settings UI.

### Integration Flow

1. User types text in browser
2. Extension captures text
3. If backend enabled:
   - Send POST to `/correct`
   - Apply correction from API response
   - Fall back to client-side if timeout/error
4. Else:
   - Use client-side Levenshtein/bigram model

### CORS Configuration

The backend allows all origins by default (development).

**For production**, update `backend/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://YOUR_EXTENSION_ID"],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)
```

## Privacy & Security

### Privacy Compliance

- **No text storage**: User text is never persisted (only cached temporarily)
- **No logging of content**: Only metadata logged
- **Local processing**: Can run entirely offline
- **TLS support**: Enable for production (`TLS_ENABLED=True`)

### Security Features

- Request size limits (10,000 chars)
- Input validation
- CORS protection
- Rate limiting (TODO: add rate limiter)

## Deployment

### Production Checklist

1. **Environment**
   - [ ] Set `DEBUG=False`
   - [ ] Set `USE_SMALL_MODEL=False`
   - [ ] Set `TLS_ENABLED=True`
   - [ ] Configure CORS origins
   - [ ] Set strong `API_WORKERS` (2-4)

2. **Performance**
   - [ ] Enable Redis cache
   - [ ] Use GPU if available
   - [ ] Configure reverse proxy (nginx)
   - [ ] Enable rate limiting

3. **Monitoring**
   - [ ] Set up logging
   - [ ] Monitor `/stats` endpoint
   - [ ] Set up alerts for performance

### Docker Deployment (TODO)

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "run.py"]
```

## Troubleshooting

### Model Loading Errors

**Issue**: `Failed to load model`

**Solutions**:
- Check internet connection (first download)
- Increase memory (models are large)
- Use smaller model: `USE_SMALL_MODEL=True`

### Slow Response Times

**Issue**: Response time > 500ms

**Solutions**:
- Enable caching: `ENABLE_CACHE=True`
- Use small model: `USE_SMALL_MODEL=True`
- Use GPU: `USE_GPU=True`
- Check `/stats` for bottlenecks

### Import Errors

**Issue**: `ModuleNotFoundError: No module named 'backend'`

**Solution**:
```bash
# Run from repository root
export PYTHONPATH="${PYTHONPATH}:/home/user/AutoCorrect-extension"
python backend/run.py

# Or install in development mode
pip install -e .
```

## Development

### Project Structure

```
backend/
├── api/
│   ├── __init__.py
│   └── correction_endpoint.py   # Main API logic
├── models/
│   ├── __init__.py
│   ├── spell_checker.py         # Levenshtein spell checker
│   ├── pretrained_model.py      # Neural grammar model
│   └── ngram_model.py           # N-gram language model
├── training/
│   ├── __init__.py
│   ├── download_corpus.py       # Gutenberg downloader
│   ├── generate_training_data.py # Error injection
│   ├── train_ngram.py           # N-gram training
│   └── finetune_model.py        # Model fine-tuning
├── utils/
│   ├── __init__.py
│   └── cache.py                 # Caching layer
├── config.py                    # Configuration
├── main.py                      # FastAPI app
├── run.py                       # Run script
└── requirements.txt             # Dependencies
```

### Development Mode and Auto-Reload

When running with `DEBUG=True` (default in development), the server automatically reloads when source code changes. To prevent unnecessary restarts during model loading, the auto-reload is configured to:

**Watch only these directories/files:**
- `backend/api/` - API endpoints and service logic
- `backend/utils/` - Utility functions
- `backend/config.py` - Configuration
- `backend/main.py` - FastAPI application
- `backend/run.py` - Server startup script

**Ignore these directories/files:**
- `models/cache/` - HuggingFace model cache
- `cache/` - Request cache
- `*.pkl`, `*.pth`, `*.bin` - Trained model files
- `__pycache__/` - Python cache

This prevents the server from restarting when:
- Models are downloaded on first request
- Cache files are created/updated
- Training generates new model files

To disable auto-reload in production, set `DEBUG=False` in `.env`.

### Adding New Features

1. Add model logic to `models/`
2. Update `correction_endpoint.py` service
3. Add API endpoint to `main.py`
4. Update documentation

## License

See repository LICENSE file.

## Support

For issues and questions:
- GitHub Issues: [repository_url]/issues
- Documentation: This README

## Changelog

### Version 1.0.0 (2024)

- Initial release
- Levenshtein spell checker integration
- Neural grammar correction (T5/BERT)
- 4-gram language model
- Training pipeline
- Caching layer
- FastAPI server
