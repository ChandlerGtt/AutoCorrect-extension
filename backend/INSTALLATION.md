# Installation Guide

Quick guide for installing the AutoCorrect Backend dependencies.

## System Requirements

- **Python**: 3.8 or higher
- **RAM**: 2GB minimum (8GB recommended for training)
- **Disk Space**: 1GB minimum (10GB for full training pipeline)
- **OS**: Linux, macOS, or Windows

## Installation Options

### Option 1: Minimal Installation (Recommended for Getting Started)

Install only the packages needed to run the API server:

```bash
cd backend
pip install -r requirements-minimal.txt
```

**Includes:**
- FastAPI and web framework
- Pre-trained model support (T5/BERT)
- Basic spell checking
- Caching

**Use when:**
- You just want to run the server
- You don't need to train custom models
- You want faster installation

### Option 2: Full Installation

Install all packages including training pipeline:

```bash
cd backend
pip install -r requirements.txt
```

**Includes:**
- Everything from minimal installation
- Training data generation
- N-gram model training
- Model fine-tuning
- Advanced NLP tools

**Use when:**
- You want to train custom models
- You need the full training pipeline
- You want to fine-tune on your own data

## Step-by-Step Installation

### 1. Check Python Version

```bash
python --version
# Should be Python 3.8 or higher
```

If you don't have Python 3.8+, install it:
- **Ubuntu/Debian**: `sudo apt-get install python3.10`
- **macOS**: `brew install python@3.10`
- **Windows**: Download from [python.org](https://python.org)

### 2. Create Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On Linux/macOS:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 3. Upgrade pip

```bash
pip install --upgrade pip
```

### 4. Install PyTorch (CPU version for faster download)

For CPU-only (smaller, faster download):
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

For GPU support (if you have CUDA):
```bash
# CUDA 11.8
pip install torch --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.1
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

### 5. Install Requirements

```bash
# Minimal installation (recommended to start)
pip install -r requirements-minimal.txt

# OR full installation
pip install -r requirements.txt
```

### 6. Verify Installation

```bash
python -c "import fastapi, transformers, torch; print('✓ Installation successful!')"
```

If you see `✓ Installation successful!`, you're ready to go!

## Troubleshooting

### Error: "No matching distribution found for torch"

**Solution**: Install PyTorch separately first (see step 4 above), then install requirements.

### Error: "Microsoft Visual C++ required" (Windows)

**Solution**: Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Error: Out of memory during installation

**Solution**:
1. Install packages one at a time
2. Close other applications
3. Use CPU-only PyTorch

### Error: "Command 'gcc' failed" (Linux)

**Solution**:
```bash
sudo apt-get install python3-dev build-essential
```

### Error: spaCy model missing

**Solution** (if using spaCy):
```bash
python -m spacy download en_core_web_sm
```

## Optional Dependencies

### For Redis Caching (Faster)

```bash
# Install Redis server
# Ubuntu/Debian:
sudo apt-get install redis-server

# macOS:
brew install redis

# Windows:
# Download from https://github.com/microsoftarchive/redis/releases

# Start Redis
redis-server

# Install Python client (already in requirements.txt)
pip install redis
```

### For GPU Support

If you have an NVIDIA GPU:

```bash
# Check CUDA version
nvidia-smi

# Install matching PyTorch
# See: https://pytorch.org/get-started/locally/
```

## Installation Verification Checklist

After installation, verify everything works:

```bash
# 1. Check Python packages
pip list | grep -E "fastapi|torch|transformers"

# 2. Test imports
python -c "from backend.config import settings; print('Config OK')"
python -c "from backend.models.spell_checker import get_spell_checker; print('Spell checker OK')"

# 3. Run the server
python backend/run.py
# Should start without errors

# 4. Test the API (in another terminal)
curl http://localhost:8000/health
# Should return JSON with status
```

## Platform-Specific Notes

### Ubuntu/Debian Linux

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install python3-pip python3-dev build-essential

# Install backend
cd backend
pip install -r requirements-minimal.txt
```

### macOS

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python
brew install python@3.10

# Install backend
cd backend
pip3 install -r requirements-minimal.txt
```

### Windows

```powershell
# Install Python from python.org
# Then in PowerShell:

cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements-minimal.txt
```

## Next Steps

After successful installation:

1. **Configure the backend**: Copy `.env.example` to `.env` and edit as needed
2. **Start the server**: Run `python backend/run.py`
3. **Test the API**: Visit http://localhost:8000/docs
4. **Read the docs**: Check `backend/README.md` for usage

## Getting Help

If you encounter issues:

1. Check the error message carefully
2. Search for the error in the [Troubleshooting](#troubleshooting) section
3. Check Python and pip versions
4. Try the minimal installation first
5. Verify system dependencies are installed

## Clean Reinstall

If you need to start fresh:

```bash
# Deactivate and remove virtual environment
deactivate
rm -rf venv/

# Remove cache
rm -rf ~/.cache/huggingface/
rm -rf backend/models/cache/

# Start over from step 2
```

---

**Installation Time Estimates:**
- Minimal: ~5-10 minutes
- Full: ~10-20 minutes
- With training: ~1-2 hours (includes model downloads)

Happy installing! 🚀
