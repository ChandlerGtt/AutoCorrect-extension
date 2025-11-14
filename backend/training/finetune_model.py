"""
Fine-tune T5/BERT model on custom training data
Optional script for advanced model customization
"""
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    Trainer,
    TrainingArguments,
    DataCollatorForSeq2Seq
)
from datasets import Dataset, load_dataset
import logging
from pathlib import Path
import json
from typing import Optional, List, Dict
import time

from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelFineTuner:
    """
    Fine-tune pre-trained grammar correction model on custom data
    """

    def __init__(
        self,
        base_model: str = None,
        output_dir: Path = None,
        device: str = None
    ):
        """
        Initialize fine-tuner

        Args:
            base_model: Base model to fine-tune
            output_dir: Directory to save fine-tuned model
            device: Device to use (cpu/cuda)
        """
        self.base_model = base_model or settings.SMALL_MODEL_NAME
        self.output_dir = output_dir or (settings.MODEL_CACHE_DIR / "finetuned")
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        self.tokenizer: Optional[AutoTokenizer] = None
        self.model: Optional[AutoModelForSeq2SeqLM] = None

        logger.info(f"Initialized ModelFineTuner")
        logger.info(f"Base model: {self.base_model}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Device: {self.device}")

    def load_training_data(self, data_path: Path) -> Dataset:
        """
        Load training data from file

        Args:
            data_path: Path to training data file

        Returns:
            HuggingFace Dataset
        """
        logger.info(f"Loading training data from {data_path}...")

        # Determine format
        if data_path.suffix == '.jsonl':
            data = []
            with open(data_path, 'r', encoding='utf-8') as f:
                for line in f:
                    data.append(json.loads(line))

            # Convert to HuggingFace dataset format
            dataset_dict = {
                "input": [d["error"] for d in data],
                "target": [d["correction"] for d in data],
                "error_type": [d.get("error_type", "unknown") for d in data]
            }

            dataset = Dataset.from_dict(dataset_dict)

        elif data_path.suffix == '.csv':
            dataset = load_dataset('csv', data_files=str(data_path))['train']

        else:
            # Assume text format: "grammar: ERROR\tCORRECTION"
            inputs = []
            targets = []

            with open(data_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if '\t' in line:
                        inp, target = line.strip().split('\t')
                        inputs.append(inp)
                        targets.append(target)

            dataset = Dataset.from_dict({
                "input": inputs,
                "target": targets
            })

        logger.info(f"Loaded {len(dataset)} training examples")

        return dataset

    def preprocess_data(self, dataset: Dataset, max_length: int = 128) -> Dataset:
        """
        Preprocess dataset for training

        Args:
            dataset: Raw dataset
            max_length: Maximum sequence length

        Returns:
            Preprocessed dataset
        """
        logger.info("Preprocessing data...")

        def preprocess_function(examples):
            # Prepare inputs
            inputs = examples["input"]

            # Add "grammar: " prefix if not present and using T5
            if "t5" in self.base_model.lower():
                inputs = [f"grammar: {inp}" if not inp.startswith("grammar:") else inp
                         for inp in inputs]

            # Tokenize inputs
            model_inputs = self.tokenizer(
                inputs,
                max_length=max_length,
                truncation=True,
                padding="max_length"
            )

            # Tokenize targets
            targets = examples["target"]
            with self.tokenizer.as_target_tokenizer():
                labels = self.tokenizer(
                    targets,
                    max_length=max_length,
                    truncation=True,
                    padding="max_length"
                )

            model_inputs["labels"] = labels["input_ids"]

            return model_inputs

        processed_dataset = dataset.map(
            preprocess_function,
            batched=True,
            remove_columns=dataset.column_names
        )

        logger.info("Preprocessing complete")

        return processed_dataset

    def train(
        self,
        train_dataset: Dataset,
        eval_dataset: Optional[Dataset] = None,
        num_epochs: int = 3,
        batch_size: int = 8,
        learning_rate: float = 5e-5,
        save_steps: int = 500
    ):
        """
        Fine-tune model on training data

        Args:
            train_dataset: Training dataset
            eval_dataset: Evaluation dataset (optional)
            num_epochs: Number of training epochs
            batch_size: Batch size
            learning_rate: Learning rate
            save_steps: Save checkpoint every N steps
        """
        logger.info("Starting fine-tuning...")

        # Load tokenizer and model
        logger.info(f"Loading base model: {self.base_model}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.base_model,
            cache_dir=str(settings.MODEL_CACHE_DIR)
        )

        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            self.base_model,
            cache_dir=str(settings.MODEL_CACHE_DIR)
        )

        # Preprocess data
        train_dataset = self.preprocess_data(train_dataset)

        if eval_dataset:
            eval_dataset = self.preprocess_data(eval_dataset)

        # Training arguments
        training_args = TrainingArguments(
            output_dir=str(self.output_dir),
            evaluation_strategy="epoch" if eval_dataset else "no",
            learning_rate=learning_rate,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size,
            num_train_epochs=num_epochs,
            weight_decay=0.01,
            save_total_limit=3,
            save_steps=save_steps,
            logging_dir=str(self.output_dir / "logs"),
            logging_steps=100,
            load_best_model_at_end=True if eval_dataset else False,
            metric_for_best_model="eval_loss" if eval_dataset else None,
            push_to_hub=False,
            fp16=torch.cuda.is_available(),  # Use mixed precision if GPU available
        )

        # Data collator
        data_collator = DataCollatorForSeq2Seq(
            self.tokenizer,
            model=self.model
        )

        # Trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            tokenizer=self.tokenizer,
            data_collator=data_collator
        )

        # Train
        logger.info("Training started...")
        start_time = time.time()

        trainer.train()

        training_time = time.time() - start_time
        logger.info(f"Training completed in {training_time/60:.2f} minutes")

        # Save final model
        final_path = self.output_dir / "final"
        logger.info(f"Saving final model to {final_path}...")

        trainer.save_model(str(final_path))
        self.tokenizer.save_pretrained(str(final_path))

        logger.info("Fine-tuning complete!")

        return trainer

    def evaluate(
        self,
        model_path: Path,
        test_examples: List[Dict[str, str]]
    ):
        """
        Evaluate fine-tuned model on test examples

        Args:
            model_path: Path to fine-tuned model
            test_examples: List of {"error": ..., "correction": ...} dicts
        """
        logger.info(f"Loading model from {model_path}...")

        tokenizer = AutoTokenizer.from_pretrained(str(model_path))
        model = AutoModelForSeq2SeqLM.from_pretrained(str(model_path))
        model.to(self.device)
        model.eval()

        logger.info("Evaluating on test examples...")

        correct = 0
        total = len(test_examples)

        for example in test_examples:
            error_text = example["error"]
            correct_text = example["correction"]

            # Prepare input
            input_text = f"grammar: {error_text}" if "t5" in self.base_model.lower() else error_text

            # Generate correction
            inputs = tokenizer(input_text, return_tensors="pt").to(self.device)

            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_length=128,
                    num_beams=4,
                    early_stopping=True
                )

            predicted = tokenizer.decode(outputs[0], skip_special_tokens=True)

            # Check if correct
            if predicted.strip().lower() == correct_text.strip().lower():
                correct += 1

            logger.debug(f"Error: {error_text}")
            logger.debug(f"Expected: {correct_text}")
            logger.debug(f"Predicted: {predicted}")
            logger.debug("---")

        accuracy = correct / total if total > 0 else 0.0

        logger.info(f"Evaluation complete: {correct}/{total} correct ({accuracy*100:.2f}%)")

        return accuracy


