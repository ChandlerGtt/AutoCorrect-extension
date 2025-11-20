"""
One-hour optimized training script
Generates maximum training data and trains for as many epochs as possible in 60 minutes
"""
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import logging
import time
from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def calculate_optimal_training_params():
    """
    Calculate optimal parameters for 1-hour training session

    Based on empirical data:
    - ~10k examples = ~9k training samples
    - ~9 minutes per epoch with 10k examples
    - 60 minutes / 9 = ~6 epochs
    """
    target_examples = 10000  # Sweet spot for 1-hour training
    target_epochs = 6  # Fits in 1 hour with some buffer
    batch_size = 8  # Standard batch size

    estimated_time_minutes = target_epochs * 9

    return {
        "target_examples": target_examples,
        "epochs": target_epochs,
        "batch_size": batch_size,
        "estimated_time_minutes": estimated_time_minutes
    }


def generate_training_data(target_examples: int):
    """Generate training data with target number of examples"""
    from generate_training_data import ErrorGenerator

    corpus_path = settings.CORPUS_DIR / "combined_corpus.txt"

    if not corpus_path.exists():
        logger.error(f"Corpus not found at {corpus_path}")
        logger.error("Please run: python download_corpus.py")
        return False

    logger.info(f"Loading corpus from {corpus_path}...")
    with open(corpus_path, 'r', encoding='utf-8') as f:
        corpus_text = f.read()

    logger.info(f"Corpus size: {len(corpus_text):,} characters")

    # Generate errors
    generator = ErrorGenerator()

    # Adjust max_pairs to hit target
    # With 15% typo rate + 10% grammar rate, we get ~25% of sentences as pairs
    # So to get 10k pairs, we need to process ~40k sentences
    max_sentences = int(target_examples / 0.25)

    logger.info(f"Generating training data (target: {target_examples:,} examples)...")
    start_time = time.time()

    pairs = generator.create_error_correction_pairs(
        corpus_text,
        max_pairs=max_sentences
    )

    generation_time = time.time() - start_time
    logger.info(f"Generated {len(pairs):,} examples in {generation_time:.1f} seconds")

    # Save data
    output_dir = settings.TRAINING_DATA_DIR
    generator.save_training_data(
        pairs,
        output_dir / "training_data.jsonl",
        format="jsonl"
    )

    # Statistics
    error_types = {}
    for pair in pairs:
        error_type = pair["error_type"]
        error_types[error_type] = error_types.get(error_type, 0) + 1

    logger.info("\nError type distribution:")
    for error_type, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"  {error_type}: {count:,} ({count/len(pairs)*100:.1f}%)")

    return True


def train_model(epochs: int, batch_size: int):
    """Train model with specified parameters"""
    from finetune_model import ModelFineTuner

    training_data_path = settings.TRAINING_DATA_DIR / "training_data.jsonl"

    if not training_data_path.exists():
        logger.error(f"Training data not found at {training_data_path}")
        return False

    # Initialize fine-tuner
    fine_tuner = ModelFineTuner()

    # Load data
    full_dataset = fine_tuner.load_training_data(training_data_path)

    # Split into train/eval
    split = full_dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split['train']
    eval_dataset = split['test']

    logger.info(f"\nTraining configuration:")
    logger.info(f"  Training samples: {len(train_dataset):,}")
    logger.info(f"  Evaluation samples: {len(eval_dataset):,}")
    logger.info(f"  Epochs: {epochs}")
    logger.info(f"  Batch size: {batch_size}")

    # Calculate steps
    steps_per_epoch = len(train_dataset) // batch_size
    total_steps = steps_per_epoch * epochs

    logger.info(f"  Steps per epoch: {steps_per_epoch:,}")
    logger.info(f"  Total steps: {total_steps:,}")

    # Train
    logger.info("\nStarting training...")
    start_time = time.time()

    trainer = fine_tuner.train(
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        num_epochs=epochs,
        batch_size=batch_size,
        learning_rate=5e-5
    )

    training_time = time.time() - start_time

    logger.info("\n" + "="*60)
    logger.info("Training complete!")
    logger.info(f"Total time: {training_time/60:.1f} minutes")
    logger.info(f"Model saved to: {fine_tuner.output_dir / 'final'}")
    logger.info("="*60)

    # Quick evaluation
    test_examples = [
        {"error": "teh", "correction": "the"},
        {"error": "alot", "correction": "a lot"},
        {"error": "I has a apple", "correction": "I have an apple"},
        {"error": "She dont like it", "correction": "She doesn't like it"},
        {"error": "freind", "correction": "friend"},
    ]

    logger.info("\nQuick evaluation on test examples:")
    accuracy = fine_tuner.evaluate(
        fine_tuner.output_dir / "final",
        test_examples
    )

    return True


def main():
    """Main function for 1-hour optimized training"""
    logger.info("="*60)
    logger.info("ONE-HOUR OPTIMIZED TRAINING")
    logger.info("="*60)

    # Calculate optimal parameters
    params = calculate_optimal_training_params()

    logger.info(f"\nOptimized configuration for 1-hour training:")
    logger.info(f"  Target examples: {params['target_examples']:,}")
    logger.info(f"  Epochs: {params['epochs']}")
    logger.info(f"  Batch size: {params['batch_size']}")
    logger.info(f"  Estimated time: {params['estimated_time_minutes']} minutes")

    # Check if training data already exists
    training_data_path = settings.TRAINING_DATA_DIR / "training_data.jsonl"

    if training_data_path.exists():
        logger.info(f"\nTraining data already exists at: {training_data_path}")
        regenerate = input("Regenerate training data? (y/N): ").strip().lower()

        if regenerate == 'y':
            logger.info("\n" + "="*60)
            logger.info("STEP 1: Generating Training Data")
            logger.info("="*60)
            if not generate_training_data(params['target_examples']):
                return
        else:
            logger.info("Using existing training data")
    else:
        logger.info("\n" + "="*60)
        logger.info("STEP 1: Generating Training Data")
        logger.info("="*60)
        if not generate_training_data(params['target_examples']):
            return

    # Train model
    logger.info("\n" + "="*60)
    logger.info("STEP 2: Training Model")
    logger.info("="*60)

    proceed = input("\nStart training? (Y/n): ").strip().lower()
    if proceed == 'n':
        logger.info("Training cancelled")
        return

    train_model(params['epochs'], params['batch_size'])

    logger.info("\n" + "="*60)
    logger.info("COMPLETE!")
    logger.info("="*60)
    logger.info("\nNext steps:")
    logger.info("1. Test your model: python test_model.py")
    logger.info("2. Continue training: python continue_training.py")
    logger.info("3. Update config.py to use your fine-tuned model")


if __name__ == "__main__":
    # Check dependencies
    try:
        import torch
        import transformers
        import datasets
    except ImportError:
        logger.error("Missing required dependencies")
        logger.error("Please install: pip install torch transformers datasets tqdm")
        sys.exit(1)

    main()
