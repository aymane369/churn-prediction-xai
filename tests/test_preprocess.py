import pandas as pd
import pytest

from src.data.identity import assign_identities, username_for
from src.data.load import load_raw
from src.data.preprocess import clean


@pytest.fixture(scope="module")
def cleaned() -> pd.DataFrame:
    return clean(load_raw())


def test_row_count_and_unique_ids(cleaned):
    assert len(cleaned) == 7043
    assert cleaned["source_id"].is_unique


def test_total_charges_is_numeric_without_nulls(cleaned):
    assert pd.api.types.is_float_dtype(cleaned["total_charges"])
    assert not cleaned["total_charges"].isna().any()
    # the 11 blank rows are tenure-0 customers
    assert (cleaned.loc[cleaned["tenure"] == 0, "total_charges"] == 0).all()


def test_yes_no_columns_are_boolean(cleaned):
    for col in ["partner", "dependents", "phone_service", "paperless_billing", "churn", "senior_citizen"]:
        assert cleaned[col].dtype == bool


def test_churn_rate_matches_known_value(cleaned):
    assert cleaned["churn"].mean() == pytest.approx(0.2654, abs=0.001)


def test_clean_rejects_missing_columns():
    with pytest.raises(ValueError):
        clean(pd.DataFrame({"customerID": ["x"]}))


def test_identities_are_deterministic_and_unique(cleaned):
    ids = list(cleaned["source_id"])
    first = assign_identities(ids)
    second = assign_identities(ids)
    assert first == second
    usernames = [name for name, _ in first.values()]
    assert len(set(usernames)) == len(ids)


def test_username_format():
    name = username_for("7590-VHVEG")
    adjective, animal, number = name.split("_")
    assert adjective.isalpha() and animal.isalpha() and len(number) == 3
