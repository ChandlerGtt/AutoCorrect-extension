"""
Show statistics about the training corpus
Helps understand the data available for training
"""
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(script_dir))

import re
from collections import Counter
from backend.config import settings


def analyze_corpus(corpus_path: Path):
    """Analyze corpus and show statistics"""
    print("="*60)
    print(f"Analyzing corpus: {corpus_path}")
    print("="*60)

    if not corpus_path.exists():
        print(f"\n❌ Corpus not found at: {corpus_path}")
        print("\nTo download corpus:")
        print("  cd backend/training")
        print("  python download_corpus.py")
        return

    # Read corpus
    print("\nReading corpus...")
    with open(corpus_path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    # Basic stats
    print("\n" + "-"*60)
    print("BASIC STATISTICS")
    print("-"*60)

    char_count = len(text)
    word_count = len(text.split())
    sentence_count = len(re.split(r'[.!?]+', text))

    print(f"Characters: {char_count:,}")
    print(f"Words: {word_count:,}")
    print(f"Sentences: {sentence_count:,}")
    print(f"Size: {char_count / (1024*1024):.2f} MB")

    # Word frequency
    print("\n" + "-"*60)
    print("TOP 20 MOST COMMON WORDS")
    print("-"*60)

    words = re.findall(r'\b\w+\b', text.lower())
    word_freq = Counter(words)

    for word, count in word_freq.most_common(20):
        percentage = (count / len(words)) * 100
        print(f"  {word:15} {count:8,} ({percentage:5.2f}%)")

    # Check for common misspelling targets
    print("\n" + "-"*60)
    print("COMMON WORDS (for misspelling injection)")
    print("-"*60)

    target_words = {
        "the": "teh",
        "and": "adn",
        "friend": "freind",
        "receive": "recieve",
        "believe": "beleive",
        "a lot": "alot",
        "don't": "dont",
        "can't": "cant",
    }

    for correct, misspelling in target_words.items():
        # Count occurrences (case-insensitive, whole word)
        pattern = r'\b' + re.escape(correct) + r'\b'
        count = len(re.findall(pattern, text.lower()))

        if count > 0:
            print(f"  '{correct}' appears {count:,} times (can create {min(count, 10)} training examples)")
        else:
            print(f"  '{correct}' not found (won't have training examples for '{misspelling}')")

    # Training data estimates
    print("\n" + "-"*60)
    print("TRAINING DATA ESTIMATES")
    print("-"*60)

    # Estimate based on error rates from config
    typo_rate = 0.15  # 15%
    grammar_rate = 0.10  # 10%
    combined_rate = typo_rate + grammar_rate  # ~25%

    sentences_with_errors = int(sentence_count * combined_rate)

    print(f"\nWith current error rates (typo: {typo_rate*100:.0f}%, grammar: {grammar_rate*100:.0f}%):")
    print(f"  Total sentences: {sentence_count:,}")
    print(f"  Expected training pairs: ~{sentences_with_errors:,}")

    # For different processing limits
    print(f"\nProcessing limits:")
    for limit in [10000, 25000, 50000, 100000]:
        if limit <= sentence_count:
            estimated_pairs = int(limit * combined_rate)
            print(f"  Process {limit:,} sentences → ~{estimated_pairs:,} training pairs")

    # Sentence length distribution
    print("\n" + "-"*60)
    print("SENTENCE LENGTH DISTRIBUTION")
    print("-"*60)

    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 0]
    sentence_lengths = [len(s.split()) for s in sentences]

    if sentence_lengths:
        avg_length = sum(sentence_lengths) / len(sentence_lengths)
        min_length = min(sentence_lengths)
        max_length = max(sentence_lengths)

        print(f"  Average: {avg_length:.1f} words")
        print(f"  Min: {min_length} words")
        print(f"  Max: {max_length} words")

        # Histogram
        length_buckets = {
            "1-5 words": 0,
            "6-10 words": 0,
            "11-20 words": 0,
            "21-50 words": 0,
            "50+ words": 0,
        }

        for length in sentence_lengths:
            if length <= 5:
                length_buckets["1-5 words"] += 1
            elif length <= 10:
                length_buckets["6-10 words"] += 1
            elif length <= 20:
                length_buckets["11-20 words"] += 1
            elif length <= 50:
                length_buckets["21-50 words"] += 1
            else:
                length_buckets["50+ words"] += 1

        print("\n  Distribution:")
        for bucket, count in length_buckets.items():
            percentage = (count / len(sentences)) * 100
            bar = "█" * int(percentage / 2)
            print(f"    {bucket:15} {count:8,} ({percentage:5.1f}%) {bar}")

    print("\n" + "="*60)


def main():
    """Main function"""
    corpus_path = settings.CORPUS_DIR / "combined_corpus.txt"
    analyze_corpus(corpus_path)

    print("\nTo generate training data:")
    print("  python generate_training_data.py")
    print("\nTo train model:")
    print("  python train_one_hour.py")


if __name__ == "__main__":
    main()
