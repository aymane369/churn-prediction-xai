"""Load the cleaned Telco data into PostgreSQL.  Usage: python -m src.data.ingest

Idempotent: customers already present (same source_id) are left untouched.
"""

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from src.data.identity import assign_identities
from src.data.load import load_raw
from src.data.preprocess import clean
from src.db.init_db import init_db
from src.db.models import Customer
from src.db.session import SessionLocal
from src.utils import cache

BATCH = 1000


def ingest() -> tuple[int, int]:
    """Returns (rows_in_file, rows_inserted)."""
    df = clean(load_raw())
    identities = assign_identities(df["source_id"])
    df["username"] = df["source_id"].map(lambda s: identities[s][0])
    df["avatar_seed"] = df["source_id"].map(lambda s: identities[s][1])

    records = df.to_dict(orient="records")
    init_db()
    with SessionLocal() as session:
        before = session.scalar(select(func.count()).select_from(Customer))
        for i in range(0, len(records), BATCH):
            stmt = insert(Customer).values(records[i : i + BATCH]).on_conflict_do_nothing(
                index_elements=["source_id"]
            )
            session.execute(stmt)
        session.commit()
        after = session.scalar(select(func.count()).select_from(Customer))
    cache.invalidate("churn:stats:*")  # cached overview stats are now stale
    return len(records), after - before


if __name__ == "__main__":
    total, inserted = ingest()
    print(f"{total} rows in file, {inserted} inserted ({total - inserted} already present).")
