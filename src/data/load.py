"""Read the raw Telco CSV."""

from pathlib import Path

import pandas as pd

from src.utils.config import settings


def load_raw(path: Path | None = None) -> pd.DataFrame:
    # TotalCharges contains blank strings, so keep it as text and let preprocess.py convert it.
    return pd.read_csv(path or settings.raw_data_path, dtype={"TotalCharges": "string"})
