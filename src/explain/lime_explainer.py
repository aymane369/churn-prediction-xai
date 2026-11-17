"""LIME explanations on the original (un-encoded) features.

Weights are a local linear approximation of the churn *probability* (not log-odds, unlike SHAP).
Results are deterministic: the random generator is re-seeded for every call, so the same input
always gives the same explanation (which also makes caching it meaningful).
"""

import threading

import numpy as np
import pandas as pd
from lime.lime_tabular import LimeTabularExplainer

from src.explain.common import contribution_list
from src.features.build_features import BOOLEAN, CATEGORICAL, FEATURES, LABELS, NUMERIC
from src.models.predict import Bundle

SEED = 42


class LimeExplainer:
    def __init__(self, bundle: Bundle, num_samples: int = 5000):
        self.pipeline = bundle.pipeline
        self.num_samples = num_samples
        self.levels = {f: np.array(bundle.metadata["categories"][f], dtype=object) for f in CATEGORICAL}
        self._lock = threading.Lock()  # the underlying explainer mutates its RNG

        index = {f: i for i, f in enumerate(FEATURES)}
        names = {index[f]: list(self.levels[f]) for f in CATEGORICAL}
        names.update({index[f]: ["No", "Yes"] for f in BOOLEAN})
        self.explainer = LimeTabularExplainer(
            self._encode(bundle.background),
            feature_names=[LABELS[f] for f in FEATURES],
            categorical_features=sorted(names),
            categorical_names=names,
            class_names=["stay", "churn"],
            mode="classification",
            discretize_continuous=True,
            random_state=SEED,
        )

    def _encode(self, X: pd.DataFrame) -> np.ndarray:
        """DataFrame -> numeric matrix (categories as integer codes), the layout LIME expects."""
        out = np.zeros((len(X), len(FEATURES)))
        for j, feature in enumerate(FEATURES):
            if feature in CATEGORICAL:
                codes = pd.Categorical(X[feature], categories=list(self.levels[feature])).codes
                if (codes < 0).any():
                    raise ValueError(f"Unknown category in {feature}")
                out[:, j] = codes
            else:
                out[:, j] = X[feature].to_numpy(dtype=float)
        return out

    def _decode(self, matrix: np.ndarray) -> pd.DataFrame:
        data = {}
        for j, feature in enumerate(FEATURES):
            column = matrix[:, j]
            if feature in CATEGORICAL:
                data[feature] = self.levels[feature][column.astype(int)]
            elif feature in BOOLEAN:
                data[feature] = column.astype(int)
            else:
                data[feature] = column.astype(float)
        return pd.DataFrame(data)

    def _predict(self, matrix: np.ndarray) -> np.ndarray:
        return self.pipeline.predict_proba(self._decode(matrix))

    def explain(self, X: pd.DataFrame) -> dict:
        """Explain a single-row frame."""
        row = self._encode(X)[0]
        with self._lock:
            # The explainer, its linear-model base and its discretizer all share this single
            # RandomState object, so it must be re-seeded in place (replacing it would leave
            # the discretizer drawing from the old one).
            self.explainer.random_state.seed(SEED)
            exp = self.explainer.explain_instance(
                row, self._predict, labels=(1,), num_features=len(FEATURES), num_samples=self.num_samples
            )
        pairs = exp.as_map()[1]  # [(feature index, weight)], same order as as_list
        rules = {FEATURES[i]: text for (i, _), (text, _) in zip(pairs, exp.as_list(label=1))}
        weights = np.zeros(len(FEATURES))
        for i, w in pairs:
            weights[i] = w
        return {
            "method": "lime",
            "base_value": float(exp.intercept[1]),
            "values": contribution_list(X.iloc[0], weights, rules),
        }
