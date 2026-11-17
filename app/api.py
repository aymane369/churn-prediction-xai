"""FastAPI application.  Run from the project root:  uvicorn app.api:app --reload"""

import logging
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import and_, case, func, null, select, text
from sqlalchemy.orm import Session

from app.schemas import (
    ContractStat,
    CustomerOut,
    CustomerPage,
    ExplanationOut,
    HistogramBin,
    Overview,
    PredictionInput,
    PredictionOut,
    RecentPrediction,
    RiskBandStat,
    RiskThresholds,
    Segment,
)
from src.db.models import Customer, Prediction
from src.db.session import get_session
from src.models.predict import ModelNotAvailable, load_bundle
from src.models.risk import HIGH_MIN, LOW_MAX, Risk, risk_band
from src.models.service import customer_prediction, save_form_prediction, score_and_explain, warm_up
from src.utils import cache

log = logging.getLogger("churn.api")

STATS_TTL = 60  # seconds


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        warm_up()  # load model + build explainers once, not on the first request
    except ModelNotAvailable as exc:
        log.warning("%s Prediction endpoints will return 503.", exc)
    yield


app = FastAPI(title="Churn Prediction XAI", version="0.3.0", lifespan=lifespan)


@app.exception_handler(ModelNotAvailable)
def model_missing(_: Request, exc: ModelNotAvailable) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=503)


@app.get("/api/health")
def health(db: Session = Depends(get_session)) -> dict:
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "up",
        "cache": "up" if cache.ping() else "down",  # the app works without it, just slower
        "model": _current_version(),
    }


@app.get("/api/model")
def model_info() -> dict:
    """Metadata of the deployed model: version, threshold, metrics, feature categories."""
    return load_bundle().metadata


# --- Scores: the latest stored prediction per customer for the active model version ---


def _current_version() -> str | None:
    try:
        return load_bundle().version
    except ModelNotAvailable:
        return None


def _scores_subquery(version: str):
    """One row per customer: (cid, p) = latest stored probability for this model version."""
    return (
        select(Prediction.customer_id.label("cid"), Prediction.probability.label("p"))
        .where(Prediction.model_version == version, Prediction.customer_id.is_not(None))
        .distinct(Prediction.customer_id)
        .order_by(Prediction.customer_id, Prediction.id.desc())
        .subquery("scores")
    )


SortKey = Literal["id", "risk_desc", "risk_asc", "tenure_desc", "tenure_asc", "charges_desc"]


@app.get("/api/customers", response_model=CustomerPage)
def list_customers(
    db: Session = Depends(get_session),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None, description="Matches the username"),
    contract: str | None = None,
    internet_service: str | None = None,
    churn: bool | None = Query(None, description="Observed outcome in the dataset"),
    risk: Risk | None = Query(None, description="Risk band of the latest prediction"),
    tenure_min: int | None = Query(None, ge=0, description="Minimum tenure in months (inclusive)"),
    tenure_max: int | None = Query(None, ge=0, description="Maximum tenure in months (inclusive)"),
    sort: SortKey = "id",
) -> CustomerPage:
    version = _current_version()
    scores = _scores_subquery(version) if version else None
    if (risk or sort.startswith("risk")) and scores is None:
        raise ModelNotAvailable("No trained model found; run `python -m src.models.train`.")

    p = scores.c.p if scores is not None else null()
    stmt = select(Customer, p.label("p"))
    count_stmt = select(func.count()).select_from(Customer)
    if scores is not None:
        stmt = stmt.outerjoin(scores, scores.c.cid == Customer.id)
        count_stmt = count_stmt.outerjoin(scores, scores.c.cid == Customer.id)

    filters = []
    if search:
        filters.append(Customer.username.ilike(f"%{search}%"))
    if contract:
        filters.append(Customer.contract == contract)
    if internet_service:
        filters.append(Customer.internet_service == internet_service)
    if churn is not None:
        filters.append(Customer.churn == churn)
    if tenure_min is not None:
        filters.append(Customer.tenure >= tenure_min)
    if tenure_max is not None:
        filters.append(Customer.tenure <= tenure_max)
    if risk == "low":
        filters.append(p < LOW_MAX)
    elif risk == "medium":
        filters.append(and_(p >= LOW_MAX, p < HIGH_MIN))
    elif risk == "high":
        filters.append(p >= HIGH_MIN)

    order = {
        "id": [Customer.id],
        "risk_desc": [p.desc().nulls_last(), Customer.id],
        "risk_asc": [p.asc().nulls_last(), Customer.id],
        "tenure_desc": [Customer.tenure.desc(), Customer.id],
        "tenure_asc": [Customer.tenure.asc(), Customer.id],
        "charges_desc": [Customer.monthly_charges.desc(), Customer.id],
    }[sort]

    total = db.scalar(count_stmt.where(*filters))
    rows = db.execute(stmt.where(*filters).order_by(*order).limit(limit).offset(offset)).all()
    return CustomerPage(total=total, limit=limit, offset=offset, items=[_with_score(c, prob) for c, prob in rows])


