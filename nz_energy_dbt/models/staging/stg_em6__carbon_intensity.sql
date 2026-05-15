-- ============================================================
-- stg_em6__carbon_intensity
-- Source: public.carbon_intensity (raw)
-- Adds: nzt_timestamp, period_label for dashboard display
-- ============================================================

with source as (
    select * from {{ source('em6', 'carbon_intensity') }}
),

staged as (
    select
        -- primary key
        timestamp                                           as timestamp_utc,

        -- time dimensions
        trading_date,
        trading_period,
        -- convert UTC to NZT (UTC+12) for display
        timestamp + interval '12 hours'                    as timestamp_nzt,
        -- human readable period label e.g. "TP31 (15:00 NZT)"
        'TP' || trading_period || ' (' ||
            lpad(((trading_period - 1) * 30 / 60)::text, 2, '0') || ':' ||
            lpad((((trading_period - 1) * 30) % 60)::text, 2, '0') ||
            ' NZT)'                                        as period_label,

        -- carbon metrics
        nz_carbon_t,
        nz_carbon_gkwh,
        nz_carbon_change_gkwh,

        -- renewable metrics
        nz_renewable                                       as renewable_pct,

        -- 24hr context
        max_24hrs_gkwh,
        min_24hrs_gkwh,

        -- benchmarks
        current_month_avg_gkwh,
        current_year_avg_gkwh,
        pct_current_year_gkwh,

        -- audit
        ingested_at

    from source
)

select * from staged