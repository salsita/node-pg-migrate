-- Kitchen sink, family: declarative partitioning. RANGE with a DEFAULT
-- partition, LIST with a HASH-partitioned partition, primary keys and an
-- index on the partitioned tables, a foreign key from a partitioned table and
-- a row trigger on a partitioned table.

CREATE TABLE kitchen.sensors (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label text NOT NULL
);

CREATE TABLE kitchen.measurements (
    sensor_id integer NOT NULL REFERENCES kitchen.sensors (id),
    measured_at timestamptz NOT NULL,
    value double precision,
    PRIMARY KEY (sensor_id, measured_at)
) PARTITION BY RANGE (measured_at);

CREATE TABLE kitchen.measurements_2025 PARTITION OF kitchen.measurements
    FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');

CREATE TABLE kitchen.measurements_2026 PARTITION OF kitchen.measurements
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE kitchen.measurements_default PARTITION OF kitchen.measurements DEFAULT;

CREATE INDEX measurements_value_idx ON kitchen.measurements (value);

CREATE TRIGGER measurements_clamp BEFORE INSERT OR UPDATE ON kitchen.measurements
    FOR EACH ROW EXECUTE FUNCTION kitchen.clamp_measurement();

CREATE TABLE kitchen.orders_by_region (
    region text NOT NULL,
    order_id bigint NOT NULL,
    placed_on date NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (region, order_id)
) PARTITION BY LIST (region);

CREATE TABLE kitchen.orders_by_region_eu PARTITION OF kitchen.orders_by_region
    FOR VALUES IN ('de', 'fr', 'pt')
    PARTITION BY HASH (order_id);

CREATE TABLE kitchen.orders_by_region_eu_0 PARTITION OF kitchen.orders_by_region_eu
    FOR VALUES WITH (MODULUS 2, REMAINDER 0);

CREATE TABLE kitchen.orders_by_region_eu_1 PARTITION OF kitchen.orders_by_region_eu
    FOR VALUES WITH (MODULUS 2, REMAINDER 1);

CREATE TABLE kitchen.orders_by_region_other PARTITION OF kitchen.orders_by_region DEFAULT;
