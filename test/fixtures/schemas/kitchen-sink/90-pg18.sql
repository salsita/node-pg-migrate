-- requires: 18
-- Kitchen sink, family: PostgreSQL 18 only. A virtual generated column and a
-- uuidv7() default. loadFixture() in test/integration/utils.ts, and so the
-- dump capture, skips this file on older servers because of the first line.

CREATE TABLE kitchen.pg18_parcels (
    id uuid DEFAULT uuidv7() NOT NULL PRIMARY KEY,
    width_cm numeric(8,2) NOT NULL,
    height_cm numeric(8,2) NOT NULL,
    area_cm2 numeric GENERATED ALWAYS AS (width_cm * height_cm) VIRTUAL
);

COMMENT ON COLUMN kitchen.pg18_parcels.area_cm2 IS 'Virtual generated column (PostgreSQL 18+)';
