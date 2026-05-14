# Takes the raw API response dicts from extract.py and returns clean pandas DataFrames ready to insert into Postgres.

# =============================================================================
    # Best Practice Rules for transform.py
    # 1. One function per table — mirrors extract.py structure exactly.
    # 2. Rename columns to match schema — sir price → sir_price, forecast_generation → forecast_mw etc.
    # 3. Parse timestamps to timezone-aware datetime — always UTC, never naive.
    # 4. Cast types explicitly — don't trust the API to always return a float. Cast it yourself.
    # 5. Drop rows with null primary key fields — a row with no timestamp is useless and will break the insert.
    # 6. Never mutate the input — always work on a copy of the data so the raw dict stays intact for logging.

    # pipeline/transform.py
    # Responsibility: Transform raw API responses into clean
    #                 DataFrames that match the Postgres schema.
    # Input:  raw dict from extract.py (API JSON response)
    # Output: pandas DataFrame ready for load.py
# ==============================================================================
import logging
import pandas as pd

logger = logging.getLogger(__name__)

# Shared Utility 
def _parse_timestamps(df: pd.DataFrame, cols: list) -> pd.DataFrame:
    """Parse timestamp columns to UTC-aware datetime."""
    for col in cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], utc=True)
    return df

def _drop_null_keys(df: pd.DataFrame, key_cols: list, table: str) -> pd.DataFrame:
    """
    Drop rows where primary key columns are null.
    """
    
    before = len(df)
    df = df.dropna(subset = key_cols)
    dropped = before - len(df)
    if dropped > 0:
        logger.warning(f"{table}: dropped {dropped} rows with null primary key fields")
    return df


# ============================================================
# Transform functions — one per table
# ============================================================
def transform_carbon_intensity(raw: dict) -> pd.DataFrame:
    """
    Transform raw/current_carbon_intensity/response.
    Input: 3 rows from API
    Output: clean DataFrame matching carbon_intensity_table
    """

    items = raw.get("items", [])
    if not items:
        logger.warning("carbon_intensity: no items in raw response")
        return pd.DataFrame
    
    df = pd.DataFrame(items).copy()

    # Parse timestamps 
    df = _parse_timestamps(df, ["timestamp", "trading_date"])

    # Drop redundant prev column - derived from prior row
    if "nz_carbon_gkwh_prev" in df.columns:
        df = df.drop(columns=["nz_carbon_gkwh_prev"])
    
    # Past numeric columns intensity
    numeric_cols = [
        "nz_carbon_t", "nz_carbon_gkwh", "nz_carbon_change_gkwh",
        "nz_renwable", "max_24hrs_gkwh", "min_24hrs_gkwh", "current_month_avg_gkwh",
        "current_year_avg_gkwh", "pct_current_year_gkwh"
    ]

    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors = "coerce")
    
    df["trading_period"] = df["trading_period"].astype("Int64")

    # Drop rows missing primary key
    df = _drop_null_keys(df, ["timestamp"], "carbon_intensity")

    # Keep only schema columns in correct order
    df = df[[
        "timestamp", "trading_period", "trading_date",
        "nz_carbon_t", "nz_carbon_gkwh", "nz_carbon_change_gkwh",
        "nz_renewable", "max_24hrs_gkwh", "min_24hrs_gkwh",
        "current_month_avg_gkwh", "current_year_avg_gkwh",
        "pct_current_year_gkwh"
    ]]

    logger.info(f"carbon_intensity: {len(df)} rows transformed")
    return df

def transform_node_prices(raw: dict) -> pd.DataFrame:
    items = raw.get("items", [])
    if not items:
        logger.warning("node_prices: no items in raw response")
        return pd.DataFrame()

    df = pd.DataFrame(items).copy()

    # Fix: parse timestamp string explicitly
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # Cast types
    df["trading_period"] = df["trading_period"].astype("Int64")
    df["price"]          = pd.to_numeric(df["price"], errors="coerce")

    df = _drop_null_keys(df, ["timestamp", "node_id"], "node_prices")
    df = df[["timestamp", "trading_period", "node_id", "price"]]

    logger.info(f"node_prices: {len(df)} rows transformed")
    return df

