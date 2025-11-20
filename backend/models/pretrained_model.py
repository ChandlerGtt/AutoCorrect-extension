"""
Pre-trained Neural Model for Grammar Correction
Uses transformer-based models (T5/BERT) for context-aware corrections
"""
from typing import List, Tuple, Optional, Dict
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    pipeline,
    Pipeline
)
import logging
from pathlib import Path
import time

from backend.config import settings

logger = logging.getLogger(__name__)


class NeuralGrammarCorrector:
    """
    Transformer-based grammar correction using pre-trained models.
    Second pass after spell checker for context-aware grammar fixes.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        use_small_model: bool = None,
        device: str = None
    ):
        """
        Initialize neural grammar corrector

        Args:
            model_name: HuggingFace model name
            use_small_model: Use smaller/faster model for development
            device: "cpu" or "cuda"
        """
        self.model_name = model_name or self._select_model(use_small_model)
        self.device = device or ("cuda" if torch.cuda.is_available() and settings.USE_GPU else "cpu")

        logger.info(f"Initializing NeuralGrammarCorrector with model: {self.model_name}")
        logger.info(f"Using device: {self.device}")

        self.tokenizer: Optional[AutoTokenizer] = None
        self.model: Optional[AutoModelForSeq2SeqLM] = None
        self.pipeline: Optional[Pipeline] = None

        # Performance tracking
        self.load_time: float = 0.0
        self.inference_times: List[float] = []

        # Load model
        self._load_model()

    def _select_model(self, use_small: Optional[bool] = None) -> str:
        """Select model based on configuration"""
        use_small = use_small if use_small is not None else settings.USE_SMALL_MODEL

        if use_small:
            return settings.SMALL_MODEL_NAME
        else:
            return settings.PRETRAINED_MODEL_NAME

    def _load_model(self):
        """Load model and tokenizer from HuggingFace"""
        start_time = time.time()

        try:
            logger.info(f"Loading tokenizer for {self.model_name}...")
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                cache_dir=str(settings.MODEL_CACHE_DIR)
            )

            logger.info(f"Loading model {self.model_name}...")
            self.model = AutoModelForSeq2SeqLM.from_pretrained(
                self.model_name,
                cache_dir=str(settings.MODEL_CACHE_DIR)
            )

            # Move to device
            self.model.to(self.device)

            # Set to evaluation mode
            self.model.eval()

            # Create pipeline for easier inference
            self.pipeline = pipeline(
                "text2text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if self.device == "cuda" else -1,
                max_length=settings.MAX_INPUT_LENGTH
            )

            self.load_time = time.time() - start_time
            logger.info(f"Model loaded successfully in {self.load_time:.2f}s")

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def correct_grammar(
        self,
        text: str,
        return_confidence: bool = True,
        max_length: Optional[int] = None
    ) -> Tuple[str, float]:
        """
        Correct grammar in text using neural model

        Args:
            text: Input text to correct
            return_confidence: Whether to calculate confidence score
            max_length: Maximum output length

        Returns:
            Tuple of (corrected_text, confidence_score)
        """
        if not text or not text.strip():
            return text, 0.0

        start_time = time.time()

        try:
            # Prepare input
            input_text = f"grammar: {text}" if "t5" in self.model_name.lower() else text

            # Generate correction
            max_len = max_length or min(len(text.split()) * 2, settings.MAX_INPUT_LENGTH)

            with torch.no_grad():
                outputs = self.pipeline(
                    input_text,
                    max_length=max_len,
                    num_return_sequences=1,
                    do_sample=False,  # Use greedy decoding for consistency
                    early_stopping=True
                )

            corrected_text = outputs[0]['generated_text'].strip()

            # Post-process T5 output: remove "grammar:" prefix if present
            if corrected_text.lower().startswith("grammar:"):
                corrected_text = corrected_text[8:].strip()

            # Handle cases where model outputs just "grammar" or empty string
            if corrected_text.lower() == "grammar" or not corrected_text:
                corrected_text = text  # Return original if model failed
                confidence = 0.0
                return corrected_text, confidence

            # Calculate confidence based on edit similarity
            confidence = self._calculate_confidence(text, corrected_text)

            # Track inference time
            inference_time = (time.time() - start_time) * 1000  # ms
            self.inference_times.append(inference_time)

            # Keep only last 100 measurements
            if len(self.inference_times) > 100:
                self.inference_times.pop(0)

            logger.debug(f"Grammar correction took {inference_time:.2f}ms")

            return corrected_text, confidence

        except Exception as e:
            logger.error(f"Grammar correction failed: {e}")
            return text, 0.0

    def correct_with_alternatives(
        self,
        text: str,
        num_alternatives: int = 3
    ) -> List[Tuple[str, float]]:
        """
        Generate multiple correction alternatives with scores

        Args:
            text: Input text
            num_alternatives: Number of alternatives to generate

        Returns:
            List of (corrected_text, confidence) tuples
        """
        if not text or not text.strip():
            return [(text, 0.0)]

        try:
            input_text = f"grammar: {text}" if "t5" in self.model_name.lower() else text

            with torch.no_grad():
                outputs = self.pipeline(
                    input_text,
                    max_length=min(len(text.split()) * 2, settings.MAX_INPUT_LENGTH),
                    num_return_sequences=num_alternatives,
                    num_beams=num_alternatives + 2,
                    do_sample=False,
                    early_stopping=True
                )

            results = []
            for output in outputs:
                corrected = output['generated_text'].strip()

                # Post-process T5 output: remove "grammar:" prefix if present
                if corrected.lower().startswith("grammar:"):
                    corrected = corrected[8:].strip()

                # Skip invalid outputs
                if corrected.lower() == "grammar" or not corrected:
                    continue

                confidence = self._calculate_confidence(text, corrected)
                results.append((corrected, confidence))

            # Sort by confidence
            results.sort(key=lambda x: x[1], reverse=True)

            return results

        except Exception as e:
            logger.error(f"Alternative generation failed: {e}")
            return [(text, 0.0)]

    def _calculate_confidence(self, original: str, corrected: str) -> float:
        """
        Calculate confidence score based on edit similarity

        Args:
            original: Original text
            corrected: Corrected text

        Returns:
            Confidence score (0.0 to 1.0)
        """
        if original == corrected:
            # No changes - either perfect or model couldn't correct
            return 1.0 if self._is_grammatically_sound(original) else 0.5

        # Calculate similarity ratio
        original_words = set(original.lower().split())
        corrected_words = set(corrected.lower().split())

        if not original_words:
            return 0.0

        # Jaccard similarity
        intersection = len(original_words & corrected_words)
        union = len(original_words | corrected_words)
        similarity = intersection / union if union > 0 else 0.0

        # Higher similarity with changes = higher confidence
        # (model made small, targeted fixes)
        if similarity > 0.8:
            confidence = 0.9
        elif similarity > 0.6:
            confidence = 0.8
        elif similarity > 0.4:
            confidence = 0.7
        else:
            confidence = 0.6  # Major rewrite

        return confidence

    def _is_grammatically_sound(self, text: str) -> bool:
        """
        Simple heuristic to check if text is likely grammatically correct
        """
        # Basic checks
        if not text or len(text.strip()) < 2:
            return False

        # Check for common grammar issues
        lower_text = text.lower()
        grammar_issues = [
            " dont ", " doesnt ", " cant ", " wont ",  # Missing apostrophes
            " should of ", " could of ", " would of ",  # Common errors
            " alot ", " aswell ", " infact "
        ]

        for issue in grammar_issues:
            if issue in lower_text:
                return False

        return True

    def batch_correct(
        self,
        texts: List[str],
        batch_size: Optional[int] = None
    ) -> List[Tuple[str, float]]:
        """
        Correct multiple texts in batches for efficiency

        Args:
            texts: List of texts to correct
            batch_size: Batch size (uses settings.BATCH_SIZE if None)

        Returns:
            List of (corrected_text, confidence) tuples
        """
        batch_size = batch_size or settings.BATCH_SIZE
        results = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            # Prepare inputs
            inputs = [
                f"grammar: {text}" if "t5" in self.model_name.lower() else text
                for text in batch
            ]

            try:
                with torch.no_grad():
                    outputs = self.pipeline(
                        inputs,
                        max_length=settings.MAX_INPUT_LENGTH,
                        batch_size=len(batch),
                        do_sample=False
                    )

                for original, output in zip(batch, outputs):
                    corrected = output['generated_text'].strip()
                    confidence = self._calculate_confidence(original, corrected)
                    results.append((corrected, confidence))

            except Exception as e:
                logger.error(f"Batch correction failed: {e}")
                # Return original texts with 0 confidence
                results.extend([(text, 0.0) for text in batch])

        return results

    def get_performance_stats(self) -> Dict[str, float]:
        """Get model performance statistics"""
        if not self.inference_times:
            return {
                "load_time_s": self.load_time,
                "avg_inference_ms": 0.0,
                "min_inference_ms": 0.0,
                "max_inference_ms": 0.0
            }

        return {
            "load_time_s": self.load_time,
            "avg_inference_ms": sum(self.inference_times) / len(self.inference_times),
            "min_inference_ms": min(self.inference_times),
            "max_inference_ms": max(self.inference_times),
            "total_inferences": len(self.inference_times)
        }


# Global model instance (lazy loaded)
_model_instance: Optional[NeuralGrammarCorrector] = None


def get_neural_corrector() -> NeuralGrammarCorrector:
    """Get or create neural corrector singleton"""
    global _model_instance
    if _model_instance is None:
        _model_instance = NeuralGrammarCorrector()
    return _model_instance


def unload_model():
    """Unload model to free memory"""
    global _model_instance
    if _model_instance is not None:
        del _model_instance.model
        del _model_instance.tokenizer
        del _model_instance.pipeline
        _model_instance = None
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        logger.info("Model unloaded from memory")
