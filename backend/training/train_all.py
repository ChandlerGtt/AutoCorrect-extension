"""
Quick-start script to train a custom autocorrect model
Runs entire pipeline: corpus download → data generation → model fine-tuning
"""
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import logging
from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Run full training pipeline"""
    logger.info("="*60)
    logger.info("AutoCorrect Model Training Pipeline")
    logger.info("="*60)

    # Check if corpus exists
    corpus_path = settings.CORPUS_DIR / "combined_corpus.txt"

    if not corpus_path.exists():
        logger.info("\n📚 Step 1/3: Downloading training corpus...")
        logger.info("This will download ~50 books from Project Gutenberg")

        try:
            from download_corpus import main as download_corpus
            download_corpus()
        except Exception as e:
            logger.error(f"Failed to download corpus: {e}")
            logger.error("\nPlease run manually: python download_corpus.py")
            return
    else:
        logger.info(f"✅ Corpus already exists: {corpus_path}")

    # Generate training data
    logger.info("\n📝 Step 2/3: Generating training data...")
    logger.info("Creating error-correction pairs (including common misspellings)")

    training_data_path = settings.TRAINING_DATA_DIR / "training_data.jsonl"

    if not training_data_path.exists():
        try:
            from generate_training_data import main as generate_data
            generate_data()
        except Exception as e:
            logger.error(f"Failed to generate training data: {e}")
            logger.error("\nPlease run manually: python generate_training_data.py")
            return
    else:
        logger.info(f"✅ Training data already exists: {training_data_path}")
        user_input = input("\nRegenerate training data? (y/N): ").strip().lower()
        if user_input == 'y':
            from generate_training_data import main as generate_data
            generate_data()

    # Fine-tune model
    logger.info("\n🧠 Step 3/3: Fine-tuning neural model...")
    logger.info("This may take 30-60 minutes on CPU, 5-10 minutes on GPU")
    logger.info(f"Base model: {settings.SMALL_MODEL_NAME if settings.USE_SMALL_MODEL else settings.PRETRAINED_MODEL_NAME}")

    user_input = input("\nStart training? (Y/n): ").strip().lower()
    if user_input == 'n':
        logger.info("Training cancelled")
        return

    try:
        from finetune_model import main as finetune
        finetune()
    except Exception as e:
        logger.error(f"Failed to fine-tune model: {e}")
        logger.error("\nPlease run manually: python finetune_model.py")
        return

    # Success!
    logger.info("\n" + "="*60)
    logger.info("✅ Training complete!")
    logger.info("="*60)
    logger.info("\nYour fine-tuned model is saved at:")
    logger.info(f"  {settings.MODEL_CACHE_DIR / 'finetuned' / 'final'}")
    logger.info("\nNext steps:")
    logger.info("1. Update backend/config.py:")
    logger.info(f"   CUSTOM_MODEL_PATH = BASE_DIR / 'models' / 'cache' / 'finetuned' / 'final'")
    logger.info("2. Remove hardcoded common_misspellings from spell_checker.py")
    logger.info("3. Restart backend: uvicorn main:app --reload")
    logger.info("\nSee TRAINING_GUIDE.md for detailed instructions")


if __name__ == "__main__":
    # Check dependencies
    try:
        import torch
        import transformers
        import datasets
    except ImportError as e:
        logger.error("Missing required dependencies")
        logger.error("Please install: pip install torch transformers datasets tqdm")
        sys.exit(1)

    main()
