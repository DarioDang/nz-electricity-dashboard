# ============================================================
# api/routers/reserves.py
# Endpoints:
#   GET /api/reserves/latest  → current NI/SI reserve prices
# ============================================================
from fastapi import APIRouter, HTTPException
from api.database import query_many
from api.models import ReserveLatest 

router = APIRouter()

@router.get("/reserves/latest", response_model = list[ReserveLatest])
def get_reserves_latest():
    """
    Current reserve prices for North and South Island.
    Powers: grid stress indicator panel.
    """

    results = query_many("""
        SELECT
            timestamp_utc,
            timestamp_nzt,
            trading_period,
            region,
            region_label,
            sir_price,
            fir_price,
            total_reserve_price,
            grid_stress
        FROM staging.stg_em6__reserve_prices
        WHERE timestamp_utc = (
            SELECT MAX(timestamp_utc)
            FROM staging.stg_em6__reserve_prices
        )
        ORDER BY region
    """)

    if not results:
        raise HTTPException(
            status_code = 404,
            detail = "No reserve price data available"
        )
    
    return results 