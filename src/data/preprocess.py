"""Clean the raw Telco data into the shape stored in the `customers` table."""

import pandas as pd

COLUMN_MAP = {
    "customerID": "source_id",
    "gender": "gender",
    "SeniorCitizen": "senior_citizen",
    "Partner": "partner",
    "Dependents": "dependents",
    "tenure": "tenure",
    "PhoneService": "phone_service",
    "MultipleLines": "multiple_lines",
    "InternetService": "internet_service",
    "OnlineSecurity": "online_security",
    "OnlineBackup": "online_backup",
    "DeviceProtection": "device_protection",
    "TechSupport": "tech_support",
    "StreamingTV": "streaming_tv",
    "StreamingMovies": "streaming_movies",
    "Contract": "contract",
    "PaperlessBilling": "paperless_billing",
    "PaymentMethod": "payment_method",
    "MonthlyCharges": "monthly_charges",
    "TotalCharges": "total_charges",
    "Churn": "churn",
}

YES_NO_COLUMNS = ["partner", "dependents", "phone_service", "paperless_billing", "churn"]


def clean(raw: pd.DataFrame) -> pd.DataFrame:
    missing = set(COLUMN_MAP) - set(raw.columns)
    if missing:
        raise ValueError(f"Raw data is missing columns: {sorted(missing)}")

    df = raw[list(COLUMN_MAP)].rename(columns=COLUMN_MAP).copy()
    df = df.drop_duplicates(subset="source_id")

    for col in df.select_dtypes(include=["object", "string"]).columns:
        df[col] = df[col].str.strip()

    # The 11 blank TotalCharges rows are brand-new customers (tenure == 0): nothing billed yet.
    df["total_charges"] = pd.to_numeric(df["total_charges"], errors="coerce")
    blank_total = df["total_charges"].isna()
    if (df.loc[blank_total, "tenure"] != 0).any():
        raise ValueError("Blank TotalCharges for a customer with tenure > 0; check the data.")
    df.loc[blank_total, "total_charges"] = 0.0

    df["senior_citizen"] = df["senior_citizen"].astype(bool)
    for col in YES_NO_COLUMNS:
        df[col] = df[col].map({"Yes": True, "No": False})
        if df[col].isna().any():
            raise ValueError(f"Unexpected values in {col}")

    return df.reset_index(drop=True)
