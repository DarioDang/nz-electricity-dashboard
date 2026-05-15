-- ============================================================
-- stg_em6__reserve_prices
-- Source: public.reserve_prices (raw)
-- Adds: region_label, grid_stress_indicator
-- ============================================================
with source as (
    select * 
    from {{ source('em6', 'reserve_prices') }}
),

staged as (
    select
        -- primary key
        timestamp as timestamp_utc,
        region,

        -- time dimensions
        trading_date,
        trading_period,
        timestamp + interval '12 hours' as timestamp_nzt,

        -- human readable label
        case region
            when 'NI' then 'North Island'
            when 'SI' then 'South Island'
        end as region_label,

        -- reserve prices
        sir_price,
        fir_price,

        -- derived: total reserve cost
        sir_price + fir_price as total_reserve_price,

        -- grid stress indicator based on reserve price levels
        -- high reserve prices = grid under stress
        case 
            when fir_price > 20 then 'High'
            when fir_price > 10 then 'Medium'
            else 'Normal'
        end as grid_stress,

        -- audit
        ingested_at
    
    from source
)

select *
from staged 