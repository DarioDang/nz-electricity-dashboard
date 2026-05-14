#====================================================================
    # Takes the clean DataFrames from transform.py and upserts them into Postgres. Upsert means insert 
    # if the row doesn't exist, skip if it already does — this is critical because your pipeline runs every 
    # 30 minutes and will see the same trading periods multiple times.

# Best Practice Rules for load.py
# 1. Always upsert, never plain insert — ON CONFLICT DO NOTHING prevents duplicate key errors when the pipeline re-runs.
# 2. Use a single DB connection per pipeline run — open once, use everywhere, close when done.
# 3. Load in dependency order — grid_zones before regional_prices because of the foreign key constraint.
# 4. Wrap each table load in try/except — one table failing shouldn't crash the whole pipeline.
# 5. Log row counts before and after — so you know exactly how many rows were new vs already existed.
# 6. Never hardcode credentials — always read from environment variables via .env.

#====================================================================

# ============================================================
# pipeline/load.py
# Responsibility: Upsert clean DataFrames into Postgres.
# Uses ON CONFLICT DO NOTHING — safe to re-run any time.
# Connection config read from .env file.
# ============================================================

import logging
import os
import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ============================================================
# Database connection
# ============================================================
def get_connection():
    """
    Create and return a Postgres connection using .env credentials.
    Caller is responsible for closing the connection.
    """

    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "nz_energy"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres")
    )
    logger.info("Database connection established")
    return conn


def _convert_types(value):
    """
    Convert numpy/pandas types to native Python types.
    psycopg2 cannot adapt numpy.int64, numpy.float64 etc.
    """
    if pd.isna(value):
        return None
    if hasattr(value, 'item'):
        # converts numpy.int64, numpy.float64 etc → Python int/float
        return value.item()
    return value

# ============================================================
# Shared upsert utility
# ============================================================ 
def _upsert(
    conn,
    df: pd.DataFrame,
    table: str,
    conflict_cols: list
) -> int:
    """
    Upsert a DataFrame into a Postgres table.
    Skips rows that already exist based on conflict_cols.
    Returns number of rows actually inserted.
    """

    if df.empty:
        logger.warning(f"{table}: DataFrame is empty, skipping load")
        return 0

    cols        = list(df.columns)
    col_str     = ", ".join(cols)
    placeholder = ", ".join(["%s"] * len(cols))
    conflict    = ", ".join(conflict_cols)

    sql = f"""
        INSERT INTO {table} ({col_str})
        VALUES ({placeholder})
        ON CONFLICT ({conflict}) DO NOTHING
    """

    # Convert DataFrame rows to list of tuples
    # Handle pandas NA/NaT → Python None for psycopg2
    rows = [
        tuple(_convert_types(v) for v in row)
        for row in df.itertuples(index=False, name=None)
    ]

    with conn.cursor() as cur:
        before = _row_count(cur, table)
        psycopg2.extras.execute_batch(cur, sql, rows, page_size=500)
        conn.commit()
        after = _row_count(cur, table)

    inserted = after - before
    skipped  = len(rows) - inserted
    logger.info(
        f"{table}: {len(rows)} rows processed → "
        f"{inserted} inserted, {skipped} skipped (already exist)"
    )
    return inserted

def _row_count(cur, table: str) -> int:
    """Get current row count of a table."""
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    return cur.fetchone()[0]

# ============================================================
# Individual load functions — one per table
# ============================================================
def load_carbon_intensity(conn, df: pd.DataFrame) -> int:
    """
    Load carbon_intensity, PK: timestamp.
    """
    return _upsert(conn,df, "carbon_intensity", ["timestamp"])


def load_node_prices(conn, df: pd.DataFrame) -> int:
    """Load node_prices. PK: (timestamp, node_id)."""
    return _upsert(conn, df, "node_prices", ["timestamp", "node_id"])

def load_regional_prices(conn, df: pd.DataFrame) -> int:
    """
    Load regional_prices. PK: (timestamp, grid_zone_id).
    Note: depends on grid_zones FK — grid_zones must be seeded first.
    """
    return _upsert(conn, df, "regional_prices", ["timestamp", "grid_zone_id"])

def load_generation_forecast(conn, df: pd.DataFrame) -> int:
    """Load generation_forecast. PK: (timestamp, region, generation_type)."""
    return _upsert(conn, df, "generation_forecast",
                   ["timestamp", "region", "generation_type"])

def load_reserve_prices(conn, df: pd.DataFrame) -> int:
    """Load reserve_prices. PK: (timestamp, region)."""
    return _upsert(conn, df, "reserve_prices", ["timestamp", "region"])

# ============================================================
# Master load function — loads all 5 tables in correct order
# ============================================================
def load_all(transformed: dict) -> dict:
    """
    Load all transformed DataFrames into Postgres.
    Opens one connection, loads all tables, closes connection.
    Returns dict of inserted row counts per table.
    """
    conn = get_connection()
    results = {}

    logger.info("=== Starting full load ===")

    # Load order matters — regional_prices has FK on grid_zones
    # grid_zones is already seeded so we load in this order:
    load_sequence = [
        ("carbon_intensity",    load_carbon_intensity),
        ("node_prices",         load_node_prices),
        ("regional_prices",     load_regional_prices),
        ("generation_forecast", load_generation_forecast),
        ("reserve_prices",      load_reserve_prices),
    ]

    for table_name, load_fn in load_sequence:
        try:
            df = transformed.get(table_name, pd.DataFrame())
            results[table_name] = load_fn(conn, df)
        except Exception as e:
            logger.error(f"{table_name}: load failed — {e}")
            conn.rollback()
            results[table_name] = 0

    conn.close()
    logger.info("Database connection closed")
    logger.info("=== Load complete ===")
    logger.info(f"Summary: {results}")
    return results

# ============================================================
# Quick manual test
# Usage: python pipeline/load.py
# ============================================================
if __name__ == "__main__":
    from extract import fetch_all
    from transform import transform_all

    # Run full ETL
    raw         = fetch_all()
    transformed = transform_all(raw)
    results     = load_all(transformed)

    # Print summary
    print("\n=== LOAD SUMMARY ===")
    total = 0
    for table, inserted in results.items():
        print(f"  {table:25s} → {inserted:4d} rows inserted")
        total += inserted
    print(f"  {'TOTAL':25s} → {total:4d} rows inserted")

    # Verify counts in DB
    conn = get_connection()
    cur  = conn.cursor()
    print("\n=== TABLE ROW COUNTS IN DB ===")
    for table, _ in results.items():
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        print(f"  {table:25s} → {count:4d} rows in DB")
    cur.close()
    conn.close()