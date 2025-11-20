# Training Guide: Remove Hardcoded Rules & Train Neural Model

This guide shows you how to **completely remove hardcoded `common_misspellings`** and train the neural model to learn corrections naturally from data.

## Overview

Instead of maintaining a hardcoded dictionary of typos, you'll:
1. Generate training data with synthetic errors (including all common misspellings)
2. Fine-tune the T5 model on this data
3. Remove hardcoded rules from `spell_checker.py`
4. Configure backend to use your fine-tuned model

---

## Step 1: Download Training Corpus

You need clean text to generate training examples from:

```bash
cd backend/training

# Download ~50-100 books from Project Gutenberg
python download_corpus.py
```

**What this does:**
- Downloads classic literature (Pride and Prejudice, Moby Dick, etc.)
- Cleans and formats text
- Combines into `corpus/combined_corpus.txt`

**Alternative:** If you have your own corpus, place it at:
```
backend/training/corpus/combined_corpus.txt
```

---

## Step 2: Generate Training Data

Now generate error-correction pairs (I've already enhanced this to include common misspellings):

```bash
python generate_training_data.py
```

**What this creates:**
- `training/data/training_data.jsonl` - Training examples in JSON format
- `training/data/training_data.csv` - CSV format
- `training/data/training_data.txt` - T5-style format

**Example training pairs generated:**
```json
{"error": "teh", "correction": "the", "error_type": "common_misspelling"}
{"error": "alot", "correction": "a lot", "error_type": "common_misspelling"}
{"error": "I has a apple", "correction": "I have an apple", "error_type": "grammar"}
{"error": "She dont liek it", "correction": "She doesn't like it", "error_type": "typo"}
```

**Training data includes:**
- ✅ All common misspellings (teh, alot, freind, etc.)
- ✅ Synthetic typos (transpositions, omissions, insertions)
- ✅ Grammar errors (subject-verb agreement, articles)
- ✅ Homophones (their/there, your/you're)

---

## Step 3: Fine-Tune the Model

Train the T5 model on your generated data:

```bash
# Install training dependencies if needed
pip install torch transformers datasets tqdm

# Start fine-tuning (takes 30-60 minutes on CPU, 5-10 minutes on GPU)
python finetune_model.py
```

**Training settings:**
- Base model: `google/flan-t5-small` (or `flan-t5-base` for better quality)
- Epochs: 3
- Batch size: 8
- Learning rate: 5e-5

**Output:**
```
backend/models/cache/finetuned/final/
├── config.json
├── pytorch_model.bin
├── tokenizer_config.json
└── ...
```

**Monitor training:**
```
INFO:__main__:Training samples: 9000
INFO:__main__:Evaluation samples: 1000
INFO:__main__:Training started...
Epoch 1/3: 100%|████████| 1125/1125 [15:23<00:00]
  train_loss: 0.234
  eval_loss: 0.189
...
INFO:__main__:Training completed in 45.32 minutes
INFO:__main__:Test accuracy: 94.00%
```

---

## Step 4: Configure Backend to Use Fine-Tuned Model

Update `backend/config.py`:

```python
# Change this line:
CUSTOM_MODEL_PATH: Optional[Path] = None

# To this:
CUSTOM_MODEL_PATH: Optional[Path] = BASE_DIR / "models" / "cache" / "finetuned" / "final"
```

Or set environment variable:
```bash
export CUSTOM_MODEL_PATH="/path/to/AutoCorrect-extension/backend/models/cache/finetuned/final"
```

---

## Step 5: Remove Hardcoded Common Misspellings

Now that your model learned these corrections, remove the hardcoded dictionary:

**Edit `backend/models/spell_checker.py`:**

```python
# REMOVE this entire method:
def _load_common_misspellings(self) -> Dict[str, str]:
    return {
        "teh": "the",
        "alot": "a lot",
        # ... all the hardcoded entries
    }

# REMOVE this from __init__:
self.common_misspellings = self._load_common_misspellings()

# REMOVE this from __init__:
for misspelling in self.common_misspellings.keys():
    self.dictionary.discard(misspelling)

# REMOVE the common_misspellings check from get_corrections():
# Delete these lines:
if word_lower in self.common_misspellings:
    correction = self.common_misspellings[word_lower]
    return [(correction, 0.95)]
```

**Result:** The spell checker becomes a pure Levenshtein-based suggester, and the neural model handles all the intelligent corrections.

---

## Step 6: Update Correction Pipeline

Since the neural model now handles spelling corrections too, update the pipeline:

**Edit `backend/api/correction_endpoint.py`:**

```python
async def _auto_correct(self, text, context, request):
    # Remove the complex spell-checking loop
    # Let the neural model handle everything

    suggestions = []

    # Single pass: Neural model handles both spelling and grammar
    if request.use_neural and self.neural_corrector is not None:
        try:
            corrected_text, confidence = self.neural_corrector.correct_grammar(text)

            suggestions.append(Suggestion(
                text=corrected_text,
                confidence=confidence,
                source="neural"
            ))

            final_text = corrected_text
            final_confidence = confidence

        except Exception as e:
            logger.error(f"Neural correction failed: {e}")
            final_text = text
            final_confidence = 1.0
            suggestions.append(Suggestion(text=text, confidence=1.0, source="original"))
    else:
        # Fallback: no correction if neural model unavailable
        final_text = text
        final_confidence = 1.0
        suggestions.append(Suggestion(text=text, confidence=1.0, source="original"))

    return CorrectionResponse(
        original=text,
        corrected=final_text,
        suggestions=suggestions,
        confidence=final_confidence,
        processing_time_ms=0.0,
        cached=False,
        changes_made=(text != final_text)
    )
```

**Key change:** Neural model now does everything, no hardcoded rules.

---

## Step 7: Test Your Fine-Tuned Model

Restart backend and test:

```bash
# Restart backend
cd backend
uvicorn main:app --reload
```

Test in browser console:
```javascript
// Should now be corrected by neural model, not hardcoded rules
fetch('http://localhost:8000/correct', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({text: 'teh', mode: 'auto'})
}).then(r => r.json()).then(console.log)

// Expected output:
// {
//   "corrected": "the",
//   "confidence": 0.98,
//   "suggestions": [{"text": "the", "confidence": 0.98, "source": "neural"}]
// }
```

---

## Training Tips

### **Improve Model Quality**

1. **Use larger base model** (better quality, slower):
   ```python
   # In config.py
   PRETRAINED_MODEL_NAME: str = "google/flan-t5-base"  # Instead of flan-t5-small
   ```

2. **Generate more training data**:
   ```python
   # In generate_training_data.py main()
   pairs = generator.create_error_correction_pairs(
       corpus_text,
       max_pairs=50000  # Instead of 10000
   )
   ```

3. **Train for more epochs**:
   ```python
   # In finetune_model.py main()
   trainer = fine_tuner.train(
       train_dataset=train_dataset,
       eval_dataset=eval_dataset,
       num_epochs=5,  # Instead of 3
       batch_size=16,  # If you have GPU memory
   )
   ```

### **Speed Up Training**

1. **Use GPU** (100x faster):
   ```bash
   # Install CUDA-enabled PyTorch
   pip install torch --index-url https://download.pytorch.org/whl/cu118
   ```

2. **Use smaller model during development**:
   ```python
   USE_SMALL_MODEL: bool = True
   SMALL_MODEL_NAME: str = "google/flan-t5-small"
   ```

### **Monitor Performance**

Check backend logs:
```bash
tail -f backend/logs/autocorrect.log
```

Check accuracy on test cases:
```bash
cd backend/training
python finetune_model.py  # Already includes evaluation at end
```

---

## Benefits of This Approach

✅ **No hardcoded rules** - Model learns from data
✅ **Easily extensible** - Add more training data without code changes
✅ **Better generalization** - Model learns patterns, not just specific words
✅ **Context-aware** - Neural model considers surrounding text
✅ **Single source of truth** - One model handles everything
✅ **Continuous improvement** - Retrain periodically with new data

---

## Troubleshooting

**"Training data not found":**
```bash
# Make sure you ran generate_training_data.py first
ls -la backend/training/data/training_data.jsonl
```

**"Corpus not found":**
```bash
# Download corpus first
cd backend/training
python download_corpus.py
```

**"CUDA out of memory":**
```python
# Reduce batch size in finetune_model.py
batch_size=4  # Instead of 8
```

**"Model too slow":**
```python
# Use smaller model
USE_SMALL_MODEL: bool = True
```

**"Low accuracy":**
- Generate more training data (increase max_pairs)
- Train for more epochs (increase num_epochs)
- Use larger base model (flan-t5-base instead of flan-t5-small)

---

## Summary Commands

```bash
# Complete workflow
cd backend/training

# 1. Download corpus (one-time)
python download_corpus.py

# 2. Generate training data (includes all common misspellings)
python generate_training_data.py

# 3. Fine-tune model (30-60 mins)
python finetune_model.py

# 4. Update config to use fine-tuned model
# Edit backend/config.py: CUSTOM_MODEL_PATH = BASE_DIR / "models" / "cache" / "finetuned" / "final"

# 5. Remove hardcoded rules from spell_checker.py
# (See Step 5 above)

# 6. Restart backend
cd ..
uvicorn main:app --reload
```

Done! Your autocorrect now uses a data-driven neural model instead of hardcoded rules.
