"""FastAPI application.  Run from the project root:  uvicorn app.api:app --reload"""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import case, func, select, text
from sqlalchemy.orm import Session

from app.schemas import (
    ContractStat,
    CustomerOut,
    CustomerPage,
    ExplanationOut,
    Overview,
    PredictionInput,
    PredictionOut,
)
from src.db.models import Customer, Prediction
from src.db.session import get_session
from src.models.predict import ModelNotAvailable, load_bundle
from src.models.service import customer_prediction, save_form_prediction, score_and_explain, warm_up
from src.utils import cache
from src.utils.config import settings

log = logging.getLogger("churn.api")

STATS_TTL = 60  # seconds


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        warm_up()  # load model + build explainers once, not on the first request
    except ModelNotAvailable as exc:
        log.warning("%s Prediction endpoints will return 503.", exc)
    yield


app = FastAPI(title="Churn Prediction XAI", version="0.2.0", lifespan=lifespan)


@app.exception_handler(ModelNotAvailable)
def model_missing(_: Request, exc: ModelNotAvailable) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=503)


@app.get("/api/health")
def health(db: Session = Depends(get_session)) -> dict:
    db.execute(text("SELECT 1"))
    try:
        model = load_bundle().version
    except ModelNotAvailable:
        model = None
    return {
        "status": "ok",
        "database": "up",
        "cache": "up" if cache.ping() else "down",  # the app works without it, just slower
        "model": model,
    }


@app.get("/api/model")
def model_info() -> dict:
    """Metadata of the deployed model: version, threshold, metrics, feature categories."""
    return load_bundle().metadata


@app.get("/api/customers", response_model=CustomerPage)
def list_customers(
    db: Session = Depends(get_session),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None, description="Matches the username"),
    contract: str | None = None,
    churn: bool | None = None,
) -> CustomerPage:
    filters = []
    if search:
        filters.append(Customer.username.ilike(f"%{search}%"))
    if contract:
        filters.append(Customer.contract == contract)
    if churn is not None:
        filters.append(Customer.churn == churn)

    total = db.scalar(select(func.count()).select_from(Customer).where(*filters))
    rows = db.scalars(
        select(Customer).where(*filters).order_by(Customer.id).limit(limit).offset(offset)
    ).all()
    return CustomerPage(total=total, limit=limit, offset=offset, items=rows)


def _get_customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")
    return customer


@app.get("/api/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_session)) -> Customer:
    return _get_customer_or_404(db, customer_id)


def _compute_overview(db: Session) -> dict:
    churn_int = case((Customer.churn, 1), else_=0)
    customers, churned, avg_monthly = db.execute(
        select(func.count(), func.sum(churn_int), func.avg(Customer.monthly_charges))
    ).one()
    by_contract = db.execute(
        select(Customer.contract, func.count(), func.avg(churn_int))
        .group_by(Customer.contract)
        .order_by(Customer.contract)
    ).all()
    return Overview(
        customers=customers,
        churned=int(churned or 0),
        churn_rate=float(churned or 0) / customers if customers else 0.0,
        avg_monthly_charges=float(avg_monthly or 0),
        by_contract=[
            ContractStat(contract=c, customers=n, churn_rate=float(r)) for c, n, r in by_contract
        ],
    ).model_dump()


@app.get("/api/stats/overview", response_model=Overview)
def overview(db: Session = Depends(get_session)) -> dict:
    value, _ = cache.get_or_compute("churn:stats:overview", lambda: _compute_overview(db), ttl=STATS_TTL)
    return value


def _to_out(pred: Prediction, cached: bool) -> PredictionOut:
    bundle = load_bundle()
    return PredictionOut(
        prediction_id=pred.id,
        churn=pred.label,
        probability=pred.probability,
        threshold=bundle.threshold,
        model_version=pred.model_version,
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


# --- Front end: served only once it exists, so the API works without it ---

if (settings.frontend_dir / "index.html").exists():
    app.mount("/", StaticFiles(directory=settings.frontend_dir, html=True), name="frontend")
