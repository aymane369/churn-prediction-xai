"""Deterministic pseudonyms and avatar seeds.

Derived from a hash of the source id, so re-running the ingestion always gives
the same username and the same avatar to the same customer. The avatar itself is
rendered later by the front end from `avatar_seed` (the image is never stored).
"""

import hashlib
from collections.abc import Iterable

ADJECTIVES = [
    "swift", "calm", "brave", "clever", "bright", "quiet", "happy", "lucky", "gentle", "bold",
    "cosmic", "dusty", "eager", "fancy", "golden", "hidden", "icy", "jolly", "keen", "lively",
    "mellow", "noble", "odd", "proud", "rapid", "silent", "tiny", "urban", "vivid", "witty",
    "amber", "breezy", "crimson", "dapper", "electric", "fuzzy", "glassy", "humble", "indigo",
    "jade", "kind", "lunar", "misty", "neon", "olive", "plucky", "rusty", "sunny", "teal", "zesty",
]
ANIMALS = [
    "otter", "falcon", "panda", "lynx", "heron", "badger", "gecko", "koala", "marten", "newt",
    "ocelot", "puffin", "quokka", "raven", "seal", "tiger", "urchin", "viper", "walrus", "yak",
    "zebra", "alpaca", "bison", "crane", "dingo", "egret", "ferret", "gopher", "hare", "ibis",
    "jackal", "kiwi", "lemur", "moose", "narwhal", "osprey", "parrot", "quail", "robin", "stoat",
    "tapir", "umbra", "vole", "wombat", "xerus", "yeti", "zorilla", "finch", "orca", "mole",
]


def _digest(text: str, salt: int = 0) -> int:
    return int.from_bytes(hashlib.sha256(f"{salt}:{text}".encode()).digest()[:8], "big")


def avatar_seed(source_id: str) -> str:
    return hashlib.sha256(f"avatar:{source_id}".encode()).hexdigest()[:16]


def username_for(source_id: str, attempt: int = 0) -> str:
    n = _digest(source_id, attempt)
    adjective = ADJECTIVES[n % len(ADJECTIVES)]
    animal = ANIMALS[(n // len(ADJECTIVES)) % len(ANIMALS)]
    number = (n // (len(ADJECTIVES) * len(ANIMALS))) % 1000
    return f"{adjective}_{animal}_{number:03d}"


def assign_identities(source_ids: Iterable[str]) -> dict[str, tuple[str, str]]:
    """Map each source id to (username, avatar_seed), keeping usernames unique."""
    taken: set[str] = set()
    result: dict[str, tuple[str, str]] = {}
    for sid in source_ids:
        attempt = 0
        name = username_for(sid, attempt)
        while name in taken:
            attempt += 1
            name = username_for(sid, attempt)
        taken.add(name)
        result[sid] = (name, avatar_seed(sid))
    return result
