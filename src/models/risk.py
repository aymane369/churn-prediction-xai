"""Risk bands over the (calibrated) churn probability.

Defined once here; the front end only displays them. They are business-rule bands, separate from
the model's F1-optimal decision threshold (metadata `threshold`, used for the churn / no-churn label).
On the training data they separate well: observed churn is ~6% / ~33% / ~70% in low / medium / high.
"""

from typing import Literal

Risk = Literal["low", "medium", "high"]

LOW_MAX = 0.20   # probability below this is "low"
HIGH_MIN = 0.50  # probability at or above this is "high"


def risk_band(probability: float) -> Risk:
    if probability < LOW_MAX:
        return "low"
    if probability >= HIGH_MIN:
        return "high"
    return "medium"
