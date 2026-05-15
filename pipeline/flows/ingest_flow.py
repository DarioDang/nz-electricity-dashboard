# ============================================================
# pipeline/flows/ingest_flow.py
# Responsibility: Full ETL every 30 minutes
# Tasks: extract → transform → load → done
# ============================================================

import logging
import sys
import os

from prefect import flow, task, get_run_logger
from prefect.tasks import task_input_hash
from datetime import timedelta

# Add pipeline root to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extract import fetch_all
from transform import transform_all
from load import load_all

# ============================================================
# Tasks — each step wrapped as a Prefect task
# ============================================================

@task(
    name="extract-em6-data",
    description="Fetch raw data from all 5 em6 free API endpoints",
    retries=3,
    retry_delay_seconds=30,
    cache_key_fn=task_input_hash,
    cache_expiration=timedelta(minutes=25)
)
def extract_task() -> dict:
    logger = get_run_logger()
    logger.info("Starting extract from em6 API")
    raw = fetch_all()
    total = sum(len(v.get("items", [])) for v in raw.values())
    logger.info(f"Extract complete — {total} total records fetched")
    return raw


@task(
    name="transform-em6-data",
    description="Clean and reshape raw API responses into Postgres-ready DataFrames",
    retries=2,
    retry_delay_seconds=10
)
def transform_task(raw: dict) -> dict:
    logger = get_run_logger()
    logger.info("Starting transform")
    transformed = transform_all(raw)
    for table, df in transformed.items():
        logger.info(f"  {table}: {len(df)} rows transformed")
    return transformed


@task(
    name="load-em6-data",
    description="Upsert transformed DataFrames into Postgres raw tables",
    retries=2,
    retry_delay_seconds=15
)
def load_task(transformed: dict) -> dict:
    logger = get_run_logger()
    logger.info("Starting load into Postgres")
    results = load_all(transformed)
    total_inserted = sum(results.values())
    logger.info(f"Load complete — {total_inserted} new rows inserted")
    for table, count in results.items():
        logger.info(f"  {table}: {count} rows inserted")
    return results


# ============================================================
# Flow — orchestrates all 3 tasks
# ============================================================

@flow(
    name="nz-energy-ingest",
    description="Extract, transform and load NZ electricity data from em6 API",
    log_prints=True
)
def ingest_flow():
    logger = get_run_logger()
    logger.info("=== NZ Energy Ingest Flow Started ===")

    # Run tasks in sequence
    raw         = extract_task()
    transformed = transform_task(raw)
    results     = load_task(transformed)

    total = sum(results.values())
    logger.info(f"=== Ingest Flow Complete — {total} new rows ===")
    return results


# ============================================================
# Local test
# Usage: python pipeline/flows/ingest_flow.py
# ============================================================
if __name__ == "__main__":
    ingest_flow()