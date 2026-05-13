-- ============================================================
-- NZ Electricity Dashboard — Raw Table Schema
-- Version: 1.0
-- Last updated: 2026-05
-- Description: Raw tables populated by Python ingest pipeline.
--              Dashboard reads from dbt mart tables, not here.
-- ============================================================

-- Enable pg extentions we need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- future use
CREATE EXTENTION IF NOT EXISTS "pg_trgm"; -- future text search

-- =============================================================
-- REFERENCE: grid_zones 
-- Static lookup table - populated once via seed.sql
-- Never purged, never updated by pipline
-- =============================================================
CREATE TABLE IF NOT EXISTS grid_zones (
    grid_zone_id SMALLINT PRIMARY KEY,
    grid_zone_name VARCHAR(50) NOT NULL,
    island VARCHAR(2) NOT NULL, -- 'NI' ir 'SI'

    CONSTRAINT chk_island CHECK (island IN ('NI', 'SI'))
);

COMMENT ON TABLE grid_zones IS 'Static NZ electricity grid zones. Source: em6 /region/price/ API.';
COMMENT ON COLUMN  grid_zone.grid_zone_id IS "Numeric Zone ID as returned by em6 API.";
COMMENT ON COLUMN grid_zone.grid_zone_name IS "Human readable zone name e.g . Auckland, Canterbury.";
COMMENT ON COLUMN grid_zone.island IS "NI = North Island, SI = South Island.";

-- ============================================================
-- RAW: carbon_intensity
-- Source:    em6 /current_carbon_intensity/
-- Frequency: every 30 min (48 rows/day)
-- Retention: 7 days (purged by rollup_flow nightly)
-- ============================================================
CREATE TABLE IF NOT EXISTS carbon_intensity (
    timestamp   TIMESTAMPZ NOT NULL,
    tradind_period SMALLINT NOT NULL,
    trading_date TIMESTAMPTZ NOT NULL,
    nz_carbon_t NUMERIC(8,2),
    nz_carbon_gkwh NUMERIC(8,4),
    nz_carbon_change_gkwh NUMERIC(8,4),
    nz_renewable NUMERIC(6,4),
    max_24hrs_gkwh NUMERIC(8,4),
    min_24hrs_gkwh NUMERIC(8,4),
    current_month_avg_gkwh NUMERIC(8,4),
    current_year_avg_gkwh NUMERIC(8,4),
    pct_current_year_gkwh NUMERIC(6,4),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (timestamp)

);

COMMENT ON TABLE carbon_intensity IS 'NZ grid carbon intensity per 30-min trading period. Purged after 7 days.';
COMMENT ON COLUMN carbon_intensity.timestamp IS 'UTC timestamp of the trading period end.';
COMMENT ON COLUMN carbon_intensity.trading_period IS 'Trading period number 1-48 (each = 30 min).';
COMMENT ON COLUMN carbon_intensity.trading_date IS 'NZ market trading date (UTC, represents NZT date).';
COMMENT ON COLUMN carbon_intensity.nz_carbon_t IS 'Total tonnes of CO2 produced this trading period.';
COMMENT ON COLUMN carbon_intensity.nz_carbon_gkwh IS 'Carbon intensity in grams CO2 per kWh generated.';
COMMENT ON COLUMN carbon_intensity.nz_carbon_change_gkwh IS 'Change in gCO2/kWh vs previous trading period.';
COMMENT ON COLUMN carbon_intensity.nz_renewable IS 'Percentage of NZ generation from renewable sources.';
COMMENT ON COLUMN carbon_intensity.max_24hrs_gkwh IS 'Maximum carbon intensity in the last 24 hours.';
COMMENT ON COLUMN carbon_intensity.min_24hrs_gkwh IS 'Minimum carbon intensity in the last 24 hours.';
COMMENT ON COLUMN carbon_intensity.current_month_avg_gkwh IS 'Rolling average gCO2/kWh for current calendar month.';
COMMENT ON COLUMN carbon_intensity.current_year_avg_gkwh IS 'Rolling average gCO2/kWh for current calendar year.';
COMMENT ON COLUMN carbon_intensity.pct_current_year_gkwh IS 'Current intensity as % of rolling 12-month maximum.';
COMMENT ON COLUMN carbon_intensity.ingested_at IS 'UTC timestamp when this row was written to DB.';