def main():
    """Main function for standalone execution"""
    logger.info("Starting model fine-tuning...")

    # Check if training data exists
    training_data_path = settings.TRAINING_DATA_DIR / "training_data.jsonl"

    if not training_data_path.exists():
        logger.error(f"Training data not found at {training_data_path}")
        logger.error("Please run generate_training_data.py first")
        return

    # Initialize fine-tuner
    fine_tuner = ModelFineTuner()

    # Load data
    full_dataset = fine_tuner.load_training_data(training_data_path)

    # Split into train/eval
    split = full_dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split['train']
    eval_dataset = split['test']

    logger.info(f"Training samples: {len(train_dataset)}")
    logger.info(f"Evaluation samples: {len(eval_dataset)}")

    # Fine-tune
    trainer = fine_tuner.train(
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        num_epochs=3,
        batch_size=8,
        learning_rate=5e-5
    )

    logger.info("\n" + "="*50)
    logger.info("Fine-tuning complete!")
    logger.info(f"Model saved to: {fine_tuner.output_dir / 'final'}")
    logger.info("="*50)

    # Evaluate on some test examples
    test_examples = [
        {"error": "I has a apple", "correction": "I have an apple"},
        {"error": "She dont like it", "correction": "She doesn't like it"},
        {"error": "Your the best", "correction": "You're the best"},
        {"error": "I could of went there", "correction": "I could have went there"},
        {"error": "Alot of people", "correction": "A lot of people"}
    ]

    accuracy = fine_tuner.evaluate(
        fine_tuner.output_dir / "final",
        test_examples
    )

    logger.info(f"Test accuracy: {accuracy*100:.2f}%")


if __name__ == "__main__":
    main()