def _with_score(customer: Customer, probability: float | None) -> CustomerOut:
    out = CustomerOut.model_validate(customer)
    if probability is not None:
        out.churn_probability = float(probability)
        out.risk = risk_band(float(probability))
    return out


def _get_customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")
    return customer


@app.get("/api/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_session)) -> CustomerOut:
    customer = _get_customer_or_404(db, customer_id)
    version = _current_version()
    prob = None
    if version:
        prob = db.scalar(
            select(Prediction.probability)
            .where(Prediction.customer_id == customer_id, Prediction.model_version == version)
            .order_by(Prediction.id.desc())
            .limit(1)
        )
    return _with_score(customer, prob)


# --- Dashboard statistics ---

TENURE_BANDS = [(0, 12, "0-12 months"), (13, 24, "13-24 months"), (25, 48, "25-48 months"), (49, 10**6, "49+ months")]


def _segment(dimension: str, value: str, rows: list[tuple[float, bool]]) -> Segment:
    n = len(rows)
    return Segment(
        dimension=dimension,
        value=value,
        customers=n,
        avg_probability=sum(p for p, _ in rows) / n,
        observed_churn_rate=sum(1 for _, c in rows if c) / n,
        high_risk_share=sum(1 for p, _ in rows if p >= HIGH_MIN) / n,
    )


def _compute_overview(db: Session, version: str | None) -> dict:
    churn_int = case((Customer.churn, 1), else_=0)
    customers, churned, avg_monthly = db.execute(
        select(func.count(), func.sum(churn_int), func.avg(Customer.monthly_charges))
    ).one()
    by_contract = db.execute(
        select(Customer.contract, func.count(), func.avg(churn_int))
        .group_by(Customer.contract)
        .order_by(Customer.contract)
    ).all()
    overview = Overview(
        customers=customers,
        churned=int(churned or 0),
        churn_rate=float(churned or 0) / customers if customers else 0.0,
        avg_monthly_charges=float(avg_monthly or 0),
        by_contract=[ContractStat(contract=c, customers=n, churn_rate=float(r)) for c, n, r in by_contract],
    )

    if version:
        scores = _scores_subquery(version)
        rows = db.execute(
            select(scores.c.p, Customer.churn, Customer.contract, Customer.internet_service, Customer.tenure)
            .join(Customer, Customer.id == scores.c.cid)
        ).all()
        if rows:
            overview.model_version = version
            overview.avg_probability = sum(r.p for r in rows) / len(rows)
            overview.high_risk_customers = sum(1 for r in rows if r.p >= HIGH_MIN)
            overview.risk_thresholds = RiskThresholds(
                low_max=LOW_MAX, high_min=HIGH_MIN, decision_threshold=load_bundle().threshold
            )

            bands: dict[str, list[tuple[float, bool]]] = defaultdict(list)
            for r in rows:
                bands[risk_band(r.p)].append((r.p, r.churn))
            overview.risk_distribution = [
                RiskBandStat(
                    band=b,
                    customers=len(bands[b]),
                    avg_probability=sum(p for p, _ in bands[b]) / len(bands[b]),
                    observed_churn_rate=sum(1 for _, c in bands[b] if c) / len(bands[b]),
                )
                for b in ("low", "medium", "high")
                if bands[b]
            ]

            counts = [0] * 10
            for r in rows:
                counts[min(int(r.p * 10), 9)] += 1
            overview.probability_histogram = [
                HistogramBin(lower=i / 10, upper=(i + 1) / 10, customers=n) for i, n in enumerate(counts)
            ]

            groups: dict[tuple[str, str], list[tuple[float, bool]]] = defaultdict(list)
            for r in rows:
                groups[("contract", r.contract)].append((r.p, r.churn))
                groups[("internet_service", r.internet_service)].append((r.p, r.churn))
                band = next(label for lo, hi, label in TENURE_BANDS if lo <= r.tenure <= hi)
                groups[("tenure", band)].append((r.p, r.churn))
            order = {"contract": 0, "internet_service": 1, "tenure": 2}
            overview.segments = [
                _segment(dim, val, g) for (dim, val), g in sorted(groups.items(), key=lambda kv: (order[kv[0][0]], kv[0][1]))
            ]
    return overview.model_dump()


@app.get("/api/stats/overview", response_model=Overview)
def overview(db: Session = Depends(get_session)) -> dict:
    version = _current_version()
    value, _ = cache.get_or_compute(
        f"churn:stats:overview:{version}", lambda: _compute_overview(db, version), ttl=STATS_TTL
    )
    return value


@app.get("/api/predictions/recent", response_model=list[RecentPrediction])
def recent_predictions(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_session)) -> list[RecentPrediction]:
    """Latest predictions made from the form / what-if simulator (not attached to a stored customer).

    Stored customers' scores are computed in a batch, so they are not 'activity' and are excluded.
    """
    rows = db.scalars(
        select(Prediction)
        .where(Prediction.customer_id.is_(None))
        .order_by(Prediction.created_at.desc(), Prediction.id.desc())
        .limit(limit)
    ).all()
    return [
        RecentPrediction(
            id=r.id,
            created_at=r.created_at,
            probability=r.probability,
            churn=r.label,
            risk=risk_band(r.probability),
            model_version=r.model_version,
            contract=r.input.get("contract"),
            tenure=r.input.get("tenure"),
            monthly_charges=r.input.get("monthly_charges"),
            internet_service=r.input.get("internet_service"),
        )
        for r in rows
    ]


