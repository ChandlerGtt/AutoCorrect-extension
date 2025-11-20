"""
Continue training an already fine-tuned model
Loads the existing checkpoint and trains for additional epochs
"""
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    Trainer,
    TrainingArguments,
    DataCollatorForSeq2Seq
)
from datasets import Dataset
import logging

from backend.config import settings
from finetune_model import ModelFineTuner

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def continue_training(
    checkpoint_path: Path,
    additional_epochs: int = 3,
    learning_rate: float = 3e-5  # Lower LR for continued training
):
    """
    Continue training from an existing checkpoint

    Args:
        checkpoint_path: Path to saved model checkpoint
        additional_epochs: Number of additional epochs to train
        learning_rate: Learning rate (usually lower for continued training)
    """
    logger.info("="*60)
    logger.info("Continuing Training from Checkpoint")
    logger.info("="*60)
    logger.info(f"Checkpoint: {checkpoint_path}")
    logger.info(f"Additional epochs: {additional_epochs}")
    logger.info(f"Learning rate: {learning_rate}")

    # Load training data
    training_data_path = settings.TRAINING_DATA_DIR / "training_data.jsonl"

    if not training_data_path.exists():
        logger.error(f"Training data not found at {training_data_path}")
        return

    # Initialize fine-tuner with checkpoint path
    fine_tuner = ModelFineTuner(
        base_model=str(checkpoint_path),  # Load from checkpoint instead of HF hub
        output_dir=settings.MODEL_CACHE_DIR / "finetuned_continued"
    )

    # Load data
    full_dataset = fine_tuner.load_training_data(training_data_path)
    split = full_dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split['train']
    eval_dataset = split['test']

    logger.info(f"Training samples: {len(train_dataset)}")
    logger.info(f"Evaluation samples: {len(eval_dataset)}")

    # Continue training
    trainer = fine_tuner.train(
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        num_epochs=additional_epochs,
        batch_size=8,
        learning_rate=learning_rate  # Use lower LR
    )

    logger.info("\n" + "="*60)
    logger.info("Continued training complete!")
    logger.info(f"Model saved to: {fine_tuner.output_dir / 'final'}")
    logger.info("="*60)

    return trainer


def main():
    """Main function"""
    # Path to your first fine-tuned model
    checkpoint_path = settings.MODEL_CACHE_DIR / "finetuned" / "final"

    if not checkpoint_path.exists():
        logger.error(f"Checkpoint not found at {checkpoint_path}")
        logger.error("Please complete initial training first: python finetune_model.py")
        return

    logger.info(f"Found checkpoint at: {checkpoint_path}")

    # Ask user how many additional epochs
    print("\nHow many additional epochs to train?")
    print("(Recommended: 3-10 epochs at a time)")
    try:
        additional_epochs = int(input("Epochs: ").strip() or "3")
    except ValueError:
        additional_epochs = 3

    # Continue training
    continue_training(
        checkpoint_path=checkpoint_path,
        additional_epochs=additional_epochs,
        learning_rate=3e-5  # Lower than initial 5e-5
    )


if __name__ == "__main__":
    main()
