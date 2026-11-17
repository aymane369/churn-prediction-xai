"""One-shot setup, run by the `init` container (and usable by hand): python -m src.bootstrap

1. wait for PostgreSQL
2. create tables and ingest the customers          (idempotent)
3. train the model if models/churn_model.joblib is missing  (skipped when it exists)
4. score every customer + store SHAP                (idempotent per model version)

Safe to run on every `docker compose up`: after the first run it takes a few seconds.
Set TRAIN_TRIALS to change the number of Optuna trials (default 40).
"""

import os
import time

from sqlalchemy import text

from src.data.ingest import ingest
from src.db.session import engine
from src.models.precompute import precompute
from src.models.train import train
from src.utils.config import settings


def wait_for_db(timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while True:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as exc:
            if time.monotonic() > deadline:
                raise RuntimeError(f"PostgreSQL not reachable after {timeout:.0f}s") from exc
            time.sleep(1)


def main() -> None:
    print("[bootstrap] waiting for PostgreSQL...", flush=True)
    wait_for_db()

    total, inserted = ingest()
    print(f"[bootstrap] customers: {total} in file, {inserted} newly inserted", flush=True)

    if settings.model_path.exists():
        print("[bootstrap] model already trained, skipping training", flush=True)
    else:
        trials = int(os.environ.get("TRAIN_TRIALS", "40"))
        print(f"[bootstrap] no model found: training ({trials} Optuna trials, ~2 min)...", flush=True)
        train(trials)

    created, _ = precompute()
    print(f"[bootstrap] predictions created: {created}", flush=True)
    print("[bootstrap] done", flush=True)


if __name__ == "__main__":
    main()
