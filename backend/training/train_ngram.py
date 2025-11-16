"""
Train N-gram model on literature corpus
"""
import sys
from pathlib import Path

# Add parent directory to path so we can import backend module
script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import logging
from typing import List
import time

from backend.models.ngram_model import NgramModel
from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_corpus_texts(corpus_dir: Path) -> List[str]:
    """
    Load all texts from corpus directory

    Args:
        corpus_dir: Directory containing corpus files

    Returns:
        List of text strings
    """
    texts = []

    # Load combined corpus if available
    combined_file = corpus_dir / "combined_corpus.txt"
    if combined_file.exists():
        logger.info(f"Loading combined corpus from {combined_file}...")
        with open(combined_file, 'r', encoding='utf-8') as f:
            combined_text = f.read()

        # Split by book markers
        book_texts = combined_text.split("=== NEW BOOK ===")
        texts.extend([t.strip() for t in book_texts if t.strip()])

        logger.info(f"Loaded {len(texts)} books from combined corpus")
        return texts

    # Otherwise load individual books
    book_files = list(corpus_dir.glob("book_*.txt"))

    if not book_files:
        logger.error(f"No corpus files found in {corpus_dir}")
        return []

    logger.info(f"Loading {len(book_files)} individual book files...")

    for book_file in book_files:
        with open(book_file, 'r', encoding='utf-8') as f:
            text = f.read()
            if text.strip():
                texts.append(text)

    logger.info(f"Loaded {len(texts)} books")
    return texts


def train_ngram_model(
    corpus_dir: Path = None,
    order: int = None,
    min_count: int = 2,
    save_path: Path = None
) -> NgramModel:
    """
    Train n-gram model on corpus

    Args:
        corpus_dir: Directory containing corpus files
        order: N-gram order (1-4)
        min_count: Minimum count to include n-gram
        save_path: Path to save trained model

    Returns:
        Trained NgramModel
    """
    corpus_dir = corpus_dir or settings.CORPUS_DIR
    order = order or settings.NGRAM_ORDER
    save_path = save_path or settings.NGRAM_MODEL_PATH

    # Load corpus
    texts = load_corpus_texts(corpus_dir)

    if not texts:
        logger.error("No corpus texts available for training")
        return None

    # Calculate corpus statistics
    total_chars = sum(len(t) for t in texts)
    total_words = sum(len(t.split()) for t in texts)

    logger.info(f"Corpus statistics:")
    logger.info(f"  Number of books: {len(texts)}")
    logger.info(f"  Total characters: {total_chars:,}")
    logger.info(f"  Total words: {total_words:,}")
    logger.info(f"  Average words per book: {total_words // len(texts):,}")

    # Create model
    logger.info(f"Creating {order}-gram model...")
    model = NgramModel(order=order)

    # Train
    start_time = time.time()
    model.train(texts, min_count=min_count)
    training_time = time.time() - start_time

    logger.info(f"Training completed in {training_time:.2f} seconds")

    # Save model
    logger.info(f"Saving model to {save_path}...")
    model.save(save_path)

    # Save vocabulary separately
    vocab_path = settings.NGRAM_VOCAB_PATH
    import pickle
    with open(vocab_path, 'wb') as f:
        pickle.dump(model.vocabulary, f)
    logger.info(f"Vocabulary saved to {vocab_path}")

    # Test model with examples
    logger.info("\nTesting model with example contexts:")

    test_contexts = [
        ["the"],
        ["in", "the"],
        ["it", "is", "a"],
        ["once", "upon", "a"],
    ]

    for context in test_contexts:
        predictions = model.get_next_word_predictions(context, top_k=5)
        logger.info(f"  Context: {' '.join(context)}")
        for word, prob in predictions[:5]:
            logger.info(f"    {word}: {prob:.6f}")

    return model


def main():
    """Main function for standalone execution"""
    logger.info("Starting n-gram model training...")

    # Check if corpus exists
    if not settings.CORPUS_DIR.exists() or not list(settings.CORPUS_DIR.glob("*.txt")):
        logger.error(f"No corpus found in {settings.CORPUS_DIR}")
        logger.error("Please run download_corpus.py first to download training data")
        return

    # Train model
    model = train_ngram_model()

    if model:
        logger.info("\n" + "="*50)
        logger.info("N-gram model training complete!")
        logger.info(f"Model saved to: {settings.NGRAM_MODEL_PATH}")
        logger.info(f"Vocabulary size: {len(model.vocabulary)}")
        logger.info(f"Total words processed: {model.total_words:,}")
        logger.info("="*50)


if __name__ == "__main__":
    main()
