"""Explainer correctness tests (need the trained model, no database)."""

import numpy as np
import pytest

from src.data.load import load_raw
from src.data.preprocess import clean
from src.features.build_features import FEATURES, build_features
from src.utils.config import settings

pytestmark = pytest.mark.skipif(not settings.model_path.exists(), reason="model not trained")


@pytest.fixture(scope="module")
def setup():
    from src.explain.lime_explainer import LimeExplainer
    from src.explain.shap_explainer import ShapExplainer
    from src.models.predict import load_bundle, predict_proba

    bundle = load_bundle()
    X = build_features(clean(load_raw())).sample(25, random_state=1).reset_index(drop=True)
    return bundle, X, predict_proba(bundle, X), ShapExplainer(bundle), LimeExplainer(bundle)


def test_shap_is_additive_in_log_odds(setup):
    _, X, proba, shap_explainer, _ = setup
    for p, e in zip(proba, shap_explainer.explain(X)):
        total = e["base_value"] + sum(v["contribution"] for v in e["values"])
        assert total == pytest.approx(np.log(p / (1 - p)), abs=1e-4)


def test_shap_covers_each_feature_once_sorted_by_magnitude(setup):
    _, X, _, shap_explainer, _ = setup
    values = shap_explainer.explain(X.iloc[:1])[0]["values"]
    assert sorted(v["feature"] for v in values) == sorted(FEATURES)
    magnitudes = [abs(v["contribution"]) for v in values]
    assert magnitudes == sorted(magnitudes, reverse=True)


def test_shap_direction_matches_domain_knowledge(setup):
    _, _, _, shap_explainer, _ = setup
    base = {  # a loyal customer on a two-year contract vs. a new month-to-month one
        "gender": "Male", "multiple_lines": "No", "internet_service": "DSL", "online_security": "Yes",
        "online_backup": "Yes", "device_protection": "Yes", "tech_support": "Yes",
        "streaming_tv": "No", "streaming_movies": "No", "contract": "Two year",
        "payment_method": "Bank transfer (automatic)", "senior_citizen": 0, "partner": 1,
        "dependents": 1, "phone_service": 1, "paperless_billing": 0,
        "tenure": 60.0, "monthly_charges": 70.0, "total_charges": 4200.0,
    }
    import pandas as pd

    loyal = pd.DataFrame([base])
    risky = pd.DataFrame([{**base, "contract": "Month-to-month", "tenure": 1.0, "total_charges": 70.0}])
    contrib = lambda df: {v["feature"]: v["contribution"] for v in shap_explainer.explain(df)[0]["values"]}
    assert contrib(loyal)["contract"] < 0 < contrib(risky)["contract"]


def test_lime_is_deterministic(setup):
    _, X, _, _, lime_explainer = setup
    assert lime_explainer.explain(X.iloc[[3]]) == lime_explainer.explain(X.iloc[[3]])


def test_lime_returns_all_features_with_rules(setup):
    _, X, _, _, lime_explainer = setup
    values = lime_explainer.explain(X.iloc[[0]])["values"]
    assert sorted(v["feature"] for v in values) == sorted(FEATURES)
    assert any(v.get("rule") for v in values)


def test_lime_rejects_unknown_category(setup):
    _, X, _, _, lime_explainer = setup
    bad = X.iloc[[0]].copy()
    bad["contract"] = "Weekly"
    with pytest.raises(ValueError):
        lime_explainer.explain(bad)


def test_deployed_model_beats_a_trivial_baseline():
    from src.models.predict import load_bundle

    test = load_bundle().metadata["metrics"]["xgboost_tuned"]["test"]
    assert test["roc_auc"] > 0.8
    assert test["recall"] > 0.6
