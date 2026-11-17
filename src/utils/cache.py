"""Redis cache with graceful degradation.

- Keys embed the model version, so retraining invalidates old entries automatically.
- A short-lived lock makes concurrent identical requests compute once, not N times.
- If Redis is unreachable the value is simply computed (the app never depends on the cache),
  and Redis is skipped for a few seconds to avoid paying a connect timeout on every request.
"""

import hashlib
import json
import logging
import time
from collections.abc import Callable
from typing import Any

import redis

from src.utils.config import settings

log = logging.getLogger(__name__)

LOCK_TTL = 30  # seconds a computation may hold the lock
RETRY_AFTER = 10.0  # seconds to skip Redis after a failure

_client: redis.Redis | None = None
_down_until = 0.0


def _redis() -> redis.Redis | None:
    global _client
    if time.monotonic() < _down_until:
        return None
    if _client is None:
        _client = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.3,
            socket_timeout=1.0,
        )
    return _client


def _mark_down(exc: Exception) -> None:
    global _down_until
    _down_until = time.monotonic() + RETRY_AFTER
    log.warning("Redis unavailable (%s); computing without cache for %.0fs", exc, RETRY_AFTER)


def make_key(kind: str, model_version: str, payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return f"churn:{kind}:{model_version}:{hashlib.sha256(canonical.encode()).hexdigest()[:32]}"


def get_or_compute(
    key: str, compute: Callable[[], Any], ttl: int | None = None, lock_wait: float = 15.0
) -> tuple[Any, bool]:
    """Return (value, was_cached). `compute` must return something JSON-serialisable."""
    ttl = ttl or settings.cache_ttl_seconds
    r = _redis()
    if r is None:
        return compute(), False

    try:
        cached = r.get(key)
        if cached is not None:
            return json.loads(cached), True
        have_lock = r.set(f"{key}:lock", "1", nx=True, ex=LOCK_TTL)
    except redis.RedisError as exc:
        _mark_down(exc)
        return compute(), False

    if have_lock:
        try:
            value = compute()
            try:
                r.set(key, json.dumps(value), ex=ttl)
            except redis.RedisError as exc:
                _mark_down(exc)
            return value, False
        finally:
            try:
                r.delete(f"{key}:lock")
            except redis.RedisError:
                pass

    # Another request is computing the same thing: wait for its result.
    deadline = time.monotonic() + lock_wait
    while time.monotonic() < deadline:
        time.sleep(0.05)
        try:
            cached = r.get(key)
        except redis.RedisError as exc:
            _mark_down(exc)
            break
        if cached is not None:
            return json.loads(cached), True
    return compute(), False


def invalidate(pattern: str) -> int:
    """Delete keys matching a glob pattern (e.g. 'churn:stats:*'). Returns how many were removed."""
    r = _redis()
    if r is None:
        return 0
    try:
        keys = list(r.scan_iter(match=pattern, count=500))
        return r.delete(*keys) if keys else 0
    except redis.RedisError as exc:
        _mark_down(exc)
        return 0


def ping() -> bool:
    r = _redis()
    if r is None:
        return False
    try:
        return bool(r.ping())
    except redis.RedisError as exc:
        _mark_down(exc)
        return False
