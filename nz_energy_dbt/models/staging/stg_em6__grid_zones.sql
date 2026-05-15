-- ============================================================
-- stg_em6__grid_zones
-- Source: public.grid_zones (static reference)
-- Used by stg_em6__regional_prices as a lookup
-- ============================================================

with source as (
    select * 
    from {{ source('em6', 'grid_zones') }}
)

select 
    grid_zone_id,
    grid_zone_name,
    island
from source