def transform_regional_prices(raw: dict) -> pd.DataFrame:
    """
    Transform raw /region/price/ response.
    Input:  14 rows (one per grid zone, current period)
    Output: clean DataFrame matching regional_prices table
    """
    items = raw.get("items", [])
    if not items:
        logger.warning("regional_prices: no items in raw response")
        return pd.DataFrame()

    df = pd.DataFrame(items).copy()

    # Parse timestamps
    df = _parse_timestamps(df, ["timestamp"])

    # Cast types
    df["trading_period"] = df["trading_period"].astype("Int64")
    df["grid_zone_id"]   = pd.to_numeric(df["grid_zone_id"], errors="coerce").astype("Int64")
    df["price"]          = pd.to_numeric(df["price"], errors="coerce")

    # Drop grid_zone_name — already stored in grid_zones reference table
    if "grid_zone_name" in df.columns:
        df = df.drop(columns=["grid_zone_name"])

    # Drop rows missing primary key
    df = _drop_null_keys(df, ["timestamp", "grid_zone_id"], "regional_prices")

    # Keep only schema columns
    df = df[["timestamp", "trading_period", "grid_zone_id", "price"]]

    logger.info(f"regional_prices: {len(df)} rows transformed")
    return df

def transform_generation_forecast(raw: dict) -> pd.DataFrame:
    """
    Transform raw /ig_aggregated response.
    Input:  ~444 rows (SOL+WIN x NI+SI+NZ x ~74 periods)
    Output: clean DataFrame matching generation_forecast table
    """
    items = raw.get("items", [])
    if not items:
        logger.warning("generation_forecast: no items in raw response")
        return pd.DataFrame()

    df = pd.DataFrame(items).copy()

    # Parse timestamps
    df = _parse_timestamps(df, ["timestamp"])

    # Rename columns to match schema
    df = df.rename(columns={
        "forecast_generation":           "forecast_mw",
        "potential_forecast_generation": "potential_forecast_mw",
        "cleared":                       "cleared_mw",
        "shortfall":                     "shortfall_mw"
    })

    # Cast types
    df["trading_period"] = df["trading_period"].astype("Int64")
    for col in ["forecast_mw", "potential_forecast_mw", "cleared_mw", "shortfall_mw"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows missing primary key
    df = _drop_null_keys(
        df,
        ["timestamp", "region", "generation_type"],
        "generation_forecast"
    )

    # Keep only schema columns
    df = df[[
        "timestamp", "trading_period", "region", "generation_type",
        "forecast_mw", "potential_forecast_mw", "cleared_mw", "shortfall_mw"
    ]]

    logger.info(f"generation_forecast: {len(df)} rows transformed")
    return df

def transform_reserve_prices(raw: dict) -> pd.DataFrame:
    """
    Transform raw /current_reserve_prices/ response.
    Input:  2 rows (NI and SI)
    Output: clean DataFrame matching reserve_prices table
    """
    items = raw.get("items", [])
    if not items:
        logger.warning("reserve_prices: no items in raw response")
        return pd.DataFrame()

    df = pd.DataFrame(items).copy()

    # Parse timestamps
    df = _parse_timestamps(df, ["timestamp", "trading_date"])

    # Rename columns — API returns "sir price" and "fir price" with spaces
    df = df.rename(columns={
        "sir price": "sir_price",
        "fir price": "fir_price"
    })

    # Cast types
    df["trading_period"] = df["trading_period"].astype("Int64")
    df["sir_price"]      = pd.to_numeric(df["sir_price"], errors="coerce")
    df["fir_price"]      = pd.to_numeric(df["fir_price"], errors="coerce")

    # Drop rows missing primary key
    df = _drop_null_keys(df, ["timestamp", "region"], "reserve_prices")

    # Keep only schema columns
    df = df[[
        "timestamp", "trading_date", "trading_period",
        "region", "sir_price", "fir_price"
    ]]

    logger.info(f"reserve_prices: {len(df)} rows transformed")
    return df

# ============================================================
# Master transform function — transforms all 5 raw responses
# Used by the Prefect ingest flow
# ============================================================
def transform_all(raw: dict) -> dict:
    """
    Transform all raw API responses into clean DataFrames.
    Input:  raw dict from extract.fetch_all()
    Output: dict of DataFrames keyed by table name
    """
    logger.info("=== Starting full transform ===")

    transformed = {
        "carbon_intensity":    transform_carbon_intensity(raw["carbon_intensity"]),
        "node_prices":         transform_node_prices(raw["node_prices"]),
        "regional_prices":     transform_regional_prices(raw["regional_prices"]),
        "generation_forecast": transform_generation_forecast(raw["generation_forecast"]),
        "reserve_prices":      transform_reserve_prices(raw["reserve_prices"]),
    }

    logger.info("=== Transform complete ===")
    return transformed

# ============================================================
# Quick manual test
# Usage: python pipeline/transform.py
# ============================================================
if __name__ == "__main__":
    from extract import fetch_all

    raw = fetch_all()
    transformed = transform_all(raw)

    for name, df in transformed.items():
        if df.empty:
            print(f"{name:25s} → EMPTY")
        else:
            print(f"\n{'='*60}")
            print(f"Table: {name}")
            print(f"Shape: {df.shape}")
            print(f"Dtypes:\n{df.dtypes}")
            print(f"Sample:\n{df.head(3)}")