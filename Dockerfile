# Backend image: FastAPI app + the one-shot `init` job (same image, different command).
# Data and the trained model are NOT baked in: the CSV is mounted, the model lives in a volume.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# libgomp: OpenMP runtime required by XGBoost
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first (cached layer). constraints.txt pins the exact versions the tests ran on.
COPY requirements.txt requirements-ml.txt constraints.txt ./
RUN pip install -r requirements-ml.txt -c constraints.txt

COPY app ./app
COPY src ./src

# Non-root user; /app/models is the mount point of the model volume
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/models /app/data/raw \
    && chown -R appuser:appuser /app/models /app/data
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"

# One worker by default; set WEB_CONCURRENCY to scale (each worker loads the model + explainers)
CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
