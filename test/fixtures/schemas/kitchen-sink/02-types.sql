-- Kitchen sink, family: types. Enums (one extended with ADD VALUE), a
-- composite type, domains with CHECK, DEFAULT, NOT NULL and a collation, a
-- range type (PostgreSQL 14+ adds its multirange type) and a collation.

CREATE TYPE kitchen.mood AS ENUM ('sad', 'ok', 'happy');

ALTER TYPE kitchen.mood ADD VALUE 'ecstatic' AFTER 'happy';

ALTER TYPE kitchen.mood ADD VALUE 'meh' BEFORE 'ok';

CREATE TYPE kitchen.order_status AS ENUM ('new', 'paid', 'shipped', 'cancelled');

CREATE TYPE kitchen.postal_address AS (
    street text,
    city text,
    postal_code varchar(12),
    country char(2)
);

CREATE DOMAIN kitchen.email_address AS text COLLATE "C"
    CONSTRAINT email_address_format CHECK (VALUE ~ '^[^@[:space:]]+@[^@[:space:]]+$');

CREATE DOMAIN kitchen.money_amount AS numeric(12,2)
    DEFAULT 0
    NOT NULL
    CONSTRAINT money_amount_not_negative CHECK (VALUE >= 0);

CREATE TYPE kitchen.float_range AS RANGE (
    subtype = float8,
    subtype_diff = float8mi
);

CREATE COLLATION kitchen.bytewise (provider = libc, locale = 'C');
