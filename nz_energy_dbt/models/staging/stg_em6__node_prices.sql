-- ============================================================
-- stg_em6__node_prices
-- Source: public.node_prices (raw)
-- Adds: city_name, island for dashboard display
-- ============================================================

with source as (
    select * from {{ source('em6', 'node_prices') }}
),

staged as (
    select
        -- primary key
        timestamp                                           as timestamp_utc,
        node_id,

        -- time dimensions
        trading_period,
        timestamp + interval '12 hours'                    as timestamp_nzt,

        -- price
        price                                              as price_nzd_mwh,

        -- enrich with human readable labels
        case node_id
            when 'OTA2201' then 'Auckland'
            when 'HAY2201' then 'Wellington'
            when 'BEN2201' then 'Benmore'
            when 'WKM2201' then 'Waikato'
            when 'KIK2201' then 'Kikiwhenua'
            when 'ISL2201' then 'Islington'
        end                                                as city_name,

        case node_id
            when 'OTA2201' then 'NI'
            when 'HAY2201' then 'NI'
            when 'WKM2201' then 'NI'
            when 'KIK2201' then 'NI'
            when 'BEN2201' then 'SI'
            when 'ISL2201' then 'SI'
        end                                                as island,

        -- flag the 3 main reference nodes
        case
            when node_id in ('OTA2201', 'HAY2201', 'BEN2201') then true
            else false
        end                                                as is_reference_node,

        -- audit
        ingested_at

    from source
)

select * from staged