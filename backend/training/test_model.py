"""
Quick test script to see what the fine-tuned model outputs
"""
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from backend.config import settings

def test_model(model_path: Path):
    """Test the fine-tuned model with sample inputs"""
    print("="*60)
    print(f"Testing model: {model_path}")
    print("="*60)

    # Load model
    print("\nLoading model...")
    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSeq2SeqLM.from_pretrained(str(model_path))
    model.eval()

    # Test cases
    test_cases = [
        "teh",
        "alot",
        "I has a apple",
        "She dont like it",
        "Your the best",
        "I could of went there",
        "Alot of people",
        "freind",
        "recieve",
    ]

    print("\nTesting corrections:")
    print("-"*60)

    for test_input in test_cases:
        # Add "grammar:" prefix for T5 models
        input_text = f"grammar: {test_input}"

        # Tokenize
        inputs = tokenizer(input_text, return_tensors="pt")

        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=128,
                num_beams=4,
                early_stopping=True
            )

        # Decode
        predicted = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Post-process: remove "grammar:" prefix if present
        if predicted.lower().startswith("grammar:"):
            predicted = predicted[8:].strip()

        # Display
        print(f"Input:  {test_input}")
        print(f"Output: {predicted}")
        print()

    print("="*60)


if __name__ == "__main__":
    model_path = settings.MODEL_CACHE_DIR / "finetuned" / "final"

    if not model_path.exists():
        print(f"Model not found at: {model_path}")
        print("Please train the model first: python finetune_model.py")
        sys.exit(1)

    test_model(model_path)
