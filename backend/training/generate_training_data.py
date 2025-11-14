"""
Generate training data with synthetic errors
Creates error-correction pairs from clean corpus text
"""
import random
import re
import json
from pathlib import Path
from typing import List, Tuple, Dict
import logging
from tqdm import tqdm

from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ErrorGenerator:
    """
    Generate synthetic spelling and grammar errors for training data
    """

    def __init__(
        self,
        typo_rate: float = None,
        grammar_rate: float = None,
        seed: int = 42
    ):
        """
        Initialize error generator

        Args:
            typo_rate: Probability of introducing typo errors
            grammar_rate: Probability of introducing grammar errors
            seed: Random seed for reproducibility
        """
        self.typo_rate = typo_rate or settings.TYPO_ERROR_RATE
        self.grammar_rate = grammar_rate or settings.GRAMMAR_ERROR_RATE

        random.seed(seed)

        # Define error patterns
        self.typo_patterns = self._load_typo_patterns()
        self.grammar_patterns = self._load_grammar_patterns()
        self.homophones = self._load_homophones()

        logger.info(f"Initialized ErrorGenerator (typo_rate={self.typo_rate}, grammar_rate={self.grammar_rate})")

    def _load_typo_patterns(self) -> List[Tuple[str, str, str]]:
        """
        Load typo patterns
        Returns: List of (pattern_name, pattern, action) tuples
        """
        return [
            # Character swaps (transpositions)
            ("transpose", "swap_adjacent", "transpose"),

            # Missing characters
            ("omission", "remove_char", "omit"),

            # Extra characters
            ("insertion", "duplicate_char", "insert"),

            # Wrong character (substitution)
            ("substitution", "replace_char", "substitute"),

            # Double letters
            ("double", "double_letter", "double"),

            # Common keyboard mistakes (QWERTY proximity)
            ("keyboard", "nearby_key", "keyboard"),
        ]

    def _load_grammar_patterns(self) -> Dict[str, List[Tuple[str, str]]]:
        """
        Load grammar error patterns
        Returns: Dict of error_type -> [(correct, wrong)] pairs
        """
        return {
            "should_have": [
                (r"\bshould have\b", "should of"),
                (r"\bcould have\b", "could of"),
                (r"\bwould have\b", "would of"),
                (r"\bmust have\b", "must of"),
                (r"\bmight have\b", "might of"),
            ],
            "two_words": [
                (r"\ba lot\b", "alot"),
                (r"\bas well\b", "aswell"),
                (r"\bin fact\b", "infact"),
                (r"\ball right\b", "alright"),
            ],
            "subject_verb": [
                (r"\b(I|you|we|they) is\b", r"\1 are"),  # Wrong: reverse
                (r"\b(he|she|it) are\b", r"\1 is"),
                (r"\b(I) are\b", r"\1 am"),
                (r"\b(he|she|it) doesn't\b", r"\1 don't"),
                (r"\b(I|you|we|they) doesn't\b", r"\1 don't"),
            ],
            "articles": [
                (r"\ban ([bcdfghjklmnpqrstvwxyz])", r"a \1"),  # Wrong: reverse
                (r"\ba ([aeiou])", r"an \1"),
            ],
            "its_vs_its": [
                (r"\bits\b", "it's"),  # Sometimes swap (50% of time)
                (r"\bit's\b", "its"),
            ],
            "there_their_theyre": [
                (r"\btheir\b", "there"),
                (r"\bthere\b", "their"),
                (r"\bthey're\b", "their"),
                (r"\btheir\b", "they're"),
            ],
            "your_youre": [
                (r"\byour\b", "you're"),
                (r"\byou're\b", "your"),
            ],
            "to_too_two": [
                (r"\btoo\b", "to"),
                (r"\bto\b", "too"),
            ],
        }

    def _load_homophones(self) -> List[Tuple[str, str]]:
        """Load homophone pairs"""
        return [
            ("their", "there"),
            ("they're", "their"),
            ("your", "you're"),
            ("its", "it's"),
            ("to", "too"),
            ("two", "to"),
            ("than", "then"),
            ("affect", "effect"),
            ("accept", "except"),
            ("brake", "break"),
            ("by", "buy"),
            ("peace", "piece"),
            ("principle", "principal"),
            ("weather", "whether"),
        ]

    def introduce_typo(self, word: str) -> str:
        """
        Introduce a random typo into a word

        Args:
            word: Original word

        Returns:
            Word with typo
        """
        if len(word) < 3:
            return word  # Too short for meaningful typos

        typo_type = random.choice(self.typo_patterns)
        action = typo_type[2]

        if action == "transpose" and len(word) >= 3:
            # Swap two adjacent characters
            pos = random.randint(0, len(word) - 2)
            word_list = list(word)
            word_list[pos], word_list[pos + 1] = word_list[pos + 1], word_list[pos]
            return ''.join(word_list)

        elif action == "omit" and len(word) >= 4:
            # Remove a random character
            pos = random.randint(1, len(word) - 2)  # Not first or last
            return word[:pos] + word[pos + 1:]

        elif action == "insert":
            # Duplicate a random character
            pos = random.randint(0, len(word) - 1)
            return word[:pos + 1] + word[pos] + word[pos + 1:]

        elif action == "substitute" and len(word) >= 3:
            # Replace a character with a nearby one
            pos = random.randint(1, len(word) - 2)
            char = word[pos]
            # QWERTY keyboard proximity
            keyboard_neighbors = {
                'a': 'sq', 'b': 'vgn', 'c': 'xdfv', 'd': 'sfxce', 'e': 'wrd',
                'f': 'dgcr', 'g': 'fhvt', 'h': 'gjby', 'i': 'uok', 'j': 'hknm',
                'k': 'jlm', 'l': 'kop', 'm': 'njk', 'n': 'bhjm', 'o': 'ilp',
                'p': 'ol', 'q': 'wa', 'r': 'etf', 's': 'adwx', 't': 'rgy',
                'u': 'yij', 'v': 'cbfg', 'w': 'qse', 'x': 'zsdc', 'y': 'tuh',
                'z': 'xsa'
            }
            neighbors = keyboard_neighbors.get(char.lower(), 'aeiou')
            replacement = random.choice(neighbors)
            return word[:pos] + replacement + word[pos + 1:]

        elif action == "double" and len(word) >= 3:
            # Double a letter that shouldn't be doubled
            pos = random.randint(1, len(word) - 2)
            if word[pos] == word[pos + 1]:
                # Already doubled, remove one
                return word[:pos] + word[pos + 1:]
            else:
                # Double it
                return word[:pos + 1] + word[pos] + word[pos + 1:]

        return word

    def introduce_grammar_error(self, sentence: str) -> Tuple[str, str]:
        """
        Introduce a grammar error into a sentence

        Args:
            sentence: Original sentence

        Returns:
            (erroneous_sentence, error_type)
        """
        # Choose random error category
        error_category = random.choice(list(self.grammar_patterns.keys()))
        patterns = self.grammar_patterns[error_category]

        # Try to apply error pattern
        for correct_pattern, wrong_replacement in patterns:
            if re.search(correct_pattern, sentence, re.IGNORECASE):
                # Apply the error (reverse the correction)
                if error_category in ["subject_verb", "articles"]:
                    # For these, swap correct with wrong
                    erroneous = re.sub(correct_pattern, wrong_replacement, sentence, count=1, flags=re.IGNORECASE)
                else:
                    # Direct replacement
                    erroneous = re.sub(correct_pattern, wrong_replacement, sentence, count=1, flags=re.IGNORECASE)

                if erroneous != sentence:
                    return erroneous, error_category

        # Fallback: try homophone error
        words = sentence.split()
        for i, word in enumerate(words):
            word_lower = word.lower().strip('.,!?;:')
            for correct, wrong in self.homophones:
                if word_lower == correct:
                    # Replace with homophone
                    words[i] = word.replace(word_lower, wrong)
                    return ' '.join(words), "homophone"

        return sentence, "none"

    def create_error_correction_pairs(
        self,
        text: str,
        max_pairs: int = 10000
    ) -> List[Dict[str, str]]:
        """
        Create error-correction training pairs from clean text

        Args:
            text: Clean source text
            max_pairs: Maximum number of pairs to generate

        Returns:
            List of {"error": ..., "correction": ..., "error_type": ...} dicts
        """
        pairs = []

        # Split into sentences
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

        logger.info(f"Processing {len(sentences)} sentences...")

        for sentence in tqdm(sentences[:max_pairs]):
            # Original sentence is correct
            original = sentence

            # 1. Generate typo errors (word-level)
            if random.random() < self.typo_rate:
                words = original.split()
                typo_words = []

                for word in words:
                    if len(word) > 3 and word.isalpha() and random.random() < 0.3:
                        # Introduce typo with 30% probability per word
                        typo_word = self.introduce_typo(word)
                        typo_words.append(typo_word)
                    else:
                        typo_words.append(word)

                erroneous = ' '.join(typo_words)

                if erroneous != original:
                    pairs.append({
                        "error": erroneous,
                        "correction": original,
                        "error_type": "typo"
                    })

            # 2. Generate grammar errors (sentence-level)
            if random.random() < self.grammar_rate:
                erroneous, error_type = self.introduce_grammar_error(original)

                if erroneous != original:
                    pairs.append({
                        "error": erroneous,
                        "correction": original,
                        "error_type": error_type
                    })

            # Stop if we have enough
            if len(pairs) >= max_pairs:
                break

        logger.info(f"Generated {len(pairs)} error-correction pairs")

        return pairs

    def save_training_data(
        self,
        pairs: List[Dict[str, str]],
        output_path: Path,
        format: str = "jsonl"
    ):
        """
        Save training data to file

        Args:
            pairs: List of error-correction pairs
            output_path: Output file path
            format: Output format (jsonl, csv, txt)
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if format == "jsonl":
            with open(output_path, 'w', encoding='utf-8') as f:
                for pair in pairs:
                    f.write(json.dumps(pair, ensure_ascii=False) + '\n')

        elif format == "csv":
            import csv
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=["error", "correction", "error_type"])
                writer.writeheader()
                writer.writerows(pairs)

        elif format == "txt":
            # Format for T5-style training: "grammar: ERROR" -> "CORRECTION"
            with open(output_path, 'w', encoding='utf-8') as f:
                for pair in pairs:
                    f.write(f"grammar: {pair['error']}\t{pair['correction']}\n")

        logger.info(f"Saved {len(pairs)} pairs to {output_path}")


def main():
    """Main function for standalone execution"""
    # Load corpus
    corpus_path = settings.CORPUS_DIR / "combined_corpus.txt"

    if not corpus_path.exists():
        logger.error(f"Corpus not found at {corpus_path}")
        logger.error("Please run download_corpus.py first")
        return

    logger.info(f"Loading corpus from {corpus_path}...")
    with open(corpus_path, 'r', encoding='utf-8') as f:
        corpus_text = f.read()

    logger.info(f"Corpus size: {len(corpus_text)} characters")

    # Generate errors
    generator = ErrorGenerator()

    pairs = generator.create_error_correction_pairs(
        corpus_text,
        max_pairs=10000
    )

    # Save in multiple formats
    output_dir = settings.TRAINING_DATA_DIR

    generator.save_training_data(
        pairs,
        output_dir / "training_data.jsonl",
        format="jsonl"
    )

    generator.save_training_data(
        pairs,
        output_dir / "training_data.csv",
        format="csv"
    )

    generator.save_training_data(
        pairs,
        output_dir / "training_data.txt",
        format="txt"
    )

    # Statistics
    error_types = {}
    for pair in pairs:
        error_type = pair["error_type"]
        error_types[error_type] = error_types.get(error_type, 0) + 1

    logger.info("Error type distribution:")
    for error_type, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"  {error_type}: {count} ({count/len(pairs)*100:.1f}%)")


if __name__ == "__main__":
    main()
