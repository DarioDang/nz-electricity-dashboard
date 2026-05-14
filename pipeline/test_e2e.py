# ============================================================
# pipeline/test_e2e.py
# End to end test — runs full ETL and validates data quality
# Usage: python pipeline/test_e2e.py
# ============================================================

import logging
import sys
import psycopg2
from extract import fetch_all
from transform import transform_all
from load import load_all, get_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ============================================================
# Test helpers
# ============================================================

passed = []
failed = []

def check(name: str, condition: bool, detail: str = ""):
    if condition:
        passed.append(name)
        print(f"  ✅ PASS  {name}")
    else:
        failed.append(name)
        print(f"  ❌ FAIL  {name} {detail}")


# ============================================================
# Step 1 — Run full ETL
# ============================================================

print("\n=== STEP 1: Running full ETL pipeline ===")
try:
    raw         = fetch_all()
    transformed = transform_all(raw)
    results     = load_all(transformed)
    check("ETL pipeline ran without errors", True)
except Exception as e:
    check("ETL pipeline ran without errors", False, str(e))
    print("\nPipeline crashed — cannot continue tests")
    sys.exit(1)


# ============================================================
# Step 2 — Validate transformed DataFrames
# ============================================================

print("\n=== STEP 2: Validating transformed DataFrames ===")

for table_name, df in transformed.items():

    # Not empty
    check(
        f"{table_name}: DataFrame is not empty",
        not df.empty
    )

    # No nulls in primary key columns
    pk_map = {
        "carbon_intensity":    ["timestamp"],
        "node_prices":         ["timestamp", "node_id"],
        "regional_prices":     ["timestamp", "grid_zone_id"],
        "generation_forecast": ["timestamp", "region", "generation_type"],
        "reserve_prices":      ["timestamp", "region"],
    }
    for pk_col in pk_map.get(table_name, []):
        check(
            f"{table_name}: no nulls in {pk_col}",
            df[pk_col].isnull().sum() == 0
        )

    # Timestamps are UTC-aware
    import pandas as pd
    if "timestamp" in df.columns:
        check(
            f"{table_name}: timestamp is UTC-aware",
            str(df["timestamp"].dtype) == "datetime64[ns, UTC]"
        )


# ============================================================
# Step 3 — Validate data ranges
# ============================================================

print("\n=== STEP 3: Validating data ranges ===")

# Carbon intensity
ci = transformed["carbon_intensity"]
if not ci.empty:
    check("carbon_intensity: renewable % between 0-100",
          ci["nz_renewable"].between(0, 100).all())
    check("carbon_intensity: carbon gkwh > 0",
          (ci["nz_carbon_gkwh"] > 0).all())
    check("carbon_intensity: trading_period between 1-48",
          ci["trading_period"].between(1, 48).all())

# Node prices
np_df = transformed["node_prices"]
if not np_df.empty:
    check("node_prices: all 6 nodes present",
          set(np_df["node_id"].unique()) == {
              "OTA2201","HAY2201","BEN2201",
              "WKM2201","KIK2201","ISL2201"
          })
    check("node_prices: price > 0",
          (np_df["price"] > 0).all())

# Regional prices
rp = transformed["regional_prices"]
if not rp.empty:
    check("regional_prices: 14 zones present",
          rp["grid_zone_id"].nunique() == 14)
    check("regional_prices: price > 0",
          (rp["price"] > 0).all())

# Generation forecast
gf = transformed["generation_forecast"]
if not gf.empty:
    check("generation_forecast: both WIN and SOL present",
          set(gf["generation_type"].unique()) == {"WIN", "SOL"})
    check("generation_forecast: all regions present (NI, SI, NZ)",
          set(gf["region"].unique()) == {"NI", "SI", "NZ"})

# Reserve prices
rv = transformed["reserve_prices"]
if not rv.empty:
    check("reserve_prices: both NI and SI present",
          set(rv["region"].unique()) == {"NI", "SI"})
    check("reserve_prices: sir_price > 0",
          (rv["sir_price"] > 0).all())
    check("reserve_prices: fir_price > 0",
          (rv["fir_price"] > 0).all())


# ============================================================
# Step 4 — Validate data in Postgres
# ============================================================

print("\n=== STEP 4: Validating data in Postgres ===")

conn = get_connection()
cur  = conn.cursor()

# Row counts
expected_min = {
    "carbon_intensity":    3,
    "node_prices":         48,    # at least one full set
    "regional_prices":     14,
    "generation_forecast": 100,
    "reserve_prices":      2,
}

for table, min_rows in expected_min.items():
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    count = cur.fetchone()[0]
    check(
        f"{table}: at least {min_rows} rows in DB (got {count})",
        count >= min_rows
    )

# Timestamps stored as UTC
cur.execute("""
    SELECT timestamp
    FROM carbon_intensity
    ORDER BY timestamp DESC
    LIMIT 1
""")
row = cur.fetchone()
if row:
    check(
        "carbon_intensity: latest timestamp is timezone-aware in DB",
        row[0].tzinfo is not None
    )

# No duplicate primary keys
cur.execute("""
    SELECT COUNT(*), COUNT(DISTINCT timestamp)
    FROM carbon_intensity
""")
total, distinct = cur.fetchone()
check(
    "carbon_intensity: no duplicate timestamps",
    total == distinct
)

cur.execute("""
    SELECT COUNT(*), COUNT(DISTINCT timestamp || node_id)
    FROM node_prices
""")
total, distinct = cur.fetchone()
check(
    "node_prices: no duplicate (timestamp, node_id) combinations",
    total == distinct
)

cur.close()
conn.close()


# ============================================================
# Step 5 — Re-run test (upsert idempotency)
# ============================================================

print("\n=== STEP 5: Testing upsert idempotency ===")

conn   = get_connection()
cur    = conn.cursor()

# Get counts before second run
before_counts = {}
for table in expected_min.keys():
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    before_counts[table] = cur.fetchone()[0]

cur.close()
conn.close()

# Run pipeline again
results2 = load_all(transformed)

# Get counts after second run
conn = get_connection()
cur  = conn.cursor()
for table in expected_min.keys():
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    after_count = cur.fetchone()[0]
    check(
        f"{table}: row count unchanged after re-run (upsert works)",
        after_count == before_counts[table]
    )

cur.close()
conn.close()


# ============================================================
# Final summary
# ============================================================

print(f"\n{'='*50}")
print(f"RESULTS: {len(passed)} passed, {len(failed)} failed")
print(f"{'='*50}")

if failed:
    print(f"\nFailed tests:")
    for f in failed:
        print(f"  ❌ {f}")
    sys.exit(1)
else:
    print("\n🎉 All tests passed — pipeline is working correctly")
    sys.exit(0)