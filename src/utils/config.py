"""Central configuration, read from environment variables or a local .env file."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://churn:churn_dev@localhost:5433/churn"
    raw_data_path: Path = ROOT / "data" / "raw" / "Telco-Customer-Churn.csv"
    model_dir: Path = ROOT / "models"

    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 86400  # 24 h; keys also embed the model version

    @property
    def model_path(self) -> Path:
        return self.model_dir / "churn_model.joblib"

    @property
    def metadata_path(self) -> Path:
        return self.model_dir / "metadata.json"


settings = Settings()