# --- Predictions and explanations ---


def _to_out(pred: Prediction, cached: bool) -> PredictionOut:
    bundle = load_bundle()
    return PredictionOut(
        prediction_id=pred.id,
        churn=pred.label,
        probability=pred.probability,
        risk=risk_band(pred.probability),
        threshold=bundle.threshold,
        model_version=pred.model_version,
        predicted_at=pred.created_at,
        cached=cached,
        explanations=[
            ExplanationOut(method=e.method, base_value=e.base_value, values=e.values)
            for e in sorted(pred.explanations, key=lambda e: e.method)
        ],
    )


@app.post("/api/predict", response_model=PredictionOut)
def predict(payload: PredictionInput, db: Session = Depends(get_session)) -> PredictionOut:
    """Score a customer described by the form: label, probability, SHAP and LIME."""
    result, cached = score_and_explain(payload.model_dump())
    pred = save_form_prediction(db, payload.model_dump(), result)
    return _to_out(pred, cached)


@app.get("/api/customers/{customer_id}/explanation", response_model=PredictionOut)
def customer_explanation(customer_id: int, db: Session = Depends(get_session)) -> PredictionOut:
    """Stored score and explanations for an existing customer (computed on first request).

    Note: these customers were part of the model's training data, so their scores are in-sample.
    """
    customer = _get_customer_or_404(db, customer_id)
    pred, stored = customer_prediction(db, customer)
    return _to_out(pred, stored)


# The front end is NOT served from here: nginx (docker/nginx.conf) serves the built single-page app,
# with the client-side-routing fallback, and proxies /api to this service.
