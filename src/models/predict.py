"""Load the trained model artefact and score customers."""

from dataclasses import dataclass
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from src.utils.config import settings


class ModelNotAvailable(RuntimeError):
    pass


@dataclass(frozen=True)
class Bundle:
    pipeline: Pipeline
    metadata: dict
    background: pd.DataFrame  # training features, used by LIME to learn the data distribution

    @property
    def version(self) -> str:
        return self.metadata["model_version"]

    @property
    def threshold(self) -> float:
        return self.metadata["threshold"]


@lru_cache(maxsize=1)
def load_bundle() -> Bundle:
    if not settings.model_path.exists():
        raise ModelNotAvailable("No trained model found; run `python -m src.models.train`.")
    artefact = joblib.load(settings.model_path)
    return Bundle(artefact["pipeline"], artefact["metadata"], artefact["background"])


def predict_proba(bundle: Bundle, X: pd.DataFrame) -> np.ndarray:
    return bundle.pipeline.predict_proba(X)[:, 1]
