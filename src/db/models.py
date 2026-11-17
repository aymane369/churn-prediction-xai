"""Database schema.

customers     cleaned Telco data + pseudonym (username) + avatar seed
predictions   every model prediction, for an existing customer or a form submission
explanations  SHAP / LIME output for a prediction, stored as JSONB
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[str] = mapped_column(String(20), unique=True)  # original customerID
    username: Mapped[str] = mapped_column(String(40), unique=True)  # pseudonym shown in the UI
    avatar_seed: Mapped[str] = mapped_column(String(32))  # deterministic seed for the avatar

    gender: Mapped[str] = mapped_column(String(10))
    senior_citizen: Mapped[bool] = mapped_column(Boolean)
    partner: Mapped[bool] = mapped_column(Boolean)
    dependents: Mapped[bool] = mapped_column(Boolean)
    tenure: Mapped[int] = mapped_column(Integer)  # months

    phone_service: Mapped[bool] = mapped_column(Boolean)
    multiple_lines: Mapped[str] = mapped_column(String(20))
    internet_service: Mapped[str] = mapped_column(String(20))
    online_security: Mapped[str] = mapped_column(String(25))
    online_backup: Mapped[str] = mapped_column(String(25))
    device_protection: Mapped[str] = mapped_column(String(25))
    tech_support: Mapped[str] = mapped_column(String(25))
    streaming_tv: Mapped[str] = mapped_column(String(25))
    streaming_movies: Mapped[str] = mapped_column(String(25))

    contract: Mapped[str] = mapped_column(String(20))
    paperless_billing: Mapped[bool] = mapped_column(Boolean)
    payment_method: Mapped[str] = mapped_column(String(30))
    monthly_charges: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    total_charges: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    churn: Mapped[bool] = mapped_column(Boolean)  # ground truth from the dataset

    predictions: Mapped[list["Prediction"]] = relationship(back_populates="customer")

    __table_args__ = (
        CheckConstraint("tenure >= 0", name="ck_customers_tenure_nonneg"),
        Index("ix_customers_contract", "contract"),
        Index("ix_customers_churn", "churn"),
    )


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # NULL when the input came from the "enter parameters" form
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    input: Mapped[dict] = mapped_column(JSONB)
    probability: Mapped[float] = mapped_column()
    label: Mapped[bool] = mapped_column(Boolean)
    model_version: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    customer: Mapped[Customer | None] = relationship(back_populates="predictions")
    explanations: Mapped[list["Explanation"]] = relationship(
        back_populates="prediction", cascade="all, delete-orphan"
    )


class Explanation(Base):
    __tablename__ = "explanations"

    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[int] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE"), index=True
    )
    method: Mapped[str] = mapped_column(String(10))  # 'shap' | 'lime'
    base_value: Mapped[float | None] = mapped_column()
    # [{"feature": "Contract", "value": "Month-to-month", "contribution": 0.31}, ...]
    values: Mapped[list] = mapped_column(JSONB)

    prediction: Mapped[Prediction] = relationship(back_populates="explanations")

    __table_args__ = (
        UniqueConstraint("prediction_id", "method", name="uq_explanation_prediction_method"),
        CheckConstraint("method IN ('shap', 'lime')", name="ck_explanation_method"),
    )
