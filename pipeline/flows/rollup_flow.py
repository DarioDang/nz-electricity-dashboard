# ============================================================
# pipeline/flows/rollup_flow.py
# Responsibility: Nightly dbt run + purge raw rows > 7 days
# Runs: once per day at midnight NZT
# ============================================================
import os 
import sys
import subprocess
from datetime import datetime, timezone, timedelta
from prefect import flow, task, get_run_logger

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from load import get_connection

# Path to dbt project
DBT_PROJECT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "nz_energy_dbt"
)

# ============================================================
# Tasks
# ============================================================

@task(
    name="dbt-run",
    description="Run all dbt models to refresh staging and mart tables",
    retries=2,
    retry_delay_seconds=30
)
def dbt_run_task():
    logger = get_run_logger()
    logger.info(f"Running dbt from: {DBT_PROJECT_DIR}")

    result = subprocess.run(
        ["dbt", "run"],
        cwd=DBT_PROJECT_DIR,
        capture_output=True,
        text=True
    )

    logger.info(result.stdout)

    if result.returncode != 0:
        logger.error(result.stderr)
        raise Exception(f"dbt run failed: {result.stderr}")

    logger.info("dbt run completed successfully")
    return result.returncode


@task(
    name="dbt-test",
    description="Run dbt tests to validate mart data quality",
    retries=1,
    retry_delay_seconds=15
)
def dbt_test_task():
    logger = get_run_logger()
    logger.info("Running dbt tests")

    result = subprocess.run(
        ["dbt", "test"],
        cwd=DBT_PROJECT_DIR,
        capture_output=True,
        text=True
    )

    logger.info(result.stdout)

    if result.returncode != 0:
        logger.error(result.stderr)
        raise Exception(f"dbt test failed: {result.stderr}")

    logger.info("dbt tests passed")
    return result.returncode


@task(
    name="purge-old-raw-rows",
    description="Delete raw table rows older than 7 days to keep storage lean",
    retries=2,
    retry_delay_seconds=10
)
def purge_task():
    logger = get_run_logger()

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    logger.info(f"Purging rows older than {cutoff.isoformat()}")

    conn = get_connection()
    cur  = conn.cursor()

    tables = [
        "carbon_intensity",
        "node_prices",
        "regional_prices",
        "generation_forecast",
        "reserve_prices",
    ]

    total_deleted = 0
    for table in tables:
        cur.execute(
            f"DELETE FROM {table} WHERE timestamp < %s",
            (cutoff,)
        )
        deleted = cur.rowcount
        total_deleted += deleted
        logger.info(f"  {table}: {deleted} rows purged")

    conn.commit()
    cur.close()
    conn.close()

    logger.info(f"Purge complete — {total_deleted} total rows deleted")
    return total_deleted


# ============================================================
# Flow — orchestrates dbt run + purge
# ============================================================

@flow(
    name="nz-energy-rollup",
    description="Nightly dbt refresh and raw data purge for NZ energy dashboard",
    log_prints=True
)
def rollup_flow():
    logger = get_run_logger()
    logger.info("=== NZ Energy Rollup Flow Started ===")

    # Step 1 — refresh dbt models
    dbt_run_task()

    # Step 2 — validate data quality
    dbt_test_task()

    # Step 3 — purge old raw rows
    purge_task()

    logger.info("=== Rollup Flow Complete ===")


# ============================================================
# Local test
# Usage: python pipeline/flows/rollup_flow.py
# ============================================================
if __name__ == "__main__":
    rollup_flow()