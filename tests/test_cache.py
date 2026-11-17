"""Cache helper tests. The Redis-backed ones skip if Redis is not running."""

import threading
import time
import uuid

import pytest

from src.utils import cache

needs_redis = pytest.mark.skipif(not cache.ping(), reason="Redis not running")


def _unique_key() -> str:
    return cache.make_key("test", "v0", {"id": uuid.uuid4().hex})


def test_key_is_stable_and_scoped_to_model_version():
    a = cache.make_key("predict", "v1", {"x": 1, "y": 2})
    assert a == cache.make_key("predict", "v1", {"y": 2, "x": 1})  # key order does not matter
    assert a != cache.make_key("predict", "v2", {"x": 1, "y": 2})  # retraining invalidates
    assert a != cache.make_key("predict", "v1", {"x": 1, "y": 3})


@needs_redis
def test_computed_once_then_served_from_cache():
    key, calls = _unique_key(), []

    def compute():
        calls.append(1)
        return {"x": 1}

    assert cache.get_or_compute(key, compute, ttl=30) == ({"x": 1}, False)
    assert cache.get_or_compute(key, compute, ttl=30) == ({"x": 1}, True)
    assert len(calls) == 1


@needs_redis
def test_concurrent_identical_requests_compute_only_once():
    key, calls, results = _unique_key(), [], []

    def compute():
        calls.append(1)
        time.sleep(0.4)
        return {"v": 42}

    def worker():
        results.append(cache.get_or_compute(key, compute, ttl=30))

    threads = [threading.Thread(target=worker) for _ in range(8)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert len(calls) == 1
    assert all(value == {"v": 42} for value, _ in results)
    assert sum(1 for _, cached in results if not cached) == 1


@needs_redis
def test_invalidate_removes_matching_keys():
    key = cache.make_key("stats-test", "v0", {"id": uuid.uuid4().hex})
    cache.get_or_compute(key, lambda: 1, ttl=30)
    assert cache.invalidate("churn:stats-test:*") >= 1
    assert cache.get_or_compute(key, lambda: 2, ttl=30) == (2, False)


@needs_redis
def test_marked_down_skips_redis_instantly_and_recovers_in_background(monkeypatch):
    monkeypatch.setattr(cache, "RETRY_AFTER", 0.1)
    cache._mark_down(RuntimeError("simulated outage"))
    assert cache._redis() is None  # requests skip Redis without any network access
    assert cache.get_or_compute("anything", lambda: 7) == (7, False)

    deadline = time.monotonic() + 5
    while cache._down and time.monotonic() < deadline:
        time.sleep(0.05)
    assert cache._down is False  # the background probe noticed Redis is reachable
    assert cache.ping() is True


def test_works_without_redis(monkeypatch):
    monkeypatch.setattr(cache, "_redis", lambda: None)
    assert cache.get_or_compute("anything", lambda: 5) == (5, False)
    assert cache.invalidate("churn:*") == 0
    assert cache.ping() is False
