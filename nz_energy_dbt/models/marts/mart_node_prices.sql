-- ============================================================
-- mart_node_prices
-- Source: stg_em6__node_prices
-- Purpose: 24hr price trends per node for line chart
-- Materialized: table
-- ============================================================

with staged as (
    select * from {{ ref('stg_em6__node_prices') }}
),

enriched as (
    select
        -- identifiers
        timestamp_utc,
        timestamp_nzt,
        trading_period,
        node_id,
        city_name,
        island,
        is_reference_node,

        -- price
        price_nzd_mwh,

        -- derived: price category for colour coding on dashboard
        case
            when price_nzd_mwh < 50   then 'Low'
            when price_nzd_mwh < 100  then 'Medium'
            when price_nzd_mwh < 200  then 'High'
            else                           'Spike'
        end  as price_category,

        -- derived: price rank within trading period (1=cheapest)
        rank() over (
            partition by timestamp_utc
            order by price_nzd_mwh asc
        ) as price_rank,

        -- derived: rolling 24hr average per node
        avg(price_nzd_mwh) over (
            partition by node_id
        )  as avg_24hr_price,

        -- derived: how far from node's 24hr average
        round(
            (price_nzd_mwh - avg(price_nzd_mwh) over (
                partition by node_id
            ))::numeric, 2
        ) as deviation_from_avg,

        ingested_at

    from staged
),

-- add 24hr min/max per node for context
with_range as (
    select
        e.*,
        min(price_nzd_mwh) over (
            partition by node_id
        ) as min_24hr_price,
        max(price_nzd_mwh) over (
            partition by node_id
        ) as max_24hr_price
    from enriched e
)

select * from with_range
order by timestamp_utc desc, node_id