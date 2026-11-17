"""Shared helpers for turning per-feature contributions into the JSON shape the API returns."""

import pandas as pd

from src.features.build_features import BOOLEAN, FEATURES, LABELS, NUMERIC


def display_value(feature: str, value):
    if feature in BOOLEAN:
        return "Yes" if int(value) else "No"
    if feature == "tenure":
        return int(value)
    if feature in NUMERIC:
        return round(float(value), 2)
    return str(value)


def contribution_list(row: pd.Series, contributions, rules: dict[str, str] | None = None) -> list[dict]:
    """One entry per feature, sorted by absolute contribution (largest first)."""
    items = []
    for feature, contribution in zip(FEATURES, contributions):
        item = {
            "feature": feature,
            "label": LABELS[feature],
            "value": display_value(feature, row[feature]),
            "contribution": float(contribution),
        }
        if rules and feature in rules:
            item["rule"] = rules[feature]
        items.append(item)
    return sorted(items, key=lambda d: abs(d["contribution"]), reverse=True)
