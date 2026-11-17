# churn-prediction-xai

Customer churn prediction with explainable AI (SHAP, LIME), PostgreSQL storage and a
vanilla HTML / CSS / JavaScript front end served by FastAPI.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | PostgreSQL schema, data cleaning + ingestion, pseudonyms/avatar seeds, customer and stats API | done |
| 2 | Model training, SHAP, LIME, counterfactuals, `/api/predict`, `/api/customers/{id}/explanation` | stubs (501) |
| 3 | Front end (`frontend/`) | not started |

## Quick start

```bash
cp .env.example .env
docker compose up -d --wait db          # PostgreSQL 17 on localhost:5433
python -m venv .venv && .venv/Scripts/activate   # Windows; use .venv/bin/activate elsewhere
pip install -r requirements.txt
python -m src.data.ingest               # create tables + load 7,043 customers (idempotent)
uvicorn app.api:app --reload            # http://localhost:8000/docs
pytest
```

The container uses host port **5433** so it does not clash with a locally installed
PostgreSQL on 5432. Credentials in `.env.example` are development-only.

## Layout

```
app/            FastAPI app (api.py) and Pydantic schemas
src/db/         SQLAlchemy models (customers, predictions, explanations[JSONB]), session
src/data/       load -> preprocess -> identity (username + avatar seed) -> ingest
src/features/   feature engineering (Phase 2)
src/models/     train / evaluate / predict (Phase 2)
src/explain/    SHAP, LIME, counterfactuals (Phase 2)
frontend/       vanilla HTML/CSS/JS; mounted at / automatically once index.html exists
notebooks/      EDA and modelling notebooks
tests/          pytest (API tests skip if Postgres is not running)
```

## API (Phase 1)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | DB connectivity |
| GET | `/api/customers` | `limit`, `offset`, `search` (username), `contract`, `churn` |
| GET | `/api/customers/{id}` | one profile |
| GET | `/api/stats/overview` | totals, churn rate, churn by contract |
| POST | `/api/predict` | 501 until Phase 2 |
| GET | `/api/customers/{id}/explanation` | 501 until Phase 2 |

Interactive docs at `/docs`.

## Design notes

- **Avatars are never stored.** Each customer has a deterministic `avatar_seed`; the front end
  renders the image from it, so the same customer always gets the same face.
- **Usernames are pseudonyms** derived from a hash of the original `customerID`.
- **Explanations are stored as JSONB** (`[{feature, value, contribution}, ...]`), so they can be
  rendered directly by the browser and queried in SQL.
- Tables are created with `create_all` for now; switch to Alembic migrations once the schema
  starts changing.
