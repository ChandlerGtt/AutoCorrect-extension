"""
FastAPI Correction Endpoint
Integrates spell checker, neural model, and n-gram ranking
"""
from typing import List, Optional
from pydantic import BaseModel, Field
import time
import logging

from backend.models.spell_checker import get_spell_checker
from backend.models.pretrained_model import get_neural_corrector
from backend.models.ngram_model import get_ngram_model
from backend.utils.cache import get_cache
from backend.config import settings

logger = logging.getLogger(__name__)


# Request/Response Models
class CorrectionRequest(BaseModel):
    """Request model for text correction"""
    text: str = Field(..., description="Text to correct", max_length=settings.MAX_REQUEST_SIZE)
    context: Optional[List[str]] = Field(default=None, description="Surrounding words for context")
    mode: str = Field(default="auto", description="Correction mode: auto, suggestions, or grammar")
    max_suggestions: int = Field(default=3, description="Maximum number of suggestions", ge=1, le=10)
    use_neural: bool = Field(default=True, description="Use neural model for grammar correction")
    use_cache: bool = Field(default=True, description="Use cached results if available")


class Suggestion(BaseModel):
    """Individual correction suggestion"""
    text: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    source: str = Field(..., description="Source model: spell, neural, ngram")


class CorrectionResponse(BaseModel):
    """Response model for text correction"""
    original: str
    corrected: str
    suggestions: List[Suggestion]
    confidence: float = Field(..., ge=0.0, le=1.0)
    processing_time_ms: float
    cached: bool = False
    changes_made: bool = False


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    models_loaded: dict
    cache_stats: dict


