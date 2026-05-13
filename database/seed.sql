-- ============================================================
-- NZ Electricity Dashboard — Seed Data
-- Version: 1.0
-- Last updated: 2026-05
-- Description: Static reference data for grid_zones table.
--              Run once after schema.sql during DB setup.
--              Safe to re-run (ON CONFLICT DO NOTHING).
--
-- Source: em6 /region/price/ API
--         grid_zone_id and grid_zone_name observed from
--         live API response during exploration phase.
--         See notebooks/00_explore.ipynb for reference.
-- ============================================================

BEGIN;

-- ============================================================
-- grid_zones
-- 14 NZ electricity grid zones across North and South Island
-- grid_zone_id matches the numeric ID returned by em6 API
-- ============================================================

INSERT INTO grid_zones (grid_zone_id, grid_zone_name, island)
VALUES
    -- North Island (8 zones)
    (1, 'Northland', 'NI'),
    (2, 'Auckland', 'NI'),
    (3, 'Hamilton', 'NI'),
    (4, 'Edgecumbe', 'NI'),
    (5,  'Rotorua', 'NI'),
    (6,  'Hawkes Bay','NI'),
    (7,  'Bunnythorpe', 'NI'),
    (8,  'Wellington', 'NI'),

    -- South Island (6 zones)
    (9, 'Nelson', 'SI'),
    (10,'Christchurch', 'SI'),
    (11, 'Canterbury', 'SI'),
    (12, 'Waitaki', 'SI'),
    (13, 'Otago','SI'),
    (14, 'Invercargill', 'SI')

ON CONFLICT (gird_zone_id) DO NOTHING;

COMMIT;

-- ============================================================
-- node_reference
-- 6 key pricing nodes used in em6 free tier
-- Not a FK-enforced table — used for display/labelling only
-- ============================================================
CREATE TABLE IF NOT EXISTS node_reference (
    node_id VARCHAR(10) PRIMARY KEY,
    city_name VARCHAR(50) NOT NULL,
    island VARCHAR(2) NOT NULL,
    is_reference BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT chk_node_island CHECK (island IN ('NI', 'SI'))
); 

COMMENT ON TABLE  node_reference IS 'Display metadata for 6 key em6 pricing nodes.';
COMMENT ON COLUMN node_reference.node_id IS 'Node code as returned by em6 API e.g. OTA2201.';
COMMENT ON COLUMN node_reference.city_name IS 'Human readable city name for dashboard display.';
COMMENT ON COLUMN node_reference.island IS 'NI = North Island, SI = South Island.';
COMMENT ON COLUMN node_reference.is_reference IS 'True = one of the 3 main em6 reference nodes (OTA, HAY, BEN).';

INSERT INTO node_reference (node_id, city_name, island, is_reference)
VALUES 
    ('OTA2201', 'Auckland',      'NI', TRUE),
    ('WKM2201', 'Waikato',       'NI', FALSE),
    ('KIK2201', 'Kikiwhenua',    'NI', FALSE),
    ('HAY2201', 'Wellington',    'NI', TRUE),
    ('ISL2201', 'Islington',     'SI', FALSE),
    ('BEN2201', 'Benmore',       'SI', TRUE)

ON CONFLICT (node_id) DO NOTHING;

COMMIT;

