# ============================================================
# api/routers/carbon.py
# Endpoints:
#   GET /api/carbon/latest:  live carbon + renewable metrics
#   GET /api/carbon/trend: last 7 days carbon trend
# ============================================================

from fastapi import APIRouter, HTTPException
from api.database import query_one, query_many
from api.models import CarbonLatest, CarbonTrendPoint

router = APIRouter()

@router.get("/carbon/latest", response_model=CarbonLatest)
def get_carbon_latest():
    """
    Latest carbon intensity and renewable metrics.
    Powers: renewable gauge, carbon reading, grid status pannel.
    """

    result = query_one("""
        SELECT
            timestamp_utc,
            timestamp_nzt,
            trading_period,
            period_label,
            nz_carbon_gkwh,
            nz_carbon_change_gkwh,
            nz_carbon_t,
            renewable_pct,
            grid_status,
            carbon_status,
            carbon_trend,
            vs_month_avg_pct,
            max_24hrs_gkwh,
            min_24hrs_gkwh,
            current_month_avg_gkwh,
            current_year_avg_gkwh,
            pct_current_year_gkwh,
            position_in_24hr_range
        FROM marts.mart_carbon_intensity
        ORDER BY timestamp_utc DESC
        LIMIT 1
    """)

    if not result:
        raise HTTPException(
            status_code = 404,
            detail = "No carbon intensity data available"
        )
    
    return result 

@router.get("/carbon/trend", response_model=list[CarbonTrendPoint])
def get_carbon_trend(hours: int = 168):
    """
    Carbon intensity trend for the last N hours (default 7 days).
    Powers: carbon intensity line chart.
    """

    results = query_many("""
        SELECT
            timestamp_utc,
            timestamp_nzt,
            trading_period,
            nz_carbon_gkwh,
            renewable_pct,
            carbon_status,
            grid_status
        FROM marts.mart_carbon_intensity
        WHERE timestamp_utc > NOW() - INTERVAL '1 hour' * %s
        ORDER BY timestamp_utc ASC
    """, (hours,))

    return results 

