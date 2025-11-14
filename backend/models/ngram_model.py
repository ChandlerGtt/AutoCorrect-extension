"""
Enhanced N-gram Language Model
Scales from bigram to 4-gram with literature corpus training
"""
from typing import List, Tuple, Dict, Optional, Set
from collections import defaultdict, Counter
import pickle
import logging
from pathlib import Path
import re

from backend.config import settings

logger = logging.getLogger(__name__)


class NgramModel:
    """
    N-gram language model for context-based word ranking.
    Supports unigram through 4-gram models.
    """

    def __init__(self, order: int = 4):
        """
        Initialize n-gram model

        Args:
            order: N-gram order (1=unigram, 2=bigram, 3=trigram, 4=4-gram)
        """
        self.order = min(order, 4)  # Cap at 4-gram

        # N-gram frequency dictionaries
        self.unigrams: Counter = Counter()
        self.bigrams: Dict[str, Counter] = defaultdict(Counter)
        self.trigrams: Dict[Tuple[str, str], Counter] = defaultdict(Counter)
        self.fourgrams: Dict[Tuple[str, str, str], Counter] = defaultdict(Counter)

        # Vocabulary
        self.vocabulary: Set[str] = set()

        # Statistics
        self.total_words = 0
        self.trained = False

        logger.info(f"Initialized {order}-gram model")

    def train(self, texts: List[str], min_count: int = 2):
        """
        Train n-gram model on corpus

        Args:
            texts: List of text documents
            min_count: Minimum count to include n-gram
        """
        logger.info(f"Training {self.order}-gram model on {len(texts)} documents...")

        for text in texts:
            tokens = self._tokenize(text)
            self._add_tokens(tokens)

        # Filter low-frequency n-grams
        self._filter_ngrams(min_count)

        self.trained = True
        logger.info(f"Training complete. Vocabulary size: {len(self.vocabulary)}")
        logger.info(f"Total words processed: {self.total_words}")
        logger.info(f"Unique unigrams: {len(self.unigrams)}")
        logger.info(f"Unique bigrams: {sum(len(v) for v in self.bigrams.values())}")
        if self.order >= 3:
            logger.info(f"Unique trigrams: {sum(len(v) for v in self.trigrams.values())}")
        if self.order >= 4:
            logger.info(f"Unique 4-grams: {sum(len(v) for v in self.fourgrams.values())}")

    def _tokenize(self, text: str) -> List[str]:
        """
        Tokenize text into words

        Args:
            text: Input text

        Returns:
            List of tokens
        """
        # Convert to lowercase and split on whitespace/punctuation
        text = text.lower()
        tokens = re.findall(r'\b[a-z]+\b', text)
        return tokens

    def _add_tokens(self, tokens: List[str]):
        """Add tokens to n-gram counts"""
        if not tokens:
            return

        for i, token in enumerate(tokens):
            # Update vocabulary and unigrams
            self.vocabulary.add(token)
            self.unigrams[token] += 1
            self.total_words += 1

            # Bigrams
            if i > 0 and self.order >= 2:
                prev1 = tokens[i - 1]
                self.bigrams[prev1][token] += 1

            # Trigrams
            if i > 1 and self.order >= 3:
                prev2 = tokens[i - 2]
                prev1 = tokens[i - 1]
                self.trigrams[(prev2, prev1)][token] += 1

            # 4-grams
            if i > 2 and self.order >= 4:
                prev3 = tokens[i - 3]
                prev2 = tokens[i - 2]
                prev1 = tokens[i - 1]
                self.fourgrams[(prev3, prev2, prev1)][token] += 1

    def _filter_ngrams(self, min_count: int):
        """Remove low-frequency n-grams"""
        # Filter unigrams
        self.unigrams = Counter({
            k: v for k, v in self.unigrams.items() if v >= min_count
        })

        # Filter bigrams
        filtered_bigrams = defaultdict(Counter)
        for prev, counter in self.bigrams.items():
            filtered_counter = Counter({
                k: v for k, v in counter.items() if v >= min_count
            })
            if filtered_counter:
                filtered_bigrams[prev] = filtered_counter
        self.bigrams = filtered_bigrams

        # Filter trigrams
        if self.order >= 3:
            filtered_trigrams = defaultdict(Counter)
            for prev, counter in self.trigrams.items():
                filtered_counter = Counter({
                    k: v for k, v in counter.items() if v >= min_count
                })
                if filtered_counter:
                    filtered_trigrams[prev] = filtered_counter
            self.trigrams = filtered_trigrams

        # Filter 4-grams
        if self.order >= 4:
            filtered_fourgrams = defaultdict(Counter)
            for prev, counter in self.fourgrams.items():
                filtered_counter = Counter({
                    k: v for k, v in counter.items() if v >= min_count
                })
                if filtered_counter:
                    filtered_fourgrams[prev] = filtered_counter
            self.fourgrams = filtered_fourgrams

    def get_probability(
        self,
        word: str,
        context: List[str],
        smoothing: float = 0.01
    ) -> float:
        """
        Get probability of word given context

        Args:
            word: Target word
            context: Previous words (context)
            smoothing: Laplace smoothing parameter

        Returns:
            Probability score (0.0 to 1.0)
        """
        if not self.trained:
            return smoothing

        word = word.lower()
        context = [w.lower() for w in context if w]

        # Use highest order n-gram available
        if len(context) >= 3 and self.order >= 4:
            return self._get_fourgram_prob(word, context[-3:], smoothing)
        elif len(context) >= 2 and self.order >= 3:
            return self._get_trigram_prob(word, context[-2:], smoothing)
        elif len(context) >= 1 and self.order >= 2:
            return self._get_bigram_prob(word, context[-1:], smoothing)
        else:
            return self._get_unigram_prob(word, smoothing)

    def _get_unigram_prob(self, word: str, smoothing: float) -> float:
        """Get unigram probability"""
        count = self.unigrams.get(word, 0)
        total = self.total_words + (len(self.vocabulary) * smoothing)
        return (count + smoothing) / total

    def _get_bigram_prob(self, word: str, context: List[str], smoothing: float) -> float:
        """Get bigram probability"""
        if not context:
            return self._get_unigram_prob(word, smoothing)

        prev = context[-1]
        bigram_count = self.bigrams[prev].get(word, 0)
        prev_count = self.unigrams.get(prev, 0)

        if prev_count == 0:
            return self._get_unigram_prob(word, smoothing)

        vocab_size = len(self.vocabulary)
        return (bigram_count + smoothing) / (prev_count + vocab_size * smoothing)

    def _get_trigram_prob(self, word: str, context: List[str], smoothing: float) -> float:
        """Get trigram probability"""
        if len(context) < 2:
            return self._get_bigram_prob(word, context, smoothing)

        prev2, prev1 = context[-2], context[-1]
        trigram_key = (prev2, prev1)
        trigram_count = self.trigrams[trigram_key].get(word, 0)
        bigram_count = self.bigrams[prev2].get(prev1, 0)

        if bigram_count == 0:
            return self._get_bigram_prob(word, [prev1], smoothing)

        vocab_size = len(self.vocabulary)
        return (trigram_count + smoothing) / (bigram_count + vocab_size * smoothing)

    def _get_fourgram_prob(self, word: str, context: List[str], smoothing: float) -> float:
        """Get 4-gram probability"""
        if len(context) < 3:
            return self._get_trigram_prob(word, context, smoothing)

        prev3, prev2, prev1 = context[-3], context[-2], context[-1]
        fourgram_key = (prev3, prev2, prev1)
        fourgram_count = self.fourgrams[fourgram_key].get(word, 0)
        trigram_count = self.trigrams[(prev3, prev2)].get(prev1, 0)

        if trigram_count == 0:
            return self._get_trigram_prob(word, [prev2, prev1], smoothing)

        vocab_size = len(self.vocabulary)
        return (fourgram_count + smoothing) / (trigram_count + vocab_size * smoothing)

    def rank_candidates(
        self,
        candidates: List[str],
        context: List[str],
        top_k: int = 5
    ) -> List[Tuple[str, float]]:
        """
        Rank candidate words by n-gram probability

        Args:
            candidates: List of candidate words
            context: Previous words
            top_k: Number of top candidates to return

        Returns:
            List of (word, probability) tuples, sorted by probability
        """
        scored_candidates = [
            (word, self.get_probability(word, context))
            for word in candidates
        ]

        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return scored_candidates[:top_k]

    def get_next_word_predictions(
        self,
        context: List[str],
        top_k: int = 10
    ) -> List[Tuple[str, float]]:
        """
        Predict next words given context

        Args:
            context: Previous words
            top_k: Number of predictions to return

        Returns:
            List of (word, probability) tuples
        """
        context = [w.lower() for w in context if w]

        # Get candidates from appropriate n-gram
        candidates = set()

        if len(context) >= 3 and self.order >= 4:
            key = tuple(context[-3:])
            if key in self.fourgrams:
                candidates.update(self.fourgrams[key].keys())

        if len(context) >= 2 and self.order >= 3:
            key = tuple(context[-2:])
            if key in self.trigrams:
                candidates.update(self.trigrams[key].keys())

        if len(context) >= 1 and self.order >= 2:
            key = context[-1]
            if key in self.bigrams:
                candidates.update(self.bigrams[key].keys())

        # If no candidates from context, use top unigrams
        if not candidates:
            candidates = set(self.unigrams.most_common(100))

        # Score all candidates
        return self.rank_candidates(list(candidates), context, top_k)

    def save(self, filepath: Optional[Path] = None):
        """Save model to disk"""
        filepath = filepath or settings.NGRAM_MODEL_PATH

        model_data = {
            'order': self.order,
            'unigrams': dict(self.unigrams),
            'bigrams': {k: dict(v) for k, v in self.bigrams.items()},
            'trigrams': {k: dict(v) for k, v in self.trigrams.items()},
            'fourgrams': {k: dict(v) for k, v in self.fourgrams.items()},
            'vocabulary': self.vocabulary,
            'total_words': self.total_words,
            'trained': self.trained
        }

        filepath.parent.mkdir(parents=True, exist_ok=True)

        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f, protocol=pickle.HIGHEST_PROTOCOL)

        logger.info(f"Model saved to {filepath}")

    def load(self, filepath: Optional[Path] = None):
        """Load model from disk"""
        filepath = filepath or settings.NGRAM_MODEL_PATH

        if not filepath.exists():
            logger.warning(f"Model file not found: {filepath}")
            return False

        try:
            with open(filepath, 'rb') as f:
                model_data = pickle.load(f)

            self.order = model_data['order']
            self.unigrams = Counter(model_data['unigrams'])
            self.bigrams = defaultdict(Counter, {
                k: Counter(v) for k, v in model_data['bigrams'].items()
            })
            self.trigrams = defaultdict(Counter, {
                k: Counter(v) for k, v in model_data['trigrams'].items()
            })
            self.fourgrams = defaultdict(Counter, {
                k: Counter(v) for k, v in model_data['fourgrams'].items()
            })
            self.vocabulary = model_data['vocabulary']
            self.total_words = model_data['total_words']
            self.trained = model_data['trained']

            logger.info(f"Model loaded from {filepath}")
            return True

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False


# Global model instance
_ngram_instance: Optional[NgramModel] = None


def get_ngram_model() -> NgramModel:
    """Get or create n-gram model singleton"""
    global _ngram_instance
    if _ngram_instance is None:
        _ngram_instance = NgramModel(order=settings.NGRAM_ORDER)

        # Try to load pre-trained model
        if settings.NGRAM_MODEL_PATH.exists():
            _ngram_instance.load()

    return _ngram_instance
