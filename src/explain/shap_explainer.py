"""TreeSHAP explanations, aggregated from one-hot columns back to the original features.

Contributions are in log-odds (the model's margin): positive pushes towards churn.
base_value + sum(contributions) = the model's log-odds for that customer (to ~1e-6).

The values come from shap.TreeExplainer (identical to XGBoost's native TreeSHAP), but the base
value is read from XGBoost itself: shap's `expected_value` is off by ~0.004 log-odds with
XGBoost 3.x, which would break additivity.
"""

import numpy as np
import pandas as pd
import shap
import xgboost as xgb

from src.explain.common import contribution_list
from src.features.build_features import BOOLEAN, CATEGORICAL, FEATURES, NUMERIC
from src.models.predict import Bundle


class ShapExplainer:
    def __init__(self, bundle: Bundle):
        self.prep = bundle.pipeline.named_steps["prep"]
        model = bundle.pipeline.named_steps["model"]
        self.explainer = shap.TreeExplainer(model)
        probe = xgb.DMatrix(self.prep.transform(bundle.background.iloc[:1]))
        self.base_value = float(model.get_booster().predict(probe, pred_contribs=True)[0, -1])

        # Matrix that sums encoded (one-hot) columns back into their original feature.
        owner: dict[str, str] = {}
        encoder = self.prep.named_transformers_["cat"]
        for feature, categories in zip(CATEGORICAL, encoder.categories_):
            for category in categories:
                owner[f"{feature}_{category}"] = feature
        owner.update({f: f for f in NUMERIC + BOOLEAN})

        names = list(self.prep.get_feature_names_out())
        self.group = np.zeros((len(names), len(FEATURES)))
        for j, name in enumerate(names):
            self.group[j, FEATURES.index(owner[name])] = 1.0

    def explain(self, X: pd.DataFrame) -> list[dict]:
        encoded = self.prep.transform(X)
        per_feature = np.asarray(self.explainer.shap_values(encoded)) @ self.group
        return [
            {
                "method": "shap",
                "base_value": self.base_value,
                "values": contribution_list(X.iloc[i], per_feature[i]),
            }
            for i in range(len(X))
        ]
