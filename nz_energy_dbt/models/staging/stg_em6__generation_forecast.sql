-- ============================================================
-- stg_em6__generation_forecast
-- Source: public.generation_forecast (raw)
-- Adds: generation_type_label, region_label
-- ============================================================

with source as (
    select * from {{ source('em6', 'generation_forecast') }}
),

staged as (
    select
        -- primary key
        timestamp                                           as timestamp_utc,
        region,
        generation_type,

        -- time dimensions
        trading_period,
        timestamp + interval '12 hours'                    as timestamp_nzt,

        -- human readable labels
        case generation_type
            when 'WIN' then 'Wind'
            when 'SOL' then 'Solar'
        end                                                as generation_label,

        case region
            when 'NI' then 'North Island'
            when 'SI' then 'South Island'
            when 'NZ' then 'New Zealand'
        end                                                as region_label,

        -- generation metrics (all in MW)
        forecast_mw,
        potential_forecast_mw,
        cleared_mw,
        shortfall_mw,

        -- derived: forecast accuracy %
        case
            when cleared_mw > 0
            then round((forecast_mw / cleared_mw * 100)::numeric, 2)
        end                                                as forecast_accuracy_pct,

        -- audit
        ingested_at

    from source
)

select * from staged