"""
Download Project Gutenberg corpus for training
Processes and cleans text for n-gram and neural model training
"""
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time
import logging
import re
from typing import List, Optional
from tqdm import tqdm
import random

from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GutenbergDownloader:
    """
    Download and process books from Project Gutenberg
    """

    def __init__(
        self,
        corpus_dir: Optional[Path] = None,
        max_books: int = None,
        min_length: int = None
    ):
        """
        Initialize downloader

        Args:
            corpus_dir: Directory to save corpus
            max_books: Maximum number of books to download
            min_length: Minimum book length in characters
        """
        self.corpus_dir = corpus_dir or settings.CORPUS_DIR
        self.max_books = max_books or settings.MAX_CORPUS_SIZE
        self.min_length = min_length or settings.MIN_BOOK_LENGTH

        self.corpus_dir.mkdir(parents=True, exist_ok=True)

        # Gutenberg mirror URLs
        self.base_url = "https://www.gutenberg.org"
        self.text_base = "https://www.gutenberg.org/files"

        # Book IDs for popular, well-formatted books
        self.popular_book_ids = self._get_popular_book_ids()

        logger.info(f"Initialized Gutenberg downloader")
        logger.info(f"Corpus directory: {self.corpus_dir}")
        logger.info(f"Max books: {self.max_books}")

    def _get_popular_book_ids(self) -> List[int]:
        """
        Get list of popular book IDs from Project Gutenberg

        Returns curated list of high-quality, well-formatted books
        """
        # Popular books with good formatting
        popular_books = [
            1342,  # Pride and Prejudice
            11,    # Alice's Adventures in Wonderland
            84,    # Frankenstein
            1661,  # Sherlock Holmes
            2701,  # Moby Dick
            98,    # A Tale of Two Cities
            1080,  # A Modest Proposal
            16,    # Peter Pan
            74,    # The Adventures of Tom Sawyer
            76,    # Adventures of Huckleberry Finn
            120,   # Treasure Island
            1260,  # Jane Eyre
            768,   # Wuthering Heights
            55,    # The Wonderful Wizard of Oz
            2097,  # The Scarlet Pimpernel
            219,   # Heart of Darkness
            345,   # Dracula
            41,    # The Legend of Sleepy Hollow
            1399,  # Anna Karenina
            2600,  # War and Peace
            1400,  # Great Expectations
            730,   # Oliver Twist
            46,    # A Christmas Carol
            244,   # A Study in Scarlet
            1952,  # The Yellow Wallpaper
            174,   # The Picture of Dorian Gray
            215,   # The Call of the Wild
            43,    # The Strange Case of Dr. Jekyll and Mr. Hyde
            514,   # Little Women
            1497,  # The Republic (Plato)
            5200,  # Metamorphosis (Kafka)
            2814,  # Dubliners (Joyce)
            4300,  # Ulysses (Joyce)
            1232,  # The Prince (Machiavelli)
            844,   # The Importance of Being Earnest
            1184,  # The Count of Monte Cristo
            996,   # Don Quixote
            1727,  # The Odyssey
            6130,  # The Iliad
            1998,  # Thus Spake Zarathustra
            4517,  # Candide
            140,   # The Jungle Book
            394,   # Cranford
            158,   # Emma
            161,   # Sense and Sensibility
            105,   # Persuasion
            141,   # Mansfield Park
            209,   # The Turn of the Screw
            135,   # Les Misérables
            1250,  # Anthem
            28054, # The Brothers Karamazov
            2554,  # Crime and Punishment
            600,   # Notes from Underground
        ]

        # Shuffle for variety
        random.shuffle(popular_books)

        # Extend with random IDs if needed
        if len(popular_books) < self.max_books:
            # Add some random IDs from common ranges
            for i in range(self.max_books - len(popular_books)):
                random_id = random.randint(1, 70000)
                popular_books.append(random_id)

        return popular_books[:self.max_books]

    def download_book(self, book_id: int) -> Optional[str]:
        """
        Download a single book from Gutenberg

        Args:
            book_id: Gutenberg book ID

        Returns:
            Book text or None if download failed
        """
        try:
            # Try different URL patterns
            urls = [
                f"{self.text_base}/{book_id}/{book_id}-0.txt",  # UTF-8
                f"{self.text_base}/{book_id}/{book_id}.txt",    # ASCII
            ]

            for url in urls:
                try:
                    response = requests.get(url, timeout=30)
                    if response.status_code == 200:
                        text = response.text

                        # Check minimum length
                        if len(text) < self.min_length:
                            logger.debug(f"Book {book_id} too short: {len(text)} chars")
                            return None

                        # Clean the text
                        cleaned = self._clean_gutenberg_text(text)

                        if len(cleaned) >= self.min_length:
                            logger.debug(f"Successfully downloaded book {book_id}")
                            return cleaned

                except requests.RequestException as e:
                    logger.debug(f"Failed to download from {url}: {e}")
                    continue

            logger.debug(f"Could not download book {book_id} from any URL")
            return None

        except Exception as e:
            logger.error(f"Error downloading book {book_id}: {e}")
            return None

    def _clean_gutenberg_text(self, text: str) -> str:
        """
        Clean Gutenberg text by removing headers, footers, and formatting

        Args:
            text: Raw Gutenberg text

        Returns:
            Cleaned text
        """
        # Remove Gutenberg header (before *** START)
        start_markers = [
            r"\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",
            r"\*\*\*START OF THE PROJECT GUTENBERG EBOOK.*?\*\*\*",
        ]

        for marker in start_markers:
            match = re.search(marker, text, re.IGNORECASE | re.DOTALL)
            if match:
                text = text[match.end():]
                break

        # Remove Gutenberg footer (after *** END)
        end_markers = [
            r"\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",
            r"\*\*\*END OF THE PROJECT GUTENBERG EBOOK.*?\*\*\*",
        ]

        for marker in end_markers:
            match = re.search(marker, text, re.IGNORECASE | re.DOTALL)
            if match:
                text = text[:match.start()]
                break

        # Remove excessive whitespace
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)  # Max 2 newlines
        text = re.sub(r' +', ' ', text)  # Single spaces

        # Remove page numbers and chapter markers if standalone
        text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'^CHAPTER [IVXLCDM\d]+\.?\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)

        return text.strip()

    def download_corpus(
        self,
        save_individual: bool = True,
        save_combined: bool = True
    ) -> Path:
        """
        Download entire corpus

        Args:
            save_individual: Save each book as separate file
            save_combined: Save all books in one file

        Returns:
            Path to corpus directory or combined file
        """
        logger.info(f"Downloading {self.max_books} books from Project Gutenberg...")

        successful_downloads = 0
        combined_text = []

        for book_id in tqdm(self.popular_book_ids, desc="Downloading books"):
            # Check if already downloaded
            book_file = self.corpus_dir / f"book_{book_id}.txt"
            if book_file.exists():
                logger.debug(f"Book {book_id} already exists, skipping")
                if save_combined:
                    with open(book_file, 'r', encoding='utf-8') as f:
                        combined_text.append(f.read())
                successful_downloads += 1
                continue

            # Download book
            text = self.download_book(book_id)

            if text:
                # Save individual file
                if save_individual:
                    with open(book_file, 'w', encoding='utf-8') as f:
                        f.write(text)

                # Add to combined text
                if save_combined:
                    combined_text.append(text)

                successful_downloads += 1

                # Rate limiting
                time.sleep(2)  # Be nice to Gutenberg servers
            else:
                logger.debug(f"Skipping book {book_id}")

            # Stop if we have enough
            if successful_downloads >= self.max_books:
                break

        logger.info(f"Successfully downloaded {successful_downloads} books")

        # Save combined corpus
        if save_combined and combined_text:
            combined_file = self.corpus_dir / "combined_corpus.txt"
            with open(combined_file, 'w', encoding='utf-8') as f:
                f.write("\n\n=== NEW BOOK ===\n\n".join(combined_text))

            logger.info(f"Combined corpus saved to {combined_file}")
            logger.info(f"Total size: {combined_file.stat().st_size / 1024 / 1024:.2f} MB")

            return combined_file

        return self.corpus_dir

    def get_corpus_stats(self) -> dict:
        """Get statistics about downloaded corpus"""
        book_files = list(self.corpus_dir.glob("book_*.txt"))

        total_chars = 0
        total_words = 0
        total_sentences = 0

        for book_file in book_files:
            with open(book_file, 'r', encoding='utf-8') as f:
                text = f.read()
                total_chars += len(text)
                total_words += len(text.split())
                total_sentences += len(re.findall(r'[.!?]+', text))

        return {
            "num_books": len(book_files),
            "total_characters": total_chars,
            "total_words": total_words,
            "total_sentences": total_sentences,
            "avg_words_per_book": total_words // len(book_files) if book_files else 0,
            "corpus_size_mb": sum(f.stat().st_size for f in book_files) / 1024 / 1024
        }


def main():
    """Main function for standalone execution"""
    downloader = GutenbergDownloader()

    logger.info("Starting corpus download...")
    corpus_path = downloader.download_corpus(
        save_individual=True,
        save_combined=True
    )

    logger.info(f"Corpus downloaded to: {corpus_path}")

    # Print statistics
    stats = downloader.get_corpus_stats()
    logger.info("Corpus statistics:")
    for key, value in stats.items():
        logger.info(f"  {key}: {value}")


if __name__ == "__main__":
    main()
