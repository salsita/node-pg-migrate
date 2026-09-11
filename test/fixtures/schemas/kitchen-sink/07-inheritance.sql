-- Kitchen sink, family: table inheritance. A parent with two children, an
-- inherited CHECK constraint and a NO INHERIT one.

CREATE TABLE kitchen.vehicles (
    id bigserial PRIMARY KEY,
    wheels smallint NOT NULL CONSTRAINT vehicles_wheels_check CHECK (wheels >= 0),
    plate text,
    registered_on date
);

CREATE TABLE kitchen.trucks (
    payload_kg integer NOT NULL CHECK (payload_kg > 0)
) INHERITS (kitchen.vehicles);

CREATE TABLE kitchen.buses (
    seats integer NOT NULL DEFAULT 40,
    CONSTRAINT buses_plate_required CHECK (plate IS NOT NULL) NO INHERIT
) INHERITS (kitchen.vehicles);
