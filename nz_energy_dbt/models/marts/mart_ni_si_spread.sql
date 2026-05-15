-- ============================================================
-- mart_ni_si_spread
-- Source: stg_em6__node_prices
-- Purpose: North vs South Island price spread per period
--          Large spread = HVDC constraint signal
-- Materialized: table
-- ============================================================

with node_prices as (
    select * from {{ ref('stg_em6__node_prices') }}
),

-- pivot to get OTA and BEN side by side per period
pivoted as (
    select
        timestamp_utc,
        timestamp_nzt,
        trading_period,
        -- North Island reference node (Auckland)
        max(case when node_id = 'OTA2201'
            then price_nzd_mwh end) as ota_price,
        -- South Island reference node (Benmore)
        max(case when node_id = 'BEN2201'
            then price_nzd_mwh end) as ben_price,
        -- Wellington as secondary NI reference
        max(case when node_id = 'HAY2201'
            then price_nzd_mwh end) as hay_price
    from node_prices
    group by 1, 2, 3
),

enriched as (
    select
        timestamp_utc,
        timestamp_nzt,
        trading_period,

        -- prices
        ota_price,
        ben_price,
        hay_price,

        -- derived: NI/SI spread (key NZ market signal)
        round((ota_price - ben_price)::numeric, 4) as ni_si_spread,

        -- derived: absolute spread
        round(abs(ota_price - ben_price)::numeric, 4) as spread_abs,

        -- derived: spread direction
        case
            when ota_price > ben_price then 'NI Premium'
            when ben_price > ota_price then 'SI Premium'
            else                            'Balanced'
        end as spread_direction,

        -- derived: HVDC constraint signal
        -- spread > $50 typically indicates transmission constraint
        case
            when abs(ota_price - ben_price) > 100 then 'Constrained'
            when abs(ota_price - ben_price) > 50  then 'Elevated'
            else                                        'Normal'
        end as spread_status,

        -- derived: spread as % of SI price
        case
            when ben_price > 0
            then round(
                ((ota_price - ben_price) / ben_price * 100)::numeric, 2)
        end as spread_pct

    from pivoted
    where ota_price is not null
      and ben_price is not null
)

select * from enriched
order by timestamp_utc desc