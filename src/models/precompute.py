"""Store the score + SHAP explanation of every customer in PostgreSQL.

Usage: python -m src.models.precompute [--lime-top 200]

SHAP is computed for all customers in batches (seconds). LIME is computed on a customer's first
view by the API; --lime-top also fills it in now for the N highest-risk customers.
Idempotent per model version: customers that already have a prediction are skipped.
"""

import argparse

import pandas as pd
from sqlalchemy import select

from src.db.models import Customer, Explanation, Prediction
from src.db.session import SessionLocal
from src.features.build_features import build_features
from src.models.predict import load_bundle, predict_proba
from src.models.service import customer_prediction, get_shap, normalize

BATCH = 500


def precompute(lime_top: int = 0) -> tuple[int, int]:
    """Returns (predictions_created, lime_filled)."""
    bundle, shap_explainer = load_bundle(), get_shap()
    created = filled = 0
    with SessionLocal() as session:
        done = set(
            session.scalars(
                select(Prediction.customer_id).where(
                    Prediction.customer_id.is_not(None), Prediction.model_version == bundle.version
                )
            )
        )
        todo = [c for c in session.scalars(select(Customer).order_by(Customer.id)) if c.id not in done]

        for i in range(0, len(todo), BATCH):
            chunk = todo[i : i + BATCH]
            features = [normalize(c) for c in chunk]
            X = build_features(pd.DataFrame(features))
            proba = predict_proba(bundle, X)
            explanations = shap_explainer.explain(X)
            for customer, feats, p, e in zip(chunk, features, proba, explanations):
                session.add(
                    Prediction(
                        customer_id=customer.id,
                        input=feats,
                        probability=float(p),
                        label=bool(p >= bundle.threshold),
                        model_version=bundle.version,
                        explanations=[
                            Explanation(method="shap", base_value=e["base_value"], values=e["values"])
                        ],
                    )
                )
            session.commit()
            created += len(chunk)

        if lime_top:
            risky = session.scalars(
                select(Customer)
                .join(Prediction, Prediction.customer_id == Customer.id)
                .where(Prediction.model_version == bundle.version)
                .order_by(Prediction.probability.desc())
                .limit(lime_top)
            ).all()
            for customer in risky:
                _, was_complete = customer_prediction(session, customer)
                filled += 0 if was_complete else 1
    return created, filled


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--lime-top", type=int, default=0, help="also compute LIME for the N riskiest")
    created, filled = precompute(parser.parse_args().lime_top)
    print(f"{created} predictions created, LIME filled for {filled} customers.")
