"""Pydantic response / request models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from src.models.risk import Risk

ThreeState = Literal["Yes", "No", "No internet service"]


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    avatar_seed: str
    gender: str
    senior_citizen: bool
    partner: bool
    dependents: bool
    tenure: int
    phone_service: bool
    multiple_lines: str
    internet_service: str
    online_security: str
    online_backup: str
    device_protection: str
    tech_support: str
    streaming_tv: str
    streaming_movies: str
    contract: str
    paperless_billing: bool
    payment_method: str
    monthly_charges: float
    total_charges: float
    churn: bool  # observed outcome in the dataset (not a prediction)
    # Latest model prediction for the active model version (None if the model/scores are unavailable)
    churn_probability: float | None = None
    risk: Risk | None = None


class CustomerPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[CustomerOut]


class ContractStat(BaseModel):
    contract: str
    customers: int
    churn_rate: float


class RiskBandStat(BaseModel):
    band: Risk
    customers: int
    avg_probability: float
    observed_churn_rate: float  # in-sample: these customers were in the training data


class HistogramBin(BaseModel):
    lower: float
    upper: float
    customers: int


class Segment(BaseModel):
    dimension: Literal["contract", "internet_service", "tenure"]
    value: str
    customers: int
    avg_probability: float
    observed_churn_rate: float
    high_risk_share: float


class RiskThresholds(BaseModel):
    low_max: float
    high_min: float
    decision_threshold: float  # the model's churn / no-churn cut-off (F1-optimal), not a risk band


class Overview(BaseModel):
    customers: int
    churned: int  # observed in the dataset
    churn_rate: float  # observed
    avg_monthly_charges: float
    by_contract: list[ContractStat]
    # Model-based fields: None / empty when no model or no scores are available
    model_version: str | None = None
    avg_probability: float | None = None
    high_risk_customers: int | None = None
    risk_thresholds: RiskThresholds | None = None
    risk_distribution: list[RiskBandStat] = []
    probability_histogram: list[HistogramBin] = []
    segments: list[Segment] = []


class RecentPrediction(BaseModel):
    id: int
    created_at: datetime
    probability: float
    churn: bool
    risk: Risk
    model_version: str
    # Subset of the submitted attributes, for display
    contract: str | None = None
    tenure: int | None = None
    monthly_charges: float | None = None
    internet_service: str | None = None


class PredictionInput(BaseModel):
    """Everything the 'enter parameters' form sends. Mirrors the customers table."""

    gender: Literal["Female", "Male"]
    senior_citizen: bool
    partner: bool
    dependents: bool
    tenure: int = Field(ge=0, le=100)
    phone_service: bool
    multiple_lines: Literal["Yes", "No", "No phone service"]
    internet_service: Literal["DSL", "Fiber optic", "No"]
    online_security: ThreeState
    online_backup: ThreeState
    device_protection: ThreeState
    tech_support: ThreeState
    streaming_tv: ThreeState
    streaming_movies: ThreeState
    contract: Literal["Month-to-month", "One year", "Two year"]
    paperless_billing: bool
    payment_method: Literal[
        "Electronic check",
        "Mailed check",
        "Bank transfer (automatic)",
        "Credit card (automatic)",
    ]
    monthly_charges: float = Field(ge=0, le=1000)
    total_charges: float = Field(ge=0, le=100000)


class FeatureContribution(BaseModel):
    feature: str  # snake_case key
    label: str  # display name
    value: str | float | int | None  # the customer's value for this feature
    contribution: float  # positive pushes towards churn (SHAP: log-odds, LIME: probability)
    rule: str | None = None  # LIME only, e.g. "Tenure (months) <= 9.00"


class ExplanationOut(BaseModel):
    method: Literal["shap", "lime"]
    base_value: float | None  # SHAP: log-odds baseline; LIME: surrogate intercept
    values: list[FeatureContribution]


class PredictionOut(BaseModel):
    prediction_id: int
    churn: bool
    probability: float
    risk: Risk
    threshold: float
    model_version: str
    predicted_at: datetime  # when this prediction was stored
    cached: bool  # served from Redis (form) or already stored in PostgreSQL (customer)
    explanations: list[ExplanationOut]
