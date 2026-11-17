"""Model input definition.

The model is trained directly on the raw customer attributes (no derived features), so SHAP and
LIME explain exactly the same set of features a user fills in on the prediction form.
"""

import pandas as pd

CATEGORICAL = [
    "gender",
    "multiple_lines",
    "internet_service",
    "online_security",
    "online_backup",
    "device_protection",
    "tech_support",
    "streaming_tv",
    "streaming_movies",
    "contract",
    "payment_method",
]
BOOLEAN = ["senior_citizen", "partner", "dependents", "phone_service", "paperless_billing"]
NUMERIC = ["tenure", "monthly_charges", "total_charges"]
FEATURES = CATEGORICAL + BOOLEAN + NUMERIC
TARGET = "churn"

# Human-readable names for the UI
LABELS = {
    "gender": "Gender",
    "multiple_lines": "Multiple lines",
    "internet_service": "Internet service",
    "online_security": "Online security",
    "online_backup": "Online backup",
    "device_protection": "Device protection",
    "tech_support": "Tech support",
    "streaming_tv": "Streaming TV",
    "streaming_movies": "Streaming movies",
    "contract": "Contract",
    "payment_method": "Payment method",
    "senior_citizen": "Senior citizen",
    "partner": "Partner",
    "dependents": "Dependents",
    "phone_service": "Phone service",
    "paperless_billing": "Paperless billing",
    "tenure": "Tenure (months)",
    "monthly_charges": "Monthly charges",
    "total_charges": "Total charges",
}


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Select the model columns in a fixed order and normalise dtypes (booleans -> 0/1)."""
    missing = [c for c in FEATURES if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")
    X = df[FEATURES].copy()
    X[BOOLEAN] = X[BOOLEAN].astype(int)
    X[NUMERIC] = X[NUMERIC].astype(float)
    return X.reset_index(drop=True)
