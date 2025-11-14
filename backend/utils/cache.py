"""
Caching layer for correction results
Ensures <500ms response time for common corrections
"""
from typing import Optional, Tuple, List
import hashlib
import json
import logging
from pathlib import Path
import time

try:
    from diskcache import Cache as DiskCache
except ImportError:
    DiskCache = None

try:
    import redis
except ImportError:
    redis = None

from backend.config import settings

logger = logging.getLogger(__name__)


class CorrectionCache:
    """
    Cache for storing correction results.
    Supports both disk-based and Redis-based caching.
    """

    def __init__(
        self,
        cache_type: str = None,
        cache_dir: Path = None,
        ttl: int = None
    ):
        """
        Initialize cache

        Args:
            cache_type: "disk" or "redis"
            cache_dir: Directory for disk cache
            ttl: Time-to-live in seconds
        """
        self.cache_type = cache_type or settings.CACHE_TYPE
        self.cache_dir = cache_dir or settings.CACHE_DIR
        self.ttl = ttl or settings.CACHE_TTL

        self.disk_cache: Optional[DiskCache] = None
        self.redis_client: Optional[redis.Redis] = None

        # Performance tracking
        self.hits = 0
        self.misses = 0
        self.total_requests = 0

        self._initialize_cache()

    def _initialize_cache(self):
        """Initialize the appropriate cache backend"""
        if self.cache_type == "disk":
            self._initialize_disk_cache()
        elif self.cache_type == "redis":
            self._initialize_redis_cache()
        else:
            logger.warning(f"Unknown cache type: {self.cache_type}, caching disabled")

    def _initialize_disk_cache(self):
        """Initialize disk-based cache"""
        if DiskCache is None:
            logger.error("diskcache not installed, falling back to no caching")
            return

        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self.disk_cache = DiskCache(
                str(self.cache_dir),
                size_limit=1024 * 1024 * 100  # 100 MB
            )
            logger.info(f"Disk cache initialized at {self.cache_dir}")
        except Exception as e:
            logger.error(f"Failed to initialize disk cache: {e}")

    def _initialize_redis_cache(self):
        """Initialize Redis cache"""
        if redis is None:
            logger.error("redis not installed, falling back to disk cache")
            self._initialize_disk_cache()
            return

        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis cache initialized")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}, falling back to disk cache")
            self._initialize_disk_cache()

    def _generate_key(
        self,
        text: str,
        context: Optional[List[str]] = None,
        model_type: str = "neural"
    ) -> str:
        """
        Generate cache key from input

        Args:
            text: Input text
            context: Context words
            model_type: Type of model (spell, neural, ngram)

        Returns:
            Cache key (hash)
        """
        # Normalize input
        text_lower = text.lower().strip()
        context_str = "|".join(context or [])

        # Create unique key
        key_data = f"{model_type}:{text_lower}:{context_str}"
        key_hash = hashlib.md5(key_data.encode()).hexdigest()

        return f"correction:{key_hash}"

    def get(
        self,
        text: str,
        context: Optional[List[str]] = None,
        model_type: str = "neural"
    ) -> Optional[Tuple[str, float]]:
        """
        Get cached correction result

        Args:
            text: Input text
            context: Context words
            model_type: Model type

        Returns:
            (corrected_text, confidence) or None if not cached
        """
        self.total_requests += 1

        if not settings.ENABLE_CACHE:
            self.misses += 1
            return None

        key = self._generate_key(text, context, model_type)

        try:
            if self.disk_cache is not None:
                result = self.disk_cache.get(key)
            elif self.redis_client is not None:
                cached_data = self.redis_client.get(key)
                result = json.loads(cached_data) if cached_data else None
            else:
                self.misses += 1
                return None

            if result is not None:
                self.hits += 1
                logger.debug(f"Cache hit for: {text[:50]}")
                return tuple(result)
            else:
                self.misses += 1
                return None

        except Exception as e:
            logger.error(f"Cache get error: {e}")
            self.misses += 1
            return None

    def set(
        self,
        text: str,
        correction: Tuple[str, float],
        context: Optional[List[str]] = None,
        model_type: str = "neural"
    ):
        """
        Cache correction result

        Args:
            text: Input text
            correction: (corrected_text, confidence)
            context: Context words
            model_type: Model type
        """
        if not settings.ENABLE_CACHE:
            return

        key = self._generate_key(text, context, model_type)

        try:
            if self.disk_cache is not None:
                self.disk_cache.set(key, correction, expire=self.ttl)
            elif self.redis_client is not None:
                cached_data = json.dumps(correction)
                self.redis_client.setex(key, self.ttl, cached_data)

            logger.debug(f"Cached correction for: {text[:50]}")

        except Exception as e:
            logger.error(f"Cache set error: {e}")

    def clear(self):
        """Clear all cached data"""
        try:
            if self.disk_cache is not None:
                self.disk_cache.clear()
                logger.info("Disk cache cleared")
            elif self.redis_client is not None:
                self.redis_client.flushdb()
                logger.info("Redis cache cleared")
        except Exception as e:
            logger.error(f"Cache clear error: {e}")

    def get_stats(self) -> dict:
        """Get cache performance statistics"""
        hit_rate = (self.hits / self.total_requests * 100) if self.total_requests > 0 else 0

        stats = {
            "cache_type": self.cache_type,
            "total_requests": self.total_requests,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 2),
            "enabled": settings.ENABLE_CACHE
        }

        # Add backend-specific stats
        if self.disk_cache is not None:
            try:
                stats["cache_size"] = len(self.disk_cache)
            except:
                pass

        if self.redis_client is not None:
            try:
                stats["redis_keys"] = self.redis_client.dbsize()
            except:
                pass

        return stats


# Global cache instance
_cache_instance: Optional[CorrectionCache] = None


def get_cache() -> CorrectionCache:
    """Get or create cache singleton"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CorrectionCache()
    return _cache_instance
