"""
Spell Checker using Levenshtein Distance
Ported from background.js - First pass correction
"""
from typing import List, Tuple, Set, Dict
import re
from pathlib import Path


class LevenshteinSpellChecker:
    """
    Traditional spell checker using edit distance.
    First pass before neural model for fast common corrections.
    """

    def __init__(self, dictionary_path: str = "/usr/share/dict/words"):
        """Initialize spell checker with dictionary"""
        self.common_misspellings = self._load_common_misspellings()  # Load first
        self.dictionary: Set[str] = self._load_dictionary(dictionary_path)
        self.phonetic_mappings = self._load_phonetic_mappings()

        # Remove common misspellings from dictionary (in case they're in there)
        # We want to correct these, not treat them as valid
        for misspelling in self.common_misspellings.keys():
            self.dictionary.discard(misspelling)

        # Frequency tiers (ported from background.js:273-306)
        self.frequency_tiers = {
            "tier1": {  # 10.0x weight
                "the", "be", "to", "of", "and", "a", "in", "that", "have",
                "I", "it", "for", "not", "on", "with", "he", "as", "you",
                "do", "at"
            },
            "tier2": {  # 5.0x weight
                "this", "but", "his", "by", "from", "they", "we", "say",
                "her", "she", "or", "an", "will", "my", "one", "all", "would",
                "there", "their", "what"
            },
            "tier3": {  # 3.0x weight
                "so", "up", "out", "if", "about", "who", "get", "which",
                "go", "me", "when", "make", "can", "like", "time", "no",
                "just", "him", "know", "take"
            },
            "tier4": {  # 1.5x weight
                "people", "into", "year", "your", "good", "some", "could",
                "them", "see", "other", "than", "then", "now", "look",
                "only", "come", "its", "over", "think", "also", "back",
                "after", "use", "two", "how", "our", "work", "first", "well"
            }
        }

    def _load_dictionary(self, path: str) -> Set[str]:
        """Load dictionary from file"""
        dictionary = set()
        dict_path = Path(path)

        if dict_path.exists():
            with open(dict_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    word = line.strip().lower()
                    if word and re.match(r'^[a-z]+$', word):
                        dictionary.add(word)
        else:
            # Fallback minimal dictionary
            dictionary = {
                "the", "be", "to", "of", "and", "a", "in", "that", "have",
                "i", "it", "for", "not", "on", "with", "he", "as", "you",
                "do", "at", "this", "but", "his", "from", "they", "we",
                "say", "her", "she", "or", "an", "will", "my", "one", "all",
                "would", "there", "their"
            }

        return dictionary

    def _load_common_misspellings(self) -> Dict[str, str]:
        """
        Common misspelling patterns (from background.js:617-661)
        """
        return {
            "teh": "the",
            "adn": "and",
            "hte": "the",
            "taht": "that",
            "thier": "their",
            "recieve": "receive",
            "occured": "occurred",
            "occurance": "occurrence",
            "seperate": "separate",
            "definately": "definitely",
            "publically": "publicly",
            "untill": "until",
            "wich": "which",
            "begining": "beginning",
            "refered": "referred",
            "accross": "across",
            "thru": "through",
            "goverment": "government",
            "enviroment": "environment",
            "realy": "really",
            "wierd": "weird",
            "beleive": "believe",
            "acheive": "achieve",
            "existance": "existence",
            "occassion": "occasion",
            "necesary": "necessary",
            "neccessary": "necessary",
            "tommorow": "tomorrow",
            "tommorrow": "tomorrow",
            "succesful": "successful",
            "basicly": "basically",
            "finaly": "finally",
            "freind": "friend",
            "mispell": "misspell",
            # Common compound word errors
            "alot": "a lot",
            "aswell": "as well",
            "infact": "in fact",
            "ofcourse": "of course"
        }

    def _load_phonetic_mappings(self) -> List[Tuple[str, str]]:
        """
        Phonetic alternative patterns (from background.js:663-681)
        """
        return [
            (r'\bnite\b', 'night'),
            (r'\blite\b', 'light'),
            (r'\bthru\b', 'through'),
            (r'\bu\b', 'you'),
            (r'\bur\b', 'your'),
            (r'\br\b', 'are'),
            (r'\bc\b', 'see'),
            (r'\bk\b', 'okay'),
            (r'\bppl\b', 'people'),
            (r'\bmsg\b', 'message'),
            (r'\btxt\b', 'text'),
            (r'\bthx\b', 'thanks'),
            (r'\bpls\b', 'please')
        ]

    def is_valid_word(self, word: str) -> bool:
        """Check if word exists in dictionary"""
        return word.lower() in self.dictionary

    def levenshtein_distance(self, s1: str, s2: str) -> int:
        """
        Calculate Levenshtein distance between two strings
        (from background.js:746-766)
        """
        if len(s1) < len(s2):
            return self.levenshtein_distance(s2, s1)

        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)

        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                # Cost of insertions, deletions, substitutions
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    def get_frequency_weight(self, word: str) -> float:
        """Get frequency weight for word based on tier"""
        word_lower = word.lower()

        if word_lower in self.frequency_tiers["tier1"]:
            return 10.0
        elif word_lower in self.frequency_tiers["tier2"]:
            return 5.0
        elif word_lower in self.frequency_tiers["tier3"]:
            return 3.0
        elif word_lower in self.frequency_tiers["tier4"]:
            return 1.5
        else:
            return 1.0

    def generate_edit_candidates(self, word: str, max_distance: int = 2) -> List[str]:
        """
        Generate candidate corrections using edit distance
        (from background.js:559-581)
        """
        candidates = []
        word_lower = word.lower()

        # Check common misspellings first
        if word_lower in self.common_misspellings:
            return [self.common_misspellings[word_lower]]

        # Generate candidates from dictionary
        for dict_word in self.dictionary:
            # Quick length filter to reduce comparisons
            if abs(len(dict_word) - len(word_lower)) > max_distance:
                continue

            distance = self.levenshtein_distance(word_lower, dict_word)
            if distance <= max_distance and distance > 0:
                candidates.append((dict_word, distance))

        # Sort by edit distance
        candidates.sort(key=lambda x: x[1])

        # Return top candidates (word only, not distance)
        return [word for word, _ in candidates[:20]]

    def apply_phonetic_fixes(self, text: str) -> str:
        """Apply phonetic corrections to text"""
        corrected = text
        for pattern, replacement in self.phonetic_mappings:
            corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)
        return corrected

    def get_corrections(
        self,
        word: str,
        context: List[str] = None,
        max_suggestions: int = 5
    ) -> List[Tuple[str, float]]:
        """
        Get spelling corrections with confidence scores

        Args:
            word: Word to correct
            context: Surrounding words for context
            max_suggestions: Maximum number of suggestions to return

        Returns:
            List of (suggestion, confidence) tuples
        """
        word_lower = word.lower()

        # Check common misspellings FIRST (before checking if word is valid)
        # This is critical because some dictionaries include typos as valid words
        if word_lower in self.common_misspellings:
            correction = self.common_misspellings[word_lower]
            return [(correction, 0.95)]

        # Already correct (check AFTER common misspellings)
        if self.is_valid_word(word_lower):
            return [(word, 1.0)]

        # Generate edit distance candidates
        candidates = self.generate_edit_candidates(word_lower)

        if not candidates:
            # Try phonetic corrections
            phonetic_corrected = self.apply_phonetic_fixes(word_lower)
            if phonetic_corrected != word_lower and self.is_valid_word(phonetic_corrected):
                return [(phonetic_corrected, 0.85)]
            return [(word, 0.0)]  # No corrections found

        # Score candidates
        scored_candidates = []
        for candidate in candidates:
            # Edit distance score (0-1, higher is better)
            distance = self.levenshtein_distance(word_lower, candidate)
            edit_score = 1.0 / (distance + 1)

            # Frequency weight
            freq_weight = self.get_frequency_weight(candidate)

            # Combined score (normalized)
            score = (edit_score * 0.7) + (min(freq_weight / 10.0, 1.0) * 0.3)

            scored_candidates.append((candidate, score))

        # Sort by score descending
        scored_candidates.sort(key=lambda x: x[1], reverse=True)

        return scored_candidates[:max_suggestions]


# Singleton instance
_spell_checker_instance = None


def get_spell_checker() -> LevenshteinSpellChecker:
    """Get or create spell checker singleton"""
    global _spell_checker_instance
    if _spell_checker_instance is None:
        _spell_checker_instance = LevenshteinSpellChecker()
    return _spell_checker_instance
