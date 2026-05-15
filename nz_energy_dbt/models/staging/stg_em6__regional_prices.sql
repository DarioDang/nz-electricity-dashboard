-- ============================================================
-- stg_em6__regional_prices
-- Source: public.regional_prices (raw)
-- Joins with grid_zones to add zone name and island
-- ============================================================

with source as (
    select * from {{ source('em6', 'regional_prices') }}
),

grid_zones as (
    select
        grid_zone_id,
        grid_zone_name,
        island
    from {{ ref('stg_em6__grid_zones') }}
),

staged as (
    select
        -- primary key
        rp.timestamp                                        as timestamp_utc,
        rp.grid_zone_id,

        -- time dimensions
        rp.trading_period,
        rp.timestamp + interval '12 hours'                  as timestamp_nzt,

        -- enriched with zone metadata
        gz.grid_zone_name,
        gz.island,

        -- price
        rp.price                                            as price_nzd_mwh,

        -- audit
        rp.ingested_at

    from source rp
    left join grid_zones gz using (grid_zone_id)
)

select * from staged