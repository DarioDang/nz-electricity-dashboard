# ============================================================
# api/routers/prices.py
# Endpoints:
#   GET /api/prices/nodes      → 24hr prices per node (line chart)
#   GET /api/prices/regions    → current price per region (map)
#   GET /api/prices/summary    → daily summary historical chart
# ============================================================
from fastapi import APIRouter, HTTPException
from api.database import query_one, query_many
from api.models import NodePricePoint, RegionalPrice, DailySummary

router = APIRouter()

@router.get("/prices/nodes", response_model = list[NodePricePoint])
def get_node_prices(hours: int = 24):
    """
    Spot prices for 6 key nodes for the last N hours (default 24hrs).
    Powers: price trend line chart
    """

    results = query_many("""
        SELECT
            timestamp_utc,
            timestamp_nzt,
            trading_period,
            node_id,
            city_name,
            island,
            price_nzd_mwh,
            price_category,
            is_reference_node,
            avg_24hr_price,
            min_24hr_price,
            max_24hr_price
        FROM marts.mart_node_prices
        WHERE timestamp_utc > NOW() - INTERVAL '1 hour' * %s
        ORDER BY timestamp_utc ASC, node_id
    """, (hours,))

    return results

@router.get("/prices/regions", response_model = list[RegionalPrice])
def get_regional_prices():
    """
    Current spot price for all 14 NZ grid regions.
    Powers: NZ Regional price map.
    """

    results = query_many("""
        SELECT
            rp.timestamp_utc,
            rp.trading_period,
            rp.grid_zone_id,
            gz.grid_zone_name,
            gz.island,
            rp.price_nzd_mwh
        FROM staging.stg_em6__regional_prices rp
        JOIN public.grid_zones gz USING (grid_zone_id)
        WHERE rp.timestamp_utc = (
            SELECT MAX(timestamp_utc)
            FROM staging.stg_em6__regional_prices
        )
        ORDER BY gz.island DESC, gz.grid_zone_name
    """)

    if not results:
        raise HTTPException(
            status_code=404,
            detail="No regional price data available"
        )

    return results

@router.get("/prices/summary", response_model = list[DailySummary])
def get_daily_summary(days: int = 30):
    """
    Daily aggregated price and carbon summary.
    Powers: historical trend chart.
    """

    results = query_many("""
        SELECT
            date_nzt::text,
            avg_carbon_gkwh,
            avg_renewable_pct,
            avg_price_ota,
            avg_price_hay,
            avg_price_ben,
            max_price_ota,
            min_price_ota,
            ni_si_spread,
            grid_status
        FROM marts.mart_daily_summary
        WHERE date_nzt >= CURRENT_DATE - INTERVAL '1 day' * %s
        ORDER BY date_nzt ASC
    """, (days,))

    return results