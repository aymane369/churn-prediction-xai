# Data

## Source
IBM Telco Customer Churn sample dataset (Kaggle: `blastchar/telco-customer-churn`).
7,043 customers, 21 columns. Place the CSV at `data/raw/Telco-Customer-Churn.csv`
(git-ignored; never edit it by hand).

## Cleaning (`src/data/preprocess.py`)
- Columns renamed to snake_case.
- `TotalCharges` is text in the raw file with 11 blank values. All 11 are customers with
  `tenure = 0` (nothing billed yet), so they are set to `0.0`. The code fails loudly if a
  blank ever appears for a customer with `tenure > 0`.
- `Yes`/`No` columns become booleans; `SeniorCitizen` (0/1) becomes a boolean.
- Three-state service columns (`Yes` / `No` / `No internet service`) stay as text.

## Pseudonyms and avatars (`src/data/identity.py`)
Each customer gets a generated username (`adjective_animal_123`) and an `avatar_seed`, both
derived from a hash of the original `customerID`, so they are stable across re-runs.
Avatar images are not stored: the front end renders them from the seed.

## Database
Cleaned rows live in PostgreSQL, table `customers`. See `src/db/models.py`.
