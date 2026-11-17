"""API tests. They need the Postgres container running and the data ingested
(docker compose up -d db && python -m src.data.ingest); they skip otherwise."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api import app
from src.db.session import engine


def _db_ready() -> bool:
    try:
        with engine.connect() as conn:
            return conn.execute(text("SELECT count(*) FROM customers")).scalar() > 0
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_ready(), reason="Postgres not running or not ingested")

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok", "database": "up"}


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


def test_overview():
    body = client.get("/api/stats/overview").json()
    assert body["customers"] == 7043
    assert 0.26 < body["churn_rate"] < 0.27


def test_predict_is_stubbed():
    assert client.post("/api/predict", json={}).status_code in (422, 501)
