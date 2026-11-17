"""Central configuration, read from environment variables or a local .env file."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://churn:churn_dev@localhost:5433/churn"
    raw_data_path: Path = ROOT / "data" / "raw" / "Telco-Customer-Churn.csv"
    model_dir: Path = ROOT / "models"
    frontend_dir: Path = ROOT / "frontend"


settings = Settings()
