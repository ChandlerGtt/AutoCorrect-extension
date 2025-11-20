"""
Test model with SENTENCES (not isolated words)
The model was trained on sentence-level corrections
"""
import sys
from pathlib import Path

script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from backend.config import settings

def test_with_sentences(model_path: Path):
    """Test with full sentences like the training data"""
    print("="*60)
    print(f"Testing with SENTENCES (not isolated words)")
    print("="*60)

    # Load model
    print("\nLoading model...")
    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSeq2SeqLM.from_pretrained(str(model_path))
    model.eval()

    # Test cases WITH CONTEXT (like training data)
    test_cases = [
        ("I saw teh cat", "I saw the cat"),
        ("She has alot of friends", "She has a lot of friends"),
        ("I has a apple for lunch", "I have an apple for lunch"),
        ("She dont like it very much", "She doesn't like it very much"),
        ("He is my freind from school", "He is my friend from school"),
        ("I recieve the package yesterday", "I receive the package yesterday"),
        ("Your the best person I know", "You're the best person I know"),
        ("I could of went there today", "I could have gone there today"),
    ]

    print("\nTesting with sentence context:")
    print("-"*60)

    correct = 0
    for test_input, expected in test_cases:
        # Add "grammar:" prefix for T5
        input_text = f"grammar: {test_input}"

        # Generate
        inputs = tokenizer(input_text, return_tensors="pt")
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=128,
                num_beams=4,
                early_stopping=True
            )

        predicted = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Post-process
        if predicted.lower().startswith("grammar:"):
            predicted = predicted[8:].strip()

        # Check
        is_correct = predicted.strip().lower() == expected.strip().lower()
        if is_correct:
            correct += 1

        status = "✓" if is_correct else "✗"
        print(f"{status} Input:    {test_input}")
        print(f"  Expected: {expected}")
        print(f"  Got:      {predicted}")
        print()

    accuracy = (correct / len(test_cases)) * 100
    print("="*60)
    print(f"Accuracy: {correct}/{len(test_cases)} = {accuracy:.1f}%")
    print("="*60)


if __name__ == "__main__":
    model_path = settings.MODEL_CACHE_DIR / "finetuned" / "final"

    if not model_path.exists():
        print(f"Model not found at: {model_path}")
        sys.exit(1)

    test_with_sentences(model_path)
