# ============================================================
# api/routers/spread.py
# Endpoints:
#   GET /api/spread/latest   → current NI/SI price spread
#   GET /api/spread/trend    → spread history (24hrs)
# ============================================================
from fastapi import APIRouter, HTTPException
from api.database import query_one, query_many
from api.models import SpreadLatest 

router = APIRouter()

@router.get("/spread/latest", response_model = SpreadLatest)
def get_spread_latest():
    """
    Current North vs South Island price spread.
    Powers: HVDC constraint indicator panel.
    """

    result = query_one("""
        SELECT
            timestamp_utc,
            timestamp_nzt,
            trading_period,
            ota_price,
            ben_price,
            hay_price,
            ni_si_spread,
            spread_abs,
            spread_direction,
            spread_status,
            spread_pct
        FROM marts.mart_ni_si_spread
        ORDER BY timestamp_utc DESC
        LIMIT 1
    """)

    if not result:
        raise HTTPException(
            status_code = 404,
            detail = "No spread data available"
        )
    
    return result 

@router.get("/spread/trend", response_model=list[SpreadLatest])
def get_spread_trend(hours: int = 24):
    """
    NI/SI price spread for the last N hours (default 24hrs).
    Powers: spread trend chart.
    """
    results = query_many("""
        SELECT
            timestamp_utc,
            timestamp_nzt,
            trading_period,
            ota_price,
            ben_price,
            hay_price,
            ni_si_spread,
            spread_abs,
            spread_direction,
            spread_status,
            spread_pct
        FROM marts.mart_ni_si_spread
        WHERE timestamp_utc > NOW() - INTERVAL '1 hour' * %s
        ORDER BY timestamp_utc ASC
    """, (hours,))

    return results