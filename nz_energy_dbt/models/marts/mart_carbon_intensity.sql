-- ============================================================
-- mart_carbon_intensity
-- Source: stg_em6__carbon_intensity
-- Purpose: Live carbon + renewable metrics for dashboard panels
-- Materialized: table (fast reads for live dashboard)
-- ============================================================

with staged as (
    select *
    from {{ ref('stg_em6__carbon_intensity') }}
),

enriched as (
    select
        -- timestamps
        timestamp_utc,
        timestamp_nzt,
        trading_period,
        trading_date,
        period_label,

        -- carbon metrics
        nz_carbon_gkwh,
        nz_carbon_change_gkwh,
        nz_carbon_t,

        -- renewable
        renewable_pct,

        -- 24hr context
        max_24hrs_gkwh,
        min_24hrs_gkwh,

        -- benchmarks
        current_month_avg_gkwh,
        current_year_avg_gkwh,
        pct_current_year_gkwh,

        -- derived: how clean is the grid right now?
        case
            when renewable_pct >= 90 then 'Very Clean'
            when renewable_pct >= 75 then 'Clean'
            when renewable_pct >= 50 then 'Moderate'
            else                          'Dirty'
        end  as grid_status,

        -- derived: carbon status label
        case
            when nz_carbon_gkwh < 50  then 'Clean'
            when nz_carbon_gkwh < 100 then 'Moderate'
            else                           'Dirty'
        end as carbon_status,

        -- derived: trend arrow direction
        case
            when nz_carbon_change_gkwh < 0 then 'Improving'
            when nz_carbon_change_gkwh > 0 then 'Worsening'
            else                                 'Stable'
        end as carbon_trend,

        -- derived: how does current compare to month average?
        case
            when current_month_avg_gkwh > 0
            then round(
                ((nz_carbon_gkwh - current_month_avg_gkwh)
                / current_month_avg_gkwh * 100)::numeric, 2)
        end as vs_month_avg_pct,

        -- derived: position within 24hr range (0=cleanest, 100=dirtiest)
        case
            when (max_24hrs_gkwh - min_24hrs_gkwh) > 0
            then round(
                ((nz_carbon_gkwh - min_24hrs_gkwh)
                / (max_24hrs_gkwh - min_24hrs_gkwh) * 100)::numeric, 2)
        end as position_in_24hr_range,

        ingested_at

    from staged
)

select * from enriched
order by timestamp_utc desc