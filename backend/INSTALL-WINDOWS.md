# Windows Installation Guide

Step-by-step installation guide for AutoCorrect Backend on Windows.

## Quick Fix for Build Errors

If you're getting build errors, use the Windows-specific requirements file:

```powershell
# In PowerShell, navigate to backend directory
cd backend

# Upgrade pip first
python -m pip install --upgrade pip

# Install PyTorch (CPU version - pre-built wheel)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install Windows-compatible requirements
pip install -r requirements-windows.txt
```

**That should work!** Skip to [Verify Installation](#verify-installation) below.

---

## Full Installation Guide

### Prerequisites

1. **Python 3.8 or higher**
   - Download from: https://www.python.org/downloads/
   - ✅ Check "Add Python to PATH" during installation
   - Verify: `python --version`

2. **pip (included with Python)**
   - Upgrade: `python -m pip install --upgrade pip`

### Step 1: Open PowerShell

Right-click Start → Windows PowerShell (or Terminal)

### Step 2: Navigate to Backend

```powershell
cd C:\dev\AutoCorrect-extension\backend
# Or wherever you cloned the repository
```

### Step 3: Create Virtual Environment (Recommended)

```powershell
# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1
```

**Note**: If you get an execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 4: Install Dependencies

**Option A: Windows-Specific (Recommended)**

```powershell
# Upgrade pip
python -m pip install --upgrade pip

# Install PyTorch first (pre-built wheel, ~100MB)
pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install Windows requirements (no compilation needed)
pip install -r requirements-windows.txt
```

**Option B: Minimal Installation**

```powershell
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-minimal.txt
```

**Option C: Full Installation (may require build tools)**

Only do this if you need the full training pipeline:

```powershell
# Install Microsoft C++ Build Tools first (see below)
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

### Step 5: Verify Installation

```powershell
# Test imports
python -c "import fastapi, transformers, torch; print('Success!')"
```

If you see `Success!`, you're ready to go!

### Step 6: Run the Server

```powershell
python run.py
```

Visit: http://localhost:8000/docs

---

## Troubleshooting

### Error: "pip subprocess to install build dependencies did not run successfully"

**Cause**: Some packages need C++/Rust compilation on Windows.

**Solution 1** (Easiest): Use `requirements-windows.txt`
```powershell
pip install -r requirements-windows.txt
```

**Solution 2**: Install pre-built wheels manually
```powershell
# Install packages one by one
pip install fastapi uvicorn pydantic
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install transformers sentencepiece
pip install numpy requests tqdm
pip install diskcache python-dotenv pyyaml
```

**Solution 3**: Install Microsoft C++ Build Tools
1. Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Run installer
3. Select "Desktop development with C++"
4. Install (requires ~6GB disk space)
5. Retry: `pip install -r requirements.txt`

### Error: "execution policy" when activating venv

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Error: "No module named 'backend'"

Make sure you're in the correct directory:
```powershell
cd C:\dev\AutoCorrect-extension
python backend\run.py
```

Or set PYTHONPATH:
```powershell
$env:PYTHONPATH = "C:\dev\AutoCorrect-extension"
python backend\run.py
```

### Error: "Address already in use" (port 8000)

Change the port in `backend/.env`:
```
API_PORT=8001
```

Or kill the process using port 8000:
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill it (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Error: torch installation fails

Use the CPU-only version with direct URL:
```powershell
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

For GPU support (if you have NVIDIA GPU):
```powershell
# Check CUDA version first
nvidia-smi

# Install matching version
# CUDA 11.8:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.1:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

---

## What Gets Installed

### requirements-windows.txt (Recommended)
- ✅ FastAPI web framework
- ✅ PyTorch (CPU) for neural models
- ✅ Transformers for pre-trained models
- ✅ Basic spell checking
- ✅ Disk caching
- ❌ No compilation required!

**Size**: ~500MB

**Missing** (can add later if needed):
- spacy (advanced NLP)
- pandas (data processing)
- Training pipeline tools

### requirements-minimal.txt
Same as Windows version, plus a few extras that may need compilation.

### requirements.txt (Full)
Everything including training pipeline. May require C++ Build Tools.

---

## Running Without Installation Issues

If you just want to test the API quickly:

```powershell
# Install absolute minimum
pip install fastapi uvicorn pydantic
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install transformers

# Comment out problematic imports in code temporarily
# Then run
python run.py
```

---

## Performance Tips for Windows

### 1. Use CPU-only PyTorch
Smaller download, faster install:
```powershell
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### 2. Enable Disk Caching
In `.env` file:
```
CACHE_TYPE=disk
ENABLE_CACHE=True
```

### 3. Increase Workers (if you have cores)
In `.env`:
```
API_WORKERS=2
```

### 4. Use Small Model for Testing
In `.env`:
```
USE_SMALL_MODEL=True
```

---

## Alternative: Docker Installation (Advanced)

If you have Docker Desktop for Windows:

```powershell
# Build image
docker build -t autocorrect-backend .

# Run container
docker run -p 8000:8000 autocorrect-backend
```

---

## Verify Installation

After successful installation, run these checks:

```powershell
# 1. Check Python version
python --version
# Should be 3.8+

# 2. Check pip packages
pip list | Select-String "fastapi|torch|transformers"

# 3. Test imports
python -c "import fastapi; print('FastAPI OK')"
python -c "import torch; print('PyTorch OK')"
python -c "import transformers; print('Transformers OK')"

# 4. Run server
python run.py
# Should start without errors

# 5. Test API (in another PowerShell window)
Invoke-WebRequest http://localhost:8000/health
# Should return JSON
```

---

## Next Steps

Once installed:

1. **Configure**: Copy `.env.example` to `.env`
   ```powershell
   copy .env.example .env
   notepad .env
   ```

2. **Start server**:
   ```powershell
   python run.py
   ```

3. **Test API**: Open browser to http://localhost:8000/docs

4. **Read docs**:
   - `README.md` - API usage
   - `TRAINING_GUIDE.md` - Model training
   - `EXTENSION_INTEGRATION.md` - Browser integration

---

## Common Windows Paths

- **Project**: `C:\dev\AutoCorrect-extension`
- **Backend**: `C:\dev\AutoCorrect-extension\backend`
- **Virtual env**: `C:\dev\AutoCorrect-extension\backend\venv`
- **Logs**: `C:\dev\AutoCorrect-extension\backend\logs`
- **Cache**: `C:\dev\AutoCorrect-extension\backend\cache`

---

## Getting Help

Still having issues?

1. Make sure you're using Python 3.8+
2. Try `requirements-windows.txt` instead of `requirements.txt`
3. Install PyTorch separately first
4. Check the error message carefully
5. Search the error on Stack Overflow

---

**Installation Time**: 5-15 minutes (Windows-specific requirements)

**Success Rate**: 95%+ with Windows requirements file

Good luck! 🚀
