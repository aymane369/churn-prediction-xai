"""Redis cache with graceful degradation.

- Keys embed the model version, so retraining invalidates old entries automatically.
- A short-lived lock makes concurrent identical requests compute once, not N times.
- If Redis is unreachable the value is simply computed (the app never depends on the cache).
  Once Redis is detected as down, requests skip it instantly; a background thread probes for its
  return. (Probing from the request path would stall users: when a container is stopped, even the
  DNS lookup of its hostname takes ~4 s to fail.)
"""

import hashlib
import json
import logging
import threading
import time
from collections.abc import Callable
from typing import Any

import redis

from src.utils.config import settings

log = logging.getLogger(__name__)

LOCK_TTL = 30  # seconds a computation may hold the lock
RETRY_AFTER = 5.0  # seconds between background probes while Redis is down

_client: redis.Redis | None = None
_down = False
_recovery_running = threading.Lock()


def _connect() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.3,
            socket_timeout=1.0,
        )
    return _client


def _redis() -> redis.Redis | None:
    """The client, or None while Redis is considered down (no network access in that case)."""
    return None if _down else _connect()


def _recover() -> None:
    global _down
    try:
        while True:
            time.sleep(RETRY_AFTER)
            try:
                _connect().ping()
            except Exception:  # still down (redis errors, DNS failures, ...)
                continue
            _down = False
            log.warning("Redis is back; cache re-enabled")
            return
    finally:
        _recovery_running.release()


def _mark_down(exc: Exception) -> None:
    global _down
    _down = True
    log.warning("Redis unavailable (%s); computing without cache until it returns", exc)
    if _recovery_running.acquire(blocking=False):
        threading.Thread(target=_recover, name="redis-recovery", daemon=True).start()


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
    except (redis.RedisError, OSError) as exc:
        _mark_down(exc)
        return compute(), False

    if have_lock:
        try:
            value = compute()
            try:
                r.set(key, json.dumps(value), ex=ttl)
            except (redis.RedisError, OSError) as exc:
                _mark_down(exc)
            return value, False
        finally:
            try:
                r.delete(f"{key}:lock")
            except (redis.RedisError, OSError):
                pass

    # Another request is computing the same thing: wait for its result.
    deadline = time.monotonic() + lock_wait
    while time.monotonic() < deadline:
        time.sleep(0.05)
        try:
            cached = r.get(key)
        except (redis.RedisError, OSError) as exc:
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
    except (redis.RedisError, OSError) as exc:
        _mark_down(exc)
        return 0


def ping() -> bool:
    r = _redis()
    if r is None:
        return False
    try:
        return bool(r.ping())
    except (redis.RedisError, OSError) as exc:
        _mark_down(exc)
        return False
