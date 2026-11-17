# churn-prediction-xai

Customer churn prediction with explainable AI (SHAP, LIME), PostgreSQL storage, a Redis cache and a
vanilla HTML / CSS / JavaScript front end served by FastAPI.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | PostgreSQL schema, data cleaning + ingestion, pseudonyms/avatar seeds, customer and stats API | done |
| 2 | XGBoost model, SHAP + LIME, Redis cache, `/api/predict`, customer explanations | done |
| 2b | Counterfactuals ("what would change this prediction?") with DiCE | not started |
| 3 | Front end (`frontend/`) | not started |

## Requirements

Python **3.12** (the project venv uses 3.12), Docker Desktop.

## Quick start

```bash
cp .env.example .env
docker compose up -d --wait db redis    # PostgreSQL 17 on :5433, Redis 7 on :6379
py -3.12 -m venv .venv && .venv/Scripts/activate   # Windows; use .venv/bin/activate elsewhere
pip install -r requirements-ml.txt
python -m src.data.ingest               # create tables + load 7,043 customers (idempotent)
python -m src.models.train              # ~2 min: tunes XGBoost, writes models/churn_model.joblib
python -m src.models.precompute         # score + SHAP for every customer (~10 s, idempotent)
uvicorn app.api:app --reload            # http://localhost:8000/docs
pytest
```

PostgreSQL uses host port **5433** so it does not clash with a locally installed PostgreSQL on 5432.
Credentials in `.env.example` are development-only.

## Model

Trained on the 7,043-customer Telco dataset with an 80/20 stratified split. Candidates are compared
by 5-fold CV PR-AUC on the training part; the decision threshold maximises F1 on out-of-fold
predictions; the test set is used once. The deployed model is the tuned XGBoost (40 Optuna trials).

| Model | CV PR-AUC | Test ROC-AUC | Test PR-AUC | Test F1 | Test recall |
|---|---|---|---|---|---|
| Logistic regression (baseline) | 0.657 | 0.842 | 0.633 | 0.618 | 0.725 |
| XGBoost, default | 0.629 | 0.822 | 0.616 | 0.612 | 0.706 |
| **XGBoost, tuned (deployed)** | **0.670** | **0.849** | **0.666** | **0.636** | **0.727** |

These are typical numbers for this dataset: the tuned model is a modest improvement over the
logistic-regression baseline, not a large one. Full metrics, parameters and library versions are in
`models/metadata.json` (also served at `GET /api/model`).

The model is trained on the 19 raw customer attributes, so SHAP and LIME explain exactly the fields a
user fills in on the prediction form.

## Explainability

| | SHAP | LIME |
|---|---|---|
| Unit of the contribution | log-odds (additive: `base + sum = model log-odds`) | change in churn probability (local linear fit) |
| Scope | exact for tree models | approximate, sampled around the customer |
| Reproducible | yes | yes (re-seeded per call, so cached answers equal recomputed ones) |

SHAP values are summed from the one-hot columns back to the original features. The SHAP base value is
read from XGBoost, because `shap`'s own `expected_value` is off by ~0.004 log-odds with XGBoost 3.x.
In practice both methods take only tens of milliseconds per customer here.

## Caching (Redis)

- Key = `churn:predict:<model version>:<hash of the normalised inputs>`: identical inputs hit the
  cache whether they come from the form or from a stored customer; retraining changes the version
  and invalidates everything. TTL 24 h, 128 MB, LRU eviction.
- Concurrent identical requests share one computation (short lock).
- `/api/stats/overview` is cached for 60 s and cleared by `ingest`.
- **Redis is optional**: if it is down, requests are computed directly (`/api/health` reports
  `"cache": "down"`), and Redis is skipped for 10 s to avoid repeated connect timeouts.
- PostgreSQL is the durable record: every prediction and its explanations are stored; Redis only
  accelerates repeats.

## Layout

```
app/            FastAPI app (api.py) and Pydantic schemas
src/db/         SQLAlchemy models (customers, predictions, explanations[JSONB]), session
src/data/       load -> preprocess -> identity (username + avatar seed) -> ingest
src/features/   model input definition and display labels
src/models/     train, evaluate, predict (artefact loading), service (cache + DB), precompute
src/explain/    SHAP and LIME explainers
src/utils/      config, Redis cache helper
frontend/       vanilla HTML/CSS/JS; mounted at / automatically once index.html exists
tests/          pytest (DB / model / Redis tests skip if their service is not available)
```

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | database, cache and model status |
| GET | `/api/model` | model version, threshold, metrics, category lists (for building the form) |
| GET | `/api/customers` | `limit`, `offset`, `search` (username), `contract`, `churn` |
| GET | `/api/customers/{id}` | one profile |
| GET | `/api/customers/{id}/explanation` | stored score + SHAP + LIME (LIME computed on first view) |
| GET | `/api/stats/overview` | totals, churn rate, churn by contract (cached 60 s) |
| POST | `/api/predict` | form input -> churn label, probability, SHAP and LIME |

Interactive docs at `/docs`. Without a trained model the prediction endpoints return 503.

## Design notes

- **Avatars are never stored.** Each customer has a deterministic `avatar_seed`; the front end renders
  the image from it, so the same customer always gets the same face. Usernames are pseudonyms derived
  from a hash of the original `customerID`.
- **Customer scores are in-sample**: the stored customers were part of the model's training data, so
  their probabilities are optimistic compared with genuinely new customers.
- Every `/api/predict` call is logged as a prediction row (no customer attached), including cache hits.
- Tables are created with `create_all`; switch to Alembic once the schema starts changing.
