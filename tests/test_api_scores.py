"""Tests for per-customer scores, risk filters, dashboard statistics and recent predictions.

Need Postgres (ingested), a trained model, and the model's scores stored; the fixture below computes
the scores (idempotent, ~10 s the first time for a new model version). Skipped otherwise.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api import app
from src.db.session import engine
from src.models.risk import HIGH_MIN, LOW_MAX, risk_band
from src.utils.config import settings


def _db_ready() -> bool:
    try:
        with engine.connect() as conn:
            return conn.execute(text("SELECT count(*) FROM customers")).scalar() > 0
    except Exception:
        return False


pytestmark = [
    pytest.mark.skipif(not _db_ready(), reason="Postgres not running or not ingested"),
    pytest.mark.skipif(not settings.model_path.exists(), reason="model not trained"),
]

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def _scores_and_cleanup():
    from src.models.precompute import precompute

    precompute()
    with engine.connect() as conn:
        first_new_id = conn.execute(text("SELECT coalesce(max(id), 0) FROM predictions")).scalar()
    yield
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM predictions WHERE customer_id IS NULL AND id > :first"), {"first": first_new_id}
        )


def test_risk_band_boundaries():
    assert risk_band(0.0) == "low" and risk_band(LOW_MAX - 1e-9) == "low"
    assert risk_band(LOW_MAX) == "medium" and risk_band(HIGH_MIN - 1e-9) == "medium"
    assert risk_band(HIGH_MIN) == "high" and risk_band(1.0) == "high"


def test_customer_list_includes_probability_and_matching_risk():
    items = client.get("/api/customers", params={"limit": 30}).json()["items"]
    assert items and all(c["churn_probability"] is not None for c in items)
    assert all(c["risk"] == risk_band(c["churn_probability"]) for c in items)


@pytest.mark.parametrize("band, check", [
    ("low", lambda p: p < LOW_MAX),
    ("medium", lambda p: LOW_MAX <= p < HIGH_MIN),
    ("high", lambda p: p >= HIGH_MIN),
])
def test_risk_filter_returns_only_that_band(band, check):
    body = client.get("/api/customers", params={"risk": band, "limit": 50}).json()
    assert body["total"] > 0
    assert all(c["risk"] == band and check(c["churn_probability"]) for c in body["items"])


def test_risk_filter_counts_add_up_to_total():
    totals = {b: client.get("/api/customers", params={"risk": b, "limit": 1}).json()["total"] for b in ("low", "medium", "high")}
    all_ = client.get("/api/customers", params={"limit": 1}).json()["total"]
    assert sum(totals.values()) == all_ == 7043


def test_sort_by_risk_is_monotonic():
    desc = [c["churn_probability"] for c in client.get("/api/customers", params={"sort": "risk_desc", "limit": 40}).json()["items"]]
    asc = [c["churn_probability"] for c in client.get("/api/customers", params={"sort": "risk_asc", "limit": 40}).json()["items"]]
    assert desc == sorted(desc, reverse=True) and asc == sorted(asc)
    assert desc[0] > asc[0]


def test_filters_combine():
    body = client.get("/api/customers", params={"risk": "high", "contract": "Month-to-month", "internet_service": "Fiber optic", "limit": 50}).json()
    assert body["total"] > 0
    assert all(c["risk"] == "high" and c["contract"] == "Month-to-month" and c["internet_service"] == "Fiber optic" for c in body["items"])


def test_tenure_range_filter():
    body = client.get("/api/customers", params={"tenure_min": 13, "tenure_max": 24, "limit": 50}).json()
    assert body["total"] > 0 and all(13 <= c["tenure"] <= 24 for c in body["items"])
    # the dashboard's tenure segment must agree with this filter
    seg = next(s for s in client.get("/api/stats/overview").json()["segments"] if s["dimension"] == "tenure" and s["value"] == "13-24 months")
    assert seg["customers"] == body["total"]


def test_invalid_risk_or_sort_is_rejected():
    assert client.get("/api/customers", params={"risk": "extreme"}).status_code == 422
    assert client.get("/api/customers", params={"sort": "random"}).status_code == 422


def test_customer_detail_has_score():
    body = client.get("/api/customers/1").json()
    assert body["churn_probability"] is not None and body["risk"] == risk_band(body["churn_probability"])


def test_overview_risk_distribution_is_consistent():
    body = client.get("/api/stats/overview").json()
    assert body["model_version"]
    dist = {d["band"]: d for d in body["risk_distribution"]}
    assert sum(d["customers"] for d in dist.values()) == body["customers"] == 7043
    assert body["high_risk_customers"] == dist["high"]["customers"]
    assert sum(b["customers"] for b in body["probability_histogram"]) == 7043
    assert dist["low"]["avg_probability"] < LOW_MAX <= dist["medium"]["avg_probability"] < HIGH_MIN <= dist["high"]["avg_probability"]
    # the bands should be informative: observed churn rises with the band
    assert dist["low"]["observed_churn_rate"] < dist["medium"]["observed_churn_rate"] < dist["high"]["observed_churn_rate"]
    assert body["risk_thresholds"]["high_min"] == HIGH_MIN


def test_overview_segments_cover_every_customer_per_dimension():
    segs = client.get("/api/stats/overview").json()["segments"]
    for dim in ("contract", "internet_service", "tenure"):
        assert sum(s["customers"] for s in segs if s["dimension"] == dim) == 7043


def test_recent_predictions_lists_form_predictions_newest_first():
    payload = {
        "gender": "Female", "senior_citizen": False, "partner": True, "dependents": False, "tenure": 5,
        "phone_service": True, "multiple_lines": "No", "internet_service": "Fiber optic",
        "online_security": "No", "online_backup": "No", "device_protection": "No", "tech_support": "No",
        "streaming_tv": "No", "streaming_movies": "No", "contract": "Month-to-month",
        "paperless_billing": True, "payment_method": "Electronic check",
        "monthly_charges": 77.77, "total_charges": 388.85,
    }
    made = client.post("/api/predict", json=payload).json()
    assert made["predicted_at"] and made["risk"] == risk_band(made["probability"])
    recent = client.get("/api/predictions/recent", params={"limit": 5}).json()
    assert recent[0]["id"] == made["prediction_id"]
    assert recent[0]["created_at"] == made["predicted_at"]
    assert recent[0]["risk"] == risk_band(recent[0]["probability"])
    assert recent[0]["contract"] == "Month-to-month" and recent[0]["monthly_charges"] == 77.77
    stamps = [r["created_at"] for r in recent]
    assert stamps == sorted(stamps, reverse=True)
    assert client.get("/api/predictions/recent", params={"limit": 0}).status_code == 422
