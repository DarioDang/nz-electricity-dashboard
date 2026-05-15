-- ============================================================
-- mart_daily_summary
-- Sources: stg_em6__carbon_intensity, stg_em6__node_prices
-- Purpose: One row per day for historical trend charts
-- Materialized: table (never purged)
-- ============================================================

with carbon as (
    select
        date(timestamp_nzt)                             as date_nzt,
        round(avg(nz_carbon_gkwh)::numeric, 4)         as avg_carbon_gkwh,
        round(max(nz_carbon_gkwh)::numeric, 4)         as max_carbon_gkwh,
        round(min(nz_carbon_gkwh)::numeric, 4)         as min_carbon_gkwh,
        round(avg(renewable_pct)::numeric, 4)           as avg_renewable_pct,
        round(max(renewable_pct)::numeric, 4)           as peak_renewable_pct,
        round(min(renewable_pct)::numeric, 4)           as min_renewable_pct,
        count(*)                                        as trading_periods_count
    from {{ ref('stg_em6__carbon_intensity') }}
    group by 1
),

node_prices as (
    select
        date(timestamp_nzt)                             as date_nzt,
        -- reference node averages
        round(avg(case when node_id = 'OTA2201'
            then price_nzd_mwh end)::numeric, 4)       as avg_price_ota,
        round(avg(case when node_id = 'HAY2201'
            then price_nzd_mwh end)::numeric, 4)       as avg_price_hay,
        round(avg(case when node_id = 'BEN2201'
            then price_nzd_mwh end)::numeric, 4)       as avg_price_ben,
        -- daily high/low at Auckland
        round(max(case when node_id = 'OTA2201'
            then price_nzd_mwh end)::numeric, 4)       as max_price_ota,
        round(min(case when node_id = 'OTA2201'
            then price_nzd_mwh end)::numeric, 4)       as min_price_ota
    from {{ ref('stg_em6__node_prices') }}
    group by 1
),

joined as (
    select
        c.date_nzt,
        -- carbon
        c.avg_carbon_gkwh,
        c.max_carbon_gkwh,
        c.min_carbon_gkwh,
        -- renewable
        c.avg_renewable_pct,
        c.peak_renewable_pct,
        c.min_renewable_pct,
        -- prices
        np.avg_price_ota,
        np.avg_price_hay,
        np.avg_price_ben,
        np.max_price_ota,
        np.min_price_ota,
        -- derived: NI/SI spread
        round(
            (np.avg_price_ota - np.avg_price_ben)::numeric, 4
        )                                               as ni_si_spread,
        -- derived: dominant grid status for the day
        case
            when c.avg_renewable_pct >= 90 then 'Very Clean'
            when c.avg_renewable_pct >= 75 then 'Clean'
            when c.avg_renewable_pct >= 50 then 'Moderate'
            else                                'Dirty'
        end  as grid_status,
        c.trading_periods_count
    from carbon c
    left join node_prices np using (date_nzt)
)

select * from joined
order by date_nzt desc