-- ============================================================
-- RAW: node_prices
-- Source:    em6 /price/free_24hrs
-- Frequency: every 30 min (288 rows/day — 6 nodes x 48 periods)
-- Retention: 7 days (purged by rollup_flow nightly)
-- ============================================================
CREATE TABLE IF NOT EXISTS node_prices (
    timestamp TIMESTAMPTZ NOT NULL,
    trading_period SMALLINT NOT NULL,
    node_id VARCHAR(10) NOT NULL,
    price NUMERIC(10,4), 
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (timestamp, node_id)

    CONSTRAINT chk_node_id CHECK (
        node_id IN ('OTA2201','HAY2201','BEN2201',
                    'WKM2201','KIK2201','ISL2201')
)
);

COMMENT ON TABLE node_prices IS 'Spot prices at 6 key NZ grid nodes per trading period. Purged after 7 days. ';
COMMENT ON COLUMN node_prices.timestamp IS 'UTC timestamp of the trading period.';
COMMENT ON COLUMN node_prices.trading_period IS 'Trading period number 1-48.';
COMMENT ON COLUMN node_prices.node_id IS 'Grid node code. OTA=Auckland, HAY=Wellington, BEN=Benmore, WKM=Waikato, KIK=Kikiwhenua, ISL=Islington.';
COMMENT ON COLUMN node_prices.price IS 'Spot price in NZD/MWh.';
COMMENT ON COLUMN node_prices.ingested_at IS 'UTC timestamp when this row was written to DB.';

-- ============================================================
-- RAW: regional_prices
-- Source:    em6 /region/price/
-- Frequency: every 30 min (14 rows/call — 14 grid zones)
-- Retention: 7 days
-- ============================================================
CREATE TABLE IF NOT EXISTS regional_prices (
    timestamp TIMESTAMPTZ NOT NULL,
    trading_period SMALLINT NOT NULL,
    grid_zone_id SMALLINT NOT NULL,
    price NUMERIC(10,4),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (timestamp, grid_zone_id),
    CONSTRAINT fk_grid_zone
        FOREIGN KEY (grid_zone_id)
        REFERENCES grid_zones (grid_zone_id)
);

COMMENT ON TABLE  regional_prices IS 'Average spot price per NZ grid region per trading period. Purged after 7 days.';
COMMENT ON COLUMN regional_prices.timestamp IS 'UTC timestamp of the trading period.';
COMMENT ON COLUMN regional_prices.trading_period IS 'Trading period number 1-48.';
COMMENT ON COLUMN regional_prices.grid_zone_id IS 'FK to grid_zones. Identifies the NZ grid region.';
COMMENT ON COLUMN regional_prices.price IS 'Average spot price in NZD/MWh for this region.';
COMMENT ON COLUMN regional_prices.ingested_at IS 'UTC timestamp when this row was written to DB.';


-- ============================================================
-- RAW: generation_forecast
-- Source:    em6 /ig_aggregated
-- Frequency: every 30 min (~444 rows/call)
-- Retention: 7 days (forecast data stales quickly)
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_forecast (
    timestamp TIMESTAMPTZ NOT NULL,
    trading_period SMALLINT NOT NULL,
    region VARCHAR(2) NOT NULL,
    generation_type VARCHAR(3) NOT NULL,
    forecast_mw NUMERIC(10,4),
    potential_forecast_mw NUMERIC(10,4),
    cleared_mw NUMERIC(10,4),
    shortfall_mw NUMERIC(10,4),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (timestamp, region, generation_type),
    CONSTRAINT chk_region CHECK (region IN ('NI', 'SI','NZ')),
    CONSTRAINT chk_generation_type CHECK (generation_type IN ('WIN', 'SOL'))
);

COMMENT ON TABLE  generation_forecast IS 'Wind and solar generation forecast per region per trading period. Purged after 7 days.';
COMMENT ON COLUMN generation_forecast.timestamp IS 'UTC timestamp of the trading period.';
COMMENT ON COLUMN generation_forecast.trading_period  IS 'Trading period number 1-48.';
COMMENT ON COLUMN generation_forecast.region IS 'NI = North Island, SI = South Island, NZ = Nationwide.';
COMMENT ON COLUMN generation_forecast.generation_type  IS 'WIN = Wind, SOL = Solar.';
COMMENT ON COLUMN generation_forecast.forecast_mw  IS 'Forecasted generation in MW.';
COMMENT ON COLUMN generation_forecast.potential_forecast_mw IS 'Potential generation if unconstrained, in MW.';
COMMENT ON COLUMN generation_forecast.cleared_mw IS 'Actual cleared/dispatched generation in MW.';
COMMENT ON COLUMN generation_forecast.shortfall_mw IS 'Difference between forecast and cleared (negative = cleared exceeded forecast).';
COMMENT ON COLUMN generation_forecast.ingested_at IS 'UTC timestamp when this row was written to DB.';


