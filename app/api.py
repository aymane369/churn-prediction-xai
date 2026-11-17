"""FastAPI application.  Run from the project root:  uvicorn app.api:app --reload"""

from fastapi import Depends, FastAPI, HTTPException, Query
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
from src.db.models import Customer
from src.db.session import get_session
from src.utils.config import settings

app = FastAPI(title="Churn Prediction XAI", version="0.1.0")


@app.get("/api/health")
def health(db: Session = Depends(get_session)) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "up"}


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


@app.get("/api/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_session)) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")
    return customer


@app.get("/api/stats/overview", response_model=Overview)
def overview(db: Session = Depends(get_session)) -> Overview:
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
    )


# --- Model-dependent endpoints: stubs until the model and explainers are trained (Phase 2) ---


@app.post("/api/predict", response_model=PredictionOut)
def predict(payload: PredictionInput) -> PredictionOut:
    raise HTTPException(501, "Model not trained yet")


@app.get("/api/customers/{customer_id}/explanation", response_model=list[ExplanationOut])
def customer_explanation(customer_id: int) -> list[ExplanationOut]:
    raise HTTPException(501, "Explainers not available yet")


# --- Front end: served only once it exists, so the API works without it ---

if (settings.frontend_dir / "index.html").exists():
    app.mount("/", StaticFiles(directory=settings.frontend_dir, html=True), name="frontend")
