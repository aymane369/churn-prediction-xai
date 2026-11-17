"""Scoring + explanation orchestration: Redis cache in front, PostgreSQL as the durable record."""

from functools import lru_cache

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db.models import Customer, Explanation, Prediction
from src.explain.lime_explainer import LimeExplainer
from src.explain.shap_explainer import ShapExplainer
from src.features.build_features import BOOLEAN, FEATURES, NUMERIC, build_features
from src.models.predict import Bundle, load_bundle, predict_proba
from src.utils.cache import get_or_compute, make_key


@lru_cache(maxsize=1)
def get_shap() -> ShapExplainer:
    return ShapExplainer(load_bundle())


@lru_cache(maxsize=1)
def get_lime() -> LimeExplainer:
    return LimeExplainer(load_bundle())


def warm_up() -> None:
    get_shap()
    get_lime()


def normalize(raw) -> dict:
    """Canonical feature dict (stable types), so equal inputs always give the same cache key."""
    out: dict = {}
    for f in FEATURES:
        v = raw[f] if isinstance(raw, dict) else getattr(raw, f)
        if f in BOOLEAN:
            out[f] = bool(v)
        elif f == "tenure":
            out[f] = int(v)
        elif f in NUMERIC:
            out[f] = round(float(v), 2)
        else:
            out[f] = str(v)
    return out


def _compute(bundle: Bundle, features: dict) -> dict:
    X = build_features(pd.DataFrame([features]))
    probability = float(predict_proba(bundle, X)[0])
    return {
        "probability": probability,
        "churn": probability >= bundle.threshold,
        "threshold": bundle.threshold,
        "model_version": bundle.version,
        "explanations": [get_shap().explain(X)[0], get_lime().explain(X)],
    }


def score_and_explain(raw) -> tuple[dict, bool]:
    """Probability + SHAP + LIME for one feature set. Returns (result, served_from_cache)."""
    bundle = load_bundle()
    features = normalize(raw)
    key = make_key("predict", bundle.version, features)
    return get_or_compute(key, lambda: _compute(bundle, features))


def _explanation_rows(result: dict) -> list[Explanation]:
    return [
        Explanation(method=e["method"], base_value=e["base_value"], values=e["values"])
        for e in result["explanations"]
    ]


def _upsert_explanations(pred: Prediction, result: dict) -> None:
    """Update rows in place: replacing the collection would insert before deleting and hit the
    (prediction_id, method) unique constraint."""
    existing = {e.method: e for e in pred.explanations}
    for new in result["explanations"]:
        row = existing.get(new["method"])
        if row is None:
            pred.explanations.append(
                Explanation(method=new["method"], base_value=new["base_value"], values=new["values"])
            )
        else:
            row.base_value, row.values = new["base_value"], new["values"]


def save_form_prediction(session: Session, raw, result: dict) -> Prediction:
    """Log a prediction made from the 'enter parameters' form (no customer attached)."""
    pred = Prediction(
        customer_id=None,
        input=normalize(raw),
        probability=result["probability"],
        label=result["churn"],
        model_version=result["model_version"],
        explanations=_explanation_rows(result),
    )
    session.add(pred)
    session.commit()
    return pred


def customer_prediction(session: Session, customer: Customer) -> tuple[Prediction, bool]:
    """Stored prediction + both explanations for a customer, computed on first request.

    Returns (prediction, already_in_database).
    """
    bundle = load_bundle()
    pred = session.scalar(
        select(Prediction)
        .where(Prediction.customer_id == customer.id, Prediction.model_version == bundle.version)
        .options(selectinload(Prediction.explanations))
        .order_by(Prediction.id.desc())
        .limit(1)
    )
    if pred is not None and {e.method for e in pred.explanations} == {"shap", "lime"}:
        return pred, True

    result, _ = score_and_explain(customer)
    if pred is None:
        pred = Prediction(
            customer_id=customer.id,
            input=normalize(customer),
            probability=result["probability"],
            label=result["churn"],
            model_version=result["model_version"],
        )
        session.add(pred)
    _upsert_explanations(pred, result)
    session.commit()
    return pred, False
