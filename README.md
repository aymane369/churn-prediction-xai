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

Docker Desktop. For local development outside Docker: Python **3.12**.

## Quick start (everything in containers)

Put the Telco CSV at `data/raw/Telco-Customer-Churn.csv` (see `data/README.md`), then:

```bash
cp .env.example .env
docker compose up -d --build
```

> **Keep the repository path ASCII-only.** On Windows, building several images from a folder whose
> path contains accented characters (e.g. `Prédiction`) fails with
> `x-docker-expose-session-sharedkey ... non-printable ASCII characters`. This is a Docker BuildKit
> limitation, not a project bug; `COMPOSE_BAKE=false` does not help. If you cannot rename the folder,
> build one image per command (`docker compose build backend`, `docker compose build frontend`)
> and then run `docker compose up -d`.

Open **http://localhost:8080** (API docs at `/docs`, API under `/api`). The first start takes a few
minutes: the `init` job loads the customers, trains the model (~2 min) and scores everyone. Later
starts take seconds, because training is skipped when the model already exists in its volume.

```
browser --> frontend (nginx :8080) --/api--> backend (FastAPI :8000) --> db (PostgreSQL)
                                                                    \-> redis (cache)
            init (one-shot: ingest -> train if no model -> precompute), backend waits for it
```

| Service | Image | Notes |
|---|---|---|
| `frontend` | nginx (unprivileged) | serves `frontend/`, proxies `/api`, `/docs` to the backend; same origin, so no CORS |
| `backend` | python:3.12-slim | FastAPI/uvicorn, non-root, healthcheck on `/api/health` |
| `init` | same as backend | `python -m src.bootstrap`; restarts are cheap, safe to re-run. Trains inside the container, so its model differs slightly from one trained on another OS |
| `db` | postgres:17 | volume `pgdata` |
| `redis` | redis:7-alpine | 128 MB, LRU, no persistence |

Useful commands:

```bash
docker compose logs -f backend            # follow the API logs
docker compose run --rm init              # re-run the setup job by hand (it also runs on every `up`)
docker compose exec backend python -m src.models.train   # retrain (restart backend afterwards)
docker compose restart backend            # pick up a newly trained model
docker compose down                       # stop (data kept); add -v to also delete the DB and model volumes
```

- The model lives in the `models` volume and the data in `pgdata`; the images contain only code.
  The Compose project is named `churn-xai` in `docker-compose.yml`, so the volumes are
  `churn-xai_models` / `churn-xai_pgdata` whatever the folder is called (without a fixed name,
  renaming the folder would silently start over with empty volumes).
- Package versions in the image are pinned by `constraints.txt` (the versions the tests ran on).
- `docker-compose.override.yml` is applied automatically and adds dev conveniences: DB on host port
  **5433**, Redis on **6379**, and `frontend/` mounted live (edit and refresh, no rebuild). For a
  production-like run without it: `docker compose -f docker-compose.yml up -d` (after building).
  Those published ports are bound to `127.0.0.1` only: the database and the password-less Redis are
  not reachable from other machines.
- Credentials in `.env.example` are development-only.

## Local development without Docker

```bash
docker compose up -d --wait db redis    # only the data services (ports published by the override)
py -3.12 -m venv .venv && .venv/Scripts/activate   # Windows; use .venv/bin/activate elsewhere
pip install -r requirements-ml.txt
python -m src.bootstrap                 # ingest + train (if needed) + precompute
uvicorn app.api:app --reload            # http://127.0.0.1:8000/docs
pytest
```

Use `127.0.0.1` rather than `localhost` (as `.env.example` does): on Windows `localhost` tries IPv6
first, which adds ~0.2 s per request and makes connections to the loopback-only database ports very slow.

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
  `"cache": "down"`). Once an outage is detected, requests skip Redis instantly and a background
  thread probes for its return. Only the one request that first notices the outage can be slow (up to
  ~4 s in Docker, where a stopped container's hostname takes that long to fail to resolve).
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
