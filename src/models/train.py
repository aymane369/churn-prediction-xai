"""Train, tune and save the churn model.  Usage: python -m src.models.train [--trials 40]

Protocol
- 80/20 stratified split (test set is touched once, at the end).
- Models compared by 5-fold CV PR-AUC on the training part: logistic regression baseline,
  default XGBoost, Optuna-tuned XGBoost.
- Decision threshold = the F1-maximising cut-off on the training out-of-fold predictions.
- The saved model is the one fitted on the training part only, so the reported test metrics
  describe exactly the deployed model.
"""

import argparse
import hashlib
import json
from datetime import datetime, timezone

import joblib
import numpy as np
import optuna
import sklearn
import xgboost
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from src.data.load import load_raw
from src.data.preprocess import clean
from src.features.build_features import BOOLEAN, CATEGORICAL, FEATURES, NUMERIC, TARGET, build_features
from src.models.evaluate import best_f1_threshold, evaluate
from src.utils.config import settings

SEED = 42


def make_preprocessor(scale: bool) -> ColumnTransformer:
    return ColumnTransformer(
        [
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
            ("num", StandardScaler() if scale else "passthrough", NUMERIC),
            ("bool", "passthrough", BOOLEAN),
        ],
        verbose_feature_names_out=False,
    )


def make_xgb(params: dict | None = None) -> Pipeline:
    clf = XGBClassifier(
        **(params or {}), eval_metric="logloss", tree_method="hist", random_state=SEED, n_jobs=-1
    )
    return Pipeline([("prep", make_preprocessor(scale=False)), ("model", clf)])


def make_logreg() -> Pipeline:
    clf = LogisticRegression(max_iter=2000, class_weight="balanced")
    return Pipeline([("prep", make_preprocessor(scale=True)), ("model", clf)])


def tune_xgb(X, y, cv, n_trials: int) -> dict:
    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 600),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "max_depth": trial.suggest_int("max_depth", 2, 6),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-2, 10.0, log=True),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 1.0, log=True),
            "gamma": trial.suggest_float("gamma", 0.0, 5.0),
        }
        return float(cross_val_score(make_xgb(params), X, y, cv=cv, scoring="average_precision").mean())

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=SEED))
    study.optimize(objective, n_trials=n_trials)
    print(f"  best CV PR-AUC over {n_trials} trials: {study.best_value:.4f}")
    return study.best_params


def train(n_trials: int = 40) -> dict:
    df = clean(load_raw())
    X, y = build_features(df), df[TARGET].astype(int).reset_index(drop=True)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    print(f"train={len(X_train)} test={len(X_test)} churn rate={y.mean():.3f}")

    print("Tuning XGBoost with Optuna...")
    best_params = tune_xgb(X_train, y_train, cv, n_trials)

    candidates = {
        "logistic_regression": make_logreg(),
        "xgboost_default": make_xgb(),
        "xgboost_tuned": make_xgb(best_params),
    }
    report: dict[str, dict] = {}
    fitted: dict[str, Pipeline] = {}
    for name, pipe in candidates.items():
        oof = cross_val_predict(pipe, X_train, y_train, cv=cv, method="predict_proba")[:, 1]
        threshold = best_f1_threshold(y_train, oof)
        pipe.fit(X_train, y_train)
        test_proba = pipe.predict_proba(X_test)[:, 1]
        report[name] = {
            "cv": evaluate(y_train, oof, threshold),
            "test": evaluate(y_test, test_proba, threshold),
        }
        fitted[name] = pipe
        t = report[name]["test"]
        print(
            f"  {name:20s} cv PR-AUC={report[name]['cv']['pr_auc']:.3f} | test ROC-AUC={t['roc_auc']:.3f} "
            f"PR-AUC={t['pr_auc']:.3f} F1={t['f1']:.3f} recall={t['recall']:.3f} "
            f"precision={t['precision']:.3f} @thr={t['threshold']:.2f}"
        )

    # Deployed model = best XGBoost variant by CV (not test). Logistic regression is only a
    # baseline: the explainers (TreeSHAP) need a tree model.
    chosen = max(
        (k for k in report if k.startswith("xgboost")), key=lambda k: report[k]["cv"]["pr_auc"]
    )
    print(f"Selected by CV PR-AUC: {chosen}")
    pipeline = fitted[chosen]
    threshold = report[chosen]["test"]["threshold"]

    trained_at = datetime.now(timezone.utc)
    # Hash of the trained booster itself: a different model must never share a version string,
    # because cache keys and stored predictions are scoped by it.
    digest = hashlib.sha1(pipeline.named_steps["model"].get_booster().save_raw("ubj")).hexdigest()[:8]
    version = f"{chosen.split('_')[0]}-{trained_at:%Y%m%d}-{digest}"
    categories = {
        feat: [str(c) for c in cats]
        for feat, cats in zip(CATEGORICAL, pipeline.named_steps["prep"].named_transformers_["cat"].categories_)
    }
    metadata = {
        "model_version": version,
        "algorithm": chosen,
        "trained_at": trained_at.isoformat(timespec="seconds"),
        "threshold": threshold,
        "seed": SEED,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "churn_rate": float(y.mean()),
        "best_params": best_params,
        "features": FEATURES,
        "categories": categories,
        "metrics": report,
        "library_versions": {
            "scikit-learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "numpy": np.__version__,
        },
    }

    settings.model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "metadata": metadata, "background": X_train}, settings.model_path)
    settings.metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Saved {settings.model_path.name} and metadata.json  (version {version})")
    return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=40)
    train(parser.parse_args().trials)