# Correction Service
class CorrectionService:
    """
    Main correction service integrating all models.
    Flow: Spell Check → Neural Model → N-gram Ranking
    """

    def __init__(self):
        self.spell_checker = None
        self.neural_corrector = None
        self.ngram_model = None
        self.cache = None

        # Performance tracking
        self.total_requests = 0
        self.total_processing_time = 0.0

    def initialize(self):
        """Lazy load all models"""
        logger.info("Initializing correction service...")

        # Load spell checker (fast)
        if self.spell_checker is None:
            self.spell_checker = get_spell_checker()
            logger.info("Spell checker loaded")

        # Load neural model
        if self.neural_corrector is None:
            try:
                self.neural_corrector = get_neural_corrector()
                logger.info("Neural corrector loaded")
            except Exception as e:
                logger.error(f"Failed to load neural model: {e}")

        # Load n-gram model
        if self.ngram_model is None:
            self.ngram_model = get_ngram_model()
            logger.info("N-gram model loaded")

        # Initialize cache
        if self.cache is None:
            self.cache = get_cache()
            logger.info("Cache initialized")

        logger.info("Correction service ready")

    async def correct_text(self, request: CorrectionRequest) -> CorrectionResponse:
        """
        Main correction endpoint handler

        Args:
            request: Correction request

        Returns:
            Correction response with suggestions
        """
        start_time = time.time()

        # Ensure models are loaded
        if self.spell_checker is None:
            self.initialize()

        text = request.text.strip()
        context = request.context or []

        # Check cache first
        cached_result = None
        if request.use_cache:
            cached_result = self.cache.get(text, context, "combined")

        if cached_result:
            corrected_text, confidence = cached_result
            processing_time = (time.time() - start_time) * 1000

            return CorrectionResponse(
                original=text,
                corrected=corrected_text,
                suggestions=[Suggestion(text=corrected_text, confidence=confidence, source="cache")],
                confidence=confidence,
                processing_time_ms=processing_time,
                cached=True,
                changes_made=(text != corrected_text)
            )

        # Determine correction strategy based on mode
        if request.mode == "grammar":
            # Grammar-only correction using neural model
            result = await self._correct_grammar(text, request)
        elif request.mode == "suggestions":
            # Generate multiple suggestions
            result = await self._generate_suggestions(text, context, request.max_suggestions)
        else:
            # Auto mode: spell check + grammar
            result = await self._auto_correct(text, context, request)

        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000

        # Ensure we meet performance requirement
        if processing_time > settings.MAX_RESPONSE_TIME_MS:
            logger.warning(f"Response time exceeded target: {processing_time:.2f}ms > {settings.MAX_RESPONSE_TIME_MS}ms")

        # Track stats
        self.total_requests += 1
        self.total_processing_time += processing_time

        # Cache result if caching enabled
        if request.use_cache and result.suggestions:
            top_suggestion = result.suggestions[0]
            self.cache.set(text, (top_suggestion.text, top_suggestion.confidence), context, "combined")

        result.processing_time_ms = processing_time
        return result

    async def _auto_correct(
        self,
        text: str,
        context: List[str],
        request: CorrectionRequest
    ) -> CorrectionResponse:
        """
        Auto correction: spell check ONLY for single words
        Only use neural model for multi-word phrases/sentences
        """
        suggestions = []

        # Handle empty or whitespace-only text
        if not text or not text.strip():
            return CorrectionResponse(
                original=text,
                corrected=text,
                suggestions=[Suggestion(text=text, confidence=1.0, source="original")],
                confidence=1.0,
                processing_time_ms=0.0,
                cached=False,
                changes_made=False
            )

        # First pass: Spell checking for individual words
        words = text.split()
        corrected_words = []
        any_corrections = False

        for word in words:
            # Skip very short words, empty words, or non-alphabetic
            if not word or len(word) < 2 or not any(c.isalpha() for c in word):
                corrected_words.append(word)
                continue

            # Skip all-caps words (likely acronyms)
            if word.isupper() and len(word) > 1:
                corrected_words.append(word)
                continue

            # Get spell corrections
            spell_suggestions = self.spell_checker.get_corrections(word, context, max_suggestions=1)

            if spell_suggestions and spell_suggestions[0][0] != word.lower():
                corrected_word = spell_suggestions[0][0]
                # Preserve original case if possible
                if word[0].isupper() and " " not in corrected_word:
                    corrected_word = corrected_word.capitalize()
                # Handle multi-word corrections (e.g., "alot" -> "a lot")
                if " " in corrected_word:
                    # Split and add as separate words
                    corrected_words.extend(corrected_word.split())
                else:
                    corrected_words.append(corrected_word)
                any_corrections = True
            else:
                corrected_words.append(word)

            spell_corrected_text = " ".join(corrected_words)

        # Second pass: Neural grammar correction (if enabled, model loaded, and not single word)
        # Skip neural model for single words - spell checking is sufficient
        is_single_word = len(words) == 1
        if request.use_neural and self.neural_corrector is not None and not is_single_word:
            try:
                grammar_corrected, confidence = self.neural_corrector.correct_grammar(spell_corrected_text)

                suggestions.append(Suggestion(
                    text=grammar_corrected,
                    confidence=confidence,
                    source="neural"
                ))

                final_text = grammar_corrected
                final_confidence = confidence

            except Exception as e:
                logger.error(f"Neural correction failed: {e}")
                final_text = spell_corrected_text
                final_confidence = 0.8 if any_corrections else 1.0
                suggestions.append(Suggestion(
                    text=final_text,
                    confidence=final_confidence,
                    source="spell"
                ))
        else:
            final_text = spell_corrected_text
            final_confidence = 0.9 if any_corrections else 1.0
            suggestions.append(Suggestion(
                text=final_text,
                confidence=final_confidence,
                source="spell"
            ))

        # Only apply correction if confidence meets threshold
        if final_confidence < settings.MIN_CONFIDENCE_THRESHOLD and text != final_text:
            logger.info(f"Skipping low-confidence correction: {final_confidence:.2f} < {settings.MIN_CONFIDENCE_THRESHOLD}")
            final_text = text  # Revert to original
            suggestions = [Suggestion(text=text, confidence=1.0, source="original")]
            final_confidence = 1.0

        return CorrectionResponse(
            original=text,
            corrected=final_text,
            suggestions=suggestions,
            confidence=final_confidence,
            processing_time_ms=0.0,  # Will be set by caller
            cached=False,
            changes_made=(text != final_text)
        )

    async def _correct_grammar(
        self,
        text: str,
        request: CorrectionRequest
    ) -> CorrectionResponse:
        """
        Grammar-only correction using neural model

        Args:
            text: Input text
            request: Original request

        Returns:
            Correction response
        """
        if self.neural_corrector is None:
            logger.warning("Neural model not loaded, returning original text")
            return CorrectionResponse(
                original=text,
                corrected=text,
                suggestions=[Suggestion(text=text, confidence=0.0, source="none")],
                confidence=0.0,
                processing_time_ms=0.0,
                cached=False,
                changes_made=False
            )

        try:
            corrected_text, confidence = self.neural_corrector.correct_grammar(text)

            suggestions = [Suggestion(
                text=corrected_text,
                confidence=confidence,
                source="neural"
            )]

            return CorrectionResponse(
                original=text,
                corrected=corrected_text,
                suggestions=suggestions,
                confidence=confidence,
                processing_time_ms=0.0,
                cached=False,
                changes_made=(text != corrected_text)
            )

        except Exception as e:
            logger.error(f"Grammar correction failed: {e}")
            return CorrectionResponse(
                original=text,
                corrected=text,
                suggestions=[Suggestion(text=text, confidence=0.0, source="error")],
                confidence=0.0,
                processing_time_ms=0.0,
                cached=False,
                changes_made=False
            )

    async def _generate_suggestions(
        self,
        text: str,
        context: List[str],
        max_suggestions: int
    ) -> CorrectionResponse:
        """
        Generate multiple correction suggestions

        Args:
            text: Input text
            context: Context words
            max_suggestions: Maximum suggestions to return

        Returns:
            Correction response with multiple suggestions
        """
        all_suggestions = []

        # Get spell check suggestions for single words
        if len(text.split()) == 1:
            spell_suggestions = self.spell_checker.get_corrections(text, context, max_suggestions)

            for suggestion, confidence in spell_suggestions:
                all_suggestions.append(Suggestion(
                    text=suggestion,
                    confidence=confidence,
                    source="spell"
                ))

        # Get neural suggestions if available
        if self.neural_corrector is not None:
            try:
                neural_alternatives = self.neural_corrector.correct_with_alternatives(
                    text,
                    num_alternatives=max_suggestions
                )

                for suggestion, confidence in neural_alternatives:
                    # Avoid duplicates
                    if not any(s.text == suggestion for s in all_suggestions):
                        all_suggestions.append(Suggestion(
                            text=suggestion,
                            confidence=confidence,
                            source="neural"
                        ))
            except Exception as e:
                logger.error(f"Neural suggestions failed: {e}")

        # Rank suggestions using n-gram model if available
        if self.ngram_model and self.ngram_model.trained and context:
            candidate_texts = [s.text for s in all_suggestions]
            ranked = self.ngram_model.rank_candidates(candidate_texts, context, max_suggestions)

            # Update confidence scores based on n-gram probability
            for i, (text, ngram_prob) in enumerate(ranked):
                for suggestion in all_suggestions:
                    if suggestion.text == text:
                        # Blend original confidence with n-gram score
                        suggestion.confidence = (suggestion.confidence * 0.7) + (ngram_prob * 0.3)
                        suggestion.source = f"{suggestion.source}+ngram"
                        break

        # Sort by confidence
        all_suggestions.sort(key=lambda s: s.confidence, reverse=True)

        # Limit to max_suggestions
        top_suggestions = all_suggestions[:max_suggestions]

        # Return response
        if top_suggestions:
            top = top_suggestions[0]
            return CorrectionResponse(
                original=text,
                corrected=top.text,
                suggestions=top_suggestions,
                confidence=top.confidence,
                processing_time_ms=0.0,
                cached=False,
                changes_made=(text != top.text)
            )
        else:
            # No suggestions
            return CorrectionResponse(
                original=text,
                corrected=text,
                suggestions=[Suggestion(text=text, confidence=1.0, source="original")],
                confidence=1.0,
                processing_time_ms=0.0,
                cached=False,
                changes_made=False
            )


# Global service instance
_service_instance: Optional[CorrectionService] = None


def get_correction_service() -> CorrectionService:
    """Get or create correction service singleton"""
    global _service_instance
    if _service_instance is None:
        _service_instance = CorrectionService()
    return _service_instance