"""Create all tables.  Usage: python -m src.db.init_db"""

from src.db import models  # noqa: F401  (registers the tables on Base.metadata)
from src.db.session import Base, engine


def init_db() -> None:
    Base.metadata.create_all(engine)


if __name__ == "__main__":
    init_db()
    print("Tables ready:", ", ".join(Base.metadata.tables))