-- ============================================================
-- RAW: reserve_prices
-- Source:    em6 /current_reserve_prices/
-- Frequency: every 30 min (2 rows/call — NI and SI)
-- Retention: 7 days
-- ============================================================
CREATE TABLE IF NOT EXISTS reserve_prices (
    timestamp TIMESTAMPTZ NOT NULL,
    trading_date TIMESTAMPTZ NOT NULL,
    trading_period SMALLINT NOT NULL,
    region VARCHAR(2) NOT NULL,
    sir_price NUMERIC(10,4),
    fir_price NUMERIC(10,4),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (timestamp, region),
    CONSTRAINT chk_reserve_region CHECK (region IN ('NI', 'SI'))
);


COMMENT ON TABLE  reserve_prices IS 'Fast and sustained reserve prices for NI and SI per trading period. Purged after 7 days.';
COMMENT ON COLUMN reserve_prices.timestamp IS 'UTC timestamp of the trading period.';
COMMENT ON COLUMN reserve_prices.trading_date IS 'NZ market trading date in UTC.';
COMMENT ON COLUMN reserve_prices.trading_period IS 'Trading period number 1-48.';
COMMENT ON COLUMN reserve_prices.region IS 'NI = North Island, SI = South Island.';
COMMENT ON COLUMN reserve_prices.sir_price IS 'Sustained Instantaneous Reserve price (60s response) in NZD/MWh.';
COMMENT ON COLUMN reserve_prices.fir_price IS 'Fast Instantaneous Reserve price (6s response) in NZD/MWh.';
COMMENT ON COLUMN reserve_prices.ingested_at IS 'UTC timestamp when this row was written to DB.';


-- ============================================================
-- SUMMARY: daily_summary
-- Written by: dbt rollup model nightly
-- Retention:  forever (tiny — 1 row per day)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_summary (
    date DATE PRIMARY KEY,
    avg_carbon_gkwh NUMERIC(8,4),
    max_carbon_gkwh NUMERIC(8,4),
    min_carbon_gkwh NUMERIC(8,4),
    avg_renewable_pct NUMERIC(6,4),
    peak_renewable_pct NUMERIC(6,4),
    avg_price_ota NUMERIC(10,4),
    avg_price_hay NUMERIC(10,4),
    avg_price_ben NUMERIC(10,4),
    max_price_ota NUMERIC(10,4),
    min_price_ota NUMERIC(10,4),
    ni_si_spread_avg NUMERIC(10,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  daily_summary IS 'Daily aggregated summary built by dbt. One row per calendar day. Never purged.';
COMMENT ON COLUMN daily_summary.date IS 'NZ calendar date (NZT).';
COMMENT ON COLUMN daily_summary.avg_carbon_gkwh IS 'Daily average carbon intensity gCO2/kWh.';
COMMENT ON COLUMN daily_summary.avg_renewable_pct IS 'Daily average renewable generation percentage.';
COMMENT ON COLUMN daily_summary.ni_si_spread_avg IS 'Average price spread between OTA (Auckland) and BEN (Benmore) nodes. Key NZ market indicator.';
COMMENT ON COLUMN daily_summary.created_at IS 'UTC timestamp when dbt last wrote this row.';

-- ============================================================
-- INDEXES
-- Added after table creation for clarity
-- ============================================================
-- carbon_intensity: most queries filter by time range
CREATE INDEX IF NOT EXISTS idx_carbon_intensity_timestamp
    ON carbon_intensity (timestamp DESC);

-- node_prices: dashboard queries by node + time range
CREATE INDEX IF NOT EXISTS idx_node_prices_timestamp
    ON node_prices (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_node_prices_node_id
    ON node_prices (node_id);

-- regional_prices: map queries by latest timestamp
CREATE INDEX IF NOT EXISTS idx_regional_prices_timestamp
    ON regional_prices (timestamp DESC);

-- generation_forecast: forecast chart queries by type + region
CREATE INDEX IF NOT EXISTS idx_generation_forecast_timestamp
    ON generation_forecast (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_generation_forecast_type_region
    ON generation_forecast (generation_type, region);

-- reserve_prices: small table, minimal indexing needed
CREATE INDEX IF NOT EXISTS idx_reserve_prices_timestamp
    ON reserve_prices (timestamp DESC);

-- daily_summary: always queried as date range
CREATE INDEX IF NOT EXISTS idx_daily_summary_date
    ON daily_summary (date DESC);