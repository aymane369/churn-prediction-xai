"""API tests. They need the Postgres container running, the data ingested and (for the prediction
tests) a trained model; they skip otherwise. Redis is optional: cache assertions skip without it.

    docker compose up -d --wait db redis
    python -m src.data.ingest && python -m src.models.train && python -m src.models.precompute
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api import app
from src.db.session import engine
from src.utils import cache
from src.utils.config import settings


def _db_ready() -> bool:
    try:
        with engine.connect() as conn:
            return conn.execute(text("SELECT count(*) FROM customers")).scalar() > 0
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_ready(), reason="Postgres not running or not ingested")
needs_model = pytest.mark.skipif(not settings.model_path.exists(), reason="model not trained")

client = TestClient(app)

VALID = {
    "gender": "Female", "senior_citizen": False, "partner": True, "dependents": False,
    "tenure": 77, "phone_service": True, "multiple_lines": "No", "internet_service": "Fiber optic",
    "online_security": "No", "online_backup": "No", "device_protection": "No", "tech_support": "No",
    "streaming_tv": "No", "streaming_movies": "No", "contract": "Month-to-month",
    "paperless_billing": True, "payment_method": "Electronic check",
    "monthly_charges": 12.34, "total_charges": 950.18,
}


@pytest.fixture(autouse=True, scope="module")
def _cleanup_test_predictions():
    """/api/predict logs every call; remove the form predictions created by this module."""
    with engine.connect() as conn:
        first_new_id = conn.execute(text("SELECT coalesce(max(id), 0) FROM predictions")).scalar()
    yield
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM predictions WHERE customer_id IS NULL AND id > :first"),
            {"first": first_new_id},
        )


def test_health():
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and body["database"] == "up"
    assert body["cache"] in ("up", "down")


def test_list_customers_pagination():
    body = client.get("/api/customers", params={"limit": 5}).json()
    assert body["total"] == 7043
    assert len(body["items"]) == 5


def test_filter_by_contract_and_churn():
    body = client.get("/api/customers", params={"contract": "Two year", "churn": True}).json()
    assert all(c["contract"] == "Two year" and c["churn"] for c in body["items"])


def test_customer_detail_and_404():
    first = client.get("/api/customers", params={"limit": 1}).json()["items"][0]
    assert client.get(f"/api/customers/{first['id']}").json()["username"] == first["username"]
    assert client.get("/api/customers/999999").status_code == 404
    assert client.get("/api/customers/999999/explanation").status_code == 404


def test_overview():
    body = client.get("/api/stats/overview").json()
    assert body["customers"] == 7043
    assert 0.26 < body["churn_rate"] < 0.27
    assert client.get("/api/stats/overview").json() == body  # identical when served from cache


@needs_model
def test_model_info():
    body = client.get("/api/model").json()
    assert body["model_version"] and 0 < body["threshold"] < 1
    assert body["metrics"]["xgboost_tuned"]["test"]["roc_auc"] > 0.8
    assert "Month-to-month" in body["categories"]["contract"]


@needs_model
def test_predict_returns_label_probability_and_both_explanations():
    body = client.post("/api/predict", json=VALID).json()
    assert isinstance(body["churn"], bool) and 0 <= body["probability"] <= 1
    assert body["churn"] == (body["probability"] >= body["threshold"])
    methods = {e["method"]: e for e in body["explanations"]}
    assert set(methods) == {"shap", "lime"}
    for e in methods.values():
        assert len(e["values"]) == 19
        assert {"feature", "label", "value", "contribution"} <= set(e["values"][0])
    assert "rule" in methods["lime"]["values"][0]


@needs_model
@pytest.mark.skipif(not cache.ping(), reason="Redis not running")
def test_predict_second_identical_call_is_cached_and_identical():
    client.post("/api/predict", json=VALID)
    second = client.post("/api/predict", json=VALID).json()
    assert second["cached"] is True
    # A different input is a different cache key. The value must be new on every run, because
    # entries live for 24 h and a fixed one would already be cached by the previous run.
    unique_charge = round(100 + uuid.uuid4().int % 90000 / 100, 2)
    third = client.post("/api/predict", json={**VALID, "monthly_charges": unique_charge}).json()
    assert third["cached"] is False


@needs_model
@pytest.mark.parametrize(
    "patch",
    [{"contract": "Weekly"}, {"tenure": -1}, {"monthly_charges": "abc"}, {"gender": None}],
)
def test_predict_rejects_invalid_input(patch):
    assert client.post("/api/predict", json={**VALID, **patch}).status_code == 422


def test_predict_rejects_missing_fields():
    assert client.post("/api/predict", json={}).status_code == 422


@needs_model
def test_customer_explanation_matches_form_prediction_for_same_attributes():
    customer = client.get("/api/customers/1").json()
    stored = client.get("/api/customers/1/explanation").json()
    assert {e["method"] for e in stored["explanations"]} == {"shap", "lime"}

    form_input = {k: customer[k] for k in VALID}
    from_form = client.post("/api/predict", json=form_input).json()
    assert from_form["probability"] == pytest.approx(stored["probability"], abs=1e-6)
    assert from_form["churn"] == stored["churn"]
    # second read is served from PostgreSQL
    assert client.get("/api/customers/1/explanation").json()["cached"] is True
