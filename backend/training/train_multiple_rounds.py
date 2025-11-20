"""
Train model multiple times in succession
Useful for extended training sessions
"""
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import logging
from finetune_model import ModelFineTuner
from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def train_multiple_rounds(
    num_rounds: int = 10,
    epochs_per_round: int = 3,
    initial_lr: float = 5e-5,
    lr_decay: float = 0.9  # Reduce LR by 10% each round
):
    """
    Train model for multiple rounds

    Args:
        num_rounds: Number of training rounds (e.g., 10)
        epochs_per_round: Epochs per round (e.g., 3)
        initial_lr: Starting learning rate
        lr_decay: Learning rate decay factor per round
    """
    logger.info("="*60)
    logger.info(f"Multi-Round Training: {num_rounds} rounds × {epochs_per_round} epochs")
    logger.info(f"Total epochs: {num_rounds * epochs_per_round}")
    logger.info("="*60)

    # Load training data once
    training_data_path = settings.TRAINING_DATA_DIR / "training_data.jsonl"

    if not training_data_path.exists():
        logger.error(f"Training data not found at {training_data_path}")
        return

    fine_tuner = ModelFineTuner()

    # Load and split data
    full_dataset = fine_tuner.load_training_data(training_data_path)
    split = full_dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split['train']
    eval_dataset = split['test']

    logger.info(f"Training samples: {len(train_dataset)}")
    logger.info(f"Evaluation samples: {len(eval_dataset)}")

    # Train for multiple rounds
    for round_num in range(1, num_rounds + 1):
        # Calculate learning rate with decay
        current_lr = initial_lr * (lr_decay ** (round_num - 1))

        logger.info("\n" + "="*60)
        logger.info(f"ROUND {round_num}/{num_rounds}")
        logger.info(f"Learning rate: {current_lr:.6f}")
        logger.info("="*60)

        # For rounds after the first, load from previous checkpoint
        if round_num > 1:
            previous_checkpoint = settings.MODEL_CACHE_DIR / "finetuned" / "final"
            logger.info(f"Loading from checkpoint: {previous_checkpoint}")
            fine_tuner = ModelFineTuner(
                base_model=str(previous_checkpoint),
                output_dir=settings.MODEL_CACHE_DIR / "finetuned"
            )

        # Train
        trainer = fine_tuner.train(
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            num_epochs=epochs_per_round,
            batch_size=8,
            learning_rate=current_lr
        )

        # Log progress
        logger.info(f"\nCompleted round {round_num}/{num_rounds}")
        logger.info(f"Cumulative epochs: {round_num * epochs_per_round}")

    logger.info("\n" + "="*60)
    logger.info("ALL ROUNDS COMPLETE!")
    logger.info(f"Total epochs trained: {num_rounds * epochs_per_round}")
    logger.info(f"Final model saved to: {fine_tuner.output_dir / 'final'}")
    logger.info("="*60)


def main():
    """Main function"""
    print("Multi-Round Training Configuration")
    print("="*60)

    # Get user input
    try:
        num_rounds = int(input("Number of training rounds (e.g., 10): ").strip() or "10")
        epochs_per_round = int(input("Epochs per round (e.g., 3): ").strip() or "3")

        total_epochs = num_rounds * epochs_per_round
        estimated_time_cpu = (total_epochs * 15) / 60  # ~15 min per epoch on CPU

        print(f"\nTotal epochs: {total_epochs}")
        print(f"Estimated time (CPU): ~{estimated_time_cpu:.1f} hours")
        print(f"Estimated time (GPU): ~{estimated_time_cpu/6:.1f} hours")

        confirm = input("\nStart training? (y/N): ").strip().lower()
        if confirm != 'y':
            print("Training cancelled")
            return

    except ValueError:
        logger.error("Invalid input")
        return

    # Start training
    train_multiple_rounds(
        num_rounds=num_rounds,
        epochs_per_round=epochs_per_round,
        initial_lr=5e-5,
        lr_decay=0.95  # Gradually reduce LR
    )


if __name__ == "__main__":
    main()
