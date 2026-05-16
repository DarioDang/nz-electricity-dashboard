# ============================================================
# api/routers/health.py
# GET /api/health — confirms API and DB are working
# ============================================================
from fastapi import APIRouter, HTTPException
from api.database import query_one 
from api.models import HealthCheck

router = APIRouter()

@router.get("/health", response_model=HealthCheck)
def health_check():
    """
    Health check endpoint.
    Verifies API is running and database is reachable.
    """
    try:
        result = query_one("""
            SELECT
                COUNT(*)                            AS rows_today,
                MAX(ingested_at)::text              AS latest_data
            FROM public.carbon_intensity
            WHERE ingested_at > NOW() - INTERVAL '24 hours'
        """)

        return HealthCheck(
            status="healthy",
            database="connected",
            latest_data=result.get("latest_data"),
            rows_today=int(result.get("rows_today", 0))
        )

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {str(e)}"
        )                          