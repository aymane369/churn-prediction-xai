"""Pydantic response / request models."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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
    churn: bool


class CustomerPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[CustomerOut]


class ContractStat(BaseModel):
    contract: str
    customers: int
    churn_rate: float


class Overview(BaseModel):
    customers: int
    churned: int
    churn_rate: float
    avg_monthly_charges: float
    by_contract: list[ContractStat]


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
    threshold: float
    model_version: str
    cached: bool  # served from Redis (form) or already stored in PostgreSQL (customer)
    explanations: list[ExplanationOut]
