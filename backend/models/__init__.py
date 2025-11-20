"""Models package"""
from .spell_checker import LevenshteinSpellChecker, get_spell_checker
from .ngram_model import NgramModel, get_ngram_model

# Lazy import for neural model (requires torch)
try:
    from .pretrained_model import NeuralGrammarCorrector, get_neural_corrector
    __all__ = [
        'LevenshteinSpellChecker',
        'get_spell_checker',
        'NeuralGrammarCorrector',
        'get_neural_corrector',
        'NgramModel',
        'get_ngram_model',
    ]
except ImportError:
    # Torch not available - neural model disabled
    NeuralGrammarCorrector = None
    get_neural_corrector = None
    __all__ = [
        'LevenshteinSpellChecker',
        'get_spell_checker',
        'NgramModel',
        'get_ngram_model',
    ]
