--
-- PostgreSQL database dump
--

\restrict 0QmmktSHUz8KSvfK4nKJjy86XUgk3Qu54OJ1SucARGkrvjrS1ilsCAX8UfvSqoi

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Sink Área; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "Sink Área";


--
-- Name: kitchen; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA kitchen;


--
-- Name: SCHEMA kitchen; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA kitchen IS 'Kitchen-sink fixture for the node-pg-migrate baseline tests';


--
-- Name: kitchen_audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA kitchen_audit;


--
-- Name: SCHEMA kitchen_audit; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA kitchen_audit IS 'Audit trail';


--
-- Name: bytewise; Type: COLLATION; Schema: kitchen; Owner: -
--

CREATE COLLATION kitchen.bytewise (provider = libc, locale = 'C');


--
-- Name: COLLATION bytewise; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON COLLATION kitchen.bytewise IS 'Byte-wise ordering';


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA kitchen;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: email_address; Type: DOMAIN; Schema: kitchen; Owner: -
--

CREATE DOMAIN kitchen.email_address AS text COLLATE pg_catalog."C"
	CONSTRAINT email_address_format CHECK ((VALUE ~ '^[^@[:space:]]+@[^@[:space:]]+$'::text));


--
-- Name: DOMAIN email_address; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON DOMAIN kitchen.email_address IS 'A very loose e-mail check';


--
-- Name: float_range; Type: TYPE; Schema: kitchen; Owner: -
--

CREATE TYPE kitchen.float_range AS RANGE (
    subtype = double precision,
    multirange_type_name = kitchen.float_multirange,
    subtype_diff = float8mi
);


--
-- Name: TYPE float_range; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON TYPE kitchen.float_range IS 'A range of double precision values';


--
-- Name: money_amount; Type: DOMAIN; Schema: kitchen; Owner: -
--

CREATE DOMAIN kitchen.money_amount AS numeric(12,2) NOT NULL DEFAULT 0
	CONSTRAINT money_amount_not_negative CHECK ((VALUE >= (0)::numeric));


--
-- Name: mood; Type: TYPE; Schema: kitchen; Owner: -
--

CREATE TYPE kitchen.mood AS ENUM (
    'sad',
    'meh',
    'ok',
    'happy',
    'ecstatic'
);


--
-- Name: TYPE mood; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON TYPE kitchen.mood IS 'How a customer feels';


--
-- Name: order_status; Type: TYPE; Schema: kitchen; Owner: -
--

CREATE TYPE kitchen.order_status AS ENUM (
    'new',
    'paid',
    'shipped',
    'cancelled'
);


--
-- Name: postal_address; Type: TYPE; Schema: kitchen; Owner: -
--

CREATE TYPE kitchen.postal_address AS (
	street text,
	city text,
	postal_code character varying(12),
	country character(2)
);


--
-- Name: TYPE postal_address; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON TYPE kitchen.postal_address IS 'A postal address';


--
-- Name: check_order_line(); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.check_order_line() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.quantity > 1000 THEN
        RAISE EXCEPTION 'order % line %: quantity % is too large',
            NEW.order_id, NEW.line_no, NEW.quantity;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: clamp_measurement(); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.clamp_measurement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.value IS NOT NULL THEN
        NEW.value := greatest(least(NEW.value, 1e6), -1e6);
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: current_tenant(); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.current_tenant() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
    SELECT nullif(current_setting('kitchen.tenant_id', true), '')::integer
$$;


--
-- Name: customer_order_total(bigint); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.customer_order_total(p_customer_id bigint) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
    SELECT coalesce(sum(o.total), 0)
    FROM kitchen.orders AS o
    WHERE o.customer_id = p_customer_id
      AND o.status <> 'cancelled'
$$;


--
-- Name: FUNCTION customer_order_total(p_customer_id bigint); Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON FUNCTION kitchen.customer_order_total(p_customer_id bigint) IS 'Sum of the orders of a customer that are not cancelled';


--
-- Name: describe_price(numeric); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.describe_price(p_price numeric) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
    label text := 'price; not the end of a statement'; -- a comment; with a semicolon
BEGIN
    /* a block comment; also with a semicolon */
    IF p_price IS NULL THEN
        RETURN $q$n/a$q$;
    END IF;
    RETURN format(E'%s EUR\t(%s)', p_price, label);
END;
$_$;


--
-- Name: insert_order_summary(); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.insert_order_summary() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO kitchen.orders (customer_id, total)
    VALUES (NEW.customer_id, NEW.total)
    RETURNING id INTO NEW.id;
    RETURN NEW;
END;
$$;


--
-- Name: join_nonempty(text, text[]); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.join_nonempty(sep text, VARIADIC parts text[]) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT string_agg(p, sep) FROM unnest(parts) AS p WHERE p <> ''
$$;


--
-- Name: invoice_number; Type: SEQUENCE; Schema: kitchen; Owner: -
--

CREATE SEQUENCE kitchen.invoice_number
    AS integer
    START WITH 1000
    INCREMENT BY 10
    MINVALUE 1000
    MAXVALUE 999990
    CACHE 5
    CYCLE;


--
-- Name: SEQUENCE invoice_number; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON SEQUENCE kitchen.invoice_number IS 'Cycles back to 1000';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: orders; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.orders (
    id bigint NOT NULL,
    customer_id bigint NOT NULL,
    status kitchen.order_status DEFAULT 'new'::kitchen.order_status NOT NULL,
    total kitchen.money_amount,
    ticket_no bigint NOT NULL,
    invoice_no integer DEFAULT nextval('kitchen.invoice_number'::regclass),
    placed_at timestamp with time zone DEFAULT now() NOT NULL,
    shipped_at timestamp with time zone,
    CONSTRAINT orders_shipped_after_placed CHECK (((shipped_at IS NULL) OR (shipped_at >= placed_at)))
);


--
-- Name: CONSTRAINT orders_shipped_after_placed ON orders; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON CONSTRAINT orders_shipped_after_placed ON kitchen.orders IS 'Nothing ships before it is placed';


--
-- Name: order_count(bigint); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.order_count(p_customer_id bigint) RETURNS bigint
    LANGUAGE sql STABLE
    BEGIN ATOMIC
 SELECT count(*) AS count
    FROM kitchen.orders
   WHERE (orders.customer_id = order_count.p_customer_id);
END;


--
-- Name: pipe_concat(text, text); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.pipe_concat(state text, next text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT CASE WHEN state IS NULL THEN next ELSE state || '|' || next END
$$;


--
-- Name: purge_cancelled_orders(timestamp with time zone, integer); Type: PROCEDURE; Schema: kitchen; Owner: -
--

CREATE PROCEDURE kitchen.purge_cancelled_orders(IN p_before timestamp with time zone, INOUT p_purged integer DEFAULT 0)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM kitchen.orders WHERE placed_at < p_before AND status = 'cancelled';
    GET DIAGNOSTICS p_purged = ROW_COUNT;
END;
$$;


--
-- Name: PROCEDURE purge_cancelled_orders(IN p_before timestamp with time zone, INOUT p_purged integer); Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON PROCEDURE kitchen.purge_cancelled_orders(IN p_before timestamp with time zone, INOUT p_purged integer) IS 'Deletes old cancelled orders';


--
-- Name: recent_orders(integer); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.recent_orders(p_days integer DEFAULT 30) RETURNS TABLE(order_id bigint, placed_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT o.id, o.placed_at
    FROM kitchen.orders AS o
    WHERE o.placed_at > now() - make_interval(days => p_days)
$$;


--
-- Name: roughly_equal(numeric, numeric); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.roughly_equal(a numeric, b numeric) RETURNS boolean
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
    SELECT abs(a - b) < 0.01
$$;


--
-- Name: split_name(text); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.split_name(full_name text, OUT first_name text, OUT last_name text) RETURNS record
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
    SELECT split_part(full_name, ' ', 1),
           nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), '')
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: kitchen; Owner: -
--

CREATE FUNCTION kitchen.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


--
-- Name: log_statement(); Type: FUNCTION; Schema: kitchen_audit; Owner: -
--

CREATE FUNCTION kitchen_audit.log_statement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO kitchen_audit.events (table_name, operation, row_count)
    SELECT TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_OP, count(*) FROM new_rows;
    RETURN NULL;
END;
$$;


--
-- Name: pipe_agg(text); Type: AGGREGATE; Schema: kitchen; Owner: -
--

CREATE AGGREGATE kitchen.pipe_agg(text) (
    SFUNC = kitchen.pipe_concat,
    STYPE = text
);


--
-- Name: AGGREGATE pipe_agg(text); Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON AGGREGATE kitchen.pipe_agg(text) IS 'Joins values with |';


--
-- Name: =~=; Type: OPERATOR; Schema: kitchen; Owner: -
--

CREATE OPERATOR kitchen.=~= (
    FUNCTION = kitchen.roughly_equal,
    LEFTARG = numeric,
    RIGHTARG = numeric
);


--
-- Name: OPERATOR =~= (numeric, numeric); Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON OPERATOR kitchen.=~= (numeric, numeric) IS 'Equal within 0.01';


--
-- Name: Order; Lines; Type: TABLE; Schema: Sink Área; Owner: -
--

CREATE TABLE "Sink Área"."Order; Lines" (
    "Id" integer NOT NULL,
    "select" text DEFAULT 'semi; colon -- not a comment /* nor this */'::text NOT NULL,
    "a ""quoted"" column" text,
    "$$not a dollar quote$$" text,
    "-- not a comment" integer,
    CONSTRAINT "Order; Lines_-- not a comment_check" CHECK (("-- not a comment" >= 0))
);


--
-- Name: TABLE "Order; Lines"; Type: COMMENT; Schema: Sink Área; Owner: -
--

COMMENT ON TABLE "Sink Área"."Order; Lines" IS 'First line;
\connect is only text here, inside a string literal
It''s one string: $$ -- /* */';


--
-- Name: From; View; Type: VIEW; Schema: Sink Área; Owner: -
--

CREATE VIEW "Sink Área"."From; View" AS
 SELECT "Id",
    "select" AS "from"
   FROM "Sink Área"."Order; Lines";


--
-- Name: Order; Lines_Id_seq; Type: SEQUENCE; Schema: Sink Área; Owner: -
--

ALTER TABLE "Sink Área"."Order; Lines" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "Sink Área"."Order; Lines_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customers; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.customers (
    id bigint NOT NULL,
    legacy_no integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    full_name text GENERATED ALWAYS AS (((first_name || ' '::text) || last_name)) STORED,
    email kitchen.email_address,
    mood kitchen.mood DEFAULT 'ok'::kitchen.mood NOT NULL,
    home kitchen.postal_address,
    code text COLLATE pg_catalog."C",
    nickname text COLLATE kitchen.bytewise,
    referred_by bigint,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT customers_code_check CHECK ((code ~ '^[A-Z]{3}[0-9]{2}$'::text))
);
ALTER TABLE ONLY kitchen.customers ALTER COLUMN email SET STATISTICS 500;


--
-- Name: TABLE customers; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON TABLE kitchen.customers IS 'Customers; the semicolon and the -- are part of the text';


--
-- Name: COLUMN customers.full_name; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON COLUMN kitchen.customers.full_name IS 'Generated from first_name and last_name';


--
-- Name: active_customers; Type: VIEW; Schema: kitchen; Owner: -
--

CREATE VIEW kitchen.active_customers AS
 SELECT id,
    full_name,
    email,
    mood
   FROM kitchen.customers
  WHERE (mood <> 'sad'::kitchen.mood);


--
-- Name: VIEW active_customers; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON VIEW kitchen.active_customers IS 'Customers who are not sad';


--
-- Name: vehicles; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.vehicles (
    id bigint NOT NULL,
    wheels smallint NOT NULL,
    plate text,
    registered_on date,
    CONSTRAINT vehicles_wheels_check CHECK ((wheels >= 0))
);


--
-- Name: buses; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.buses (
    seats integer DEFAULT 40 NOT NULL,
    CONSTRAINT buses_plate_required CHECK ((plate IS NOT NULL)) NO INHERIT
)
INHERITS (kitchen.vehicles);


--
-- Name: products; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.products (
    id integer NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    price kitchen.money_amount,
    discount_pct numeric(5,2) DEFAULT 0 NOT NULL,
    net_price numeric(12,2) GENERATED ALWAYS AS (round(((price)::numeric * ((1)::numeric - (discount_pct / (100)::numeric))), 2)) STORED,
    weight_grams integer,
    updated_at timestamp with time zone,
    CONSTRAINT products_discount_pct_check CHECK (((discount_pct >= (0)::numeric) AND (discount_pct <= (100)::numeric)))
)
WITH (fillfactor='90');


--
-- Name: cheap_products; Type: VIEW; Schema: kitchen; Owner: -
--

CREATE VIEW kitchen.cheap_products WITH (security_barrier='true') AS
 SELECT id,
    sku,
    name,
    price
   FROM kitchen.products
  WHERE ((price)::numeric < (10)::numeric)
  WITH LOCAL CHECK OPTION;


--
-- Name: countdown; Type: SEQUENCE; Schema: kitchen; Owner: -
--

CREATE SEQUENCE kitchen.countdown
    START WITH -1
    INCREMENT BY -1
    MINVALUE -1000
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_totals; Type: MATERIALIZED VIEW; Schema: kitchen; Owner: -
--

CREATE MATERIALIZED VIEW kitchen.customer_totals AS
 SELECT id AS customer_id,
    full_name,
    kitchen.order_count(id) AS order_count,
    kitchen.customer_order_total(id) AS total_spent
   FROM kitchen.customers c
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW customer_totals; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON MATERIALIZED VIEW kitchen.customer_totals IS 'Refresh after loading orders';


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.customers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME kitchen.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customers_legacy_no_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

CREATE SEQUENCE kitchen.customers_legacy_no_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_legacy_no_seq; Type: SEQUENCE OWNED BY; Schema: kitchen; Owner: -
--

ALTER SEQUENCE kitchen.customers_legacy_no_seq OWNED BY kitchen.customers.legacy_no;


--
-- Name: documents; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.documents (
    id bigint NOT NULL,
    tenant_id integer DEFAULT kitchen.current_tenant() NOT NULL,
    owner_name name DEFAULT CURRENT_USER NOT NULL,
    title text NOT NULL,
    body text,
    is_public boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY kitchen.documents FORCE ROW LEVEL SECURITY;


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.documents ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME kitchen.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: happy_customers; Type: VIEW; Schema: kitchen; Owner: -
--

CREATE VIEW kitchen.happy_customers AS
 SELECT id,
    full_name
   FROM kitchen.active_customers
  WHERE (mood = ANY (ARRAY['happy'::kitchen.mood, 'ecstatic'::kitchen.mood]));


--
-- Name: measurements; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.measurements (
    sensor_id integer NOT NULL,
    measured_at timestamp with time zone NOT NULL,
    value double precision
)
PARTITION BY RANGE (measured_at);


--
-- Name: measurements_2025; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.measurements_2025 (
    sensor_id integer NOT NULL,
    measured_at timestamp with time zone NOT NULL,
    value double precision
);


--
-- Name: measurements_2026; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.measurements_2026 (
    sensor_id integer NOT NULL,
    measured_at timestamp with time zone NOT NULL,
    value double precision
);


--
-- Name: measurements_default; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.measurements_default (
    sensor_id integer NOT NULL,
    measured_at timestamp with time zone NOT NULL,
    value double precision
);


--
-- Name: order_lines; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.order_lines (
    order_id bigint NOT NULL,
    line_no smallint NOT NULL,
    product_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    CONSTRAINT order_lines_quantity_check CHECK ((quantity > 0))
);


--
-- Name: order_summary; Type: VIEW; Schema: kitchen; Owner: -
--

CREATE VIEW kitchen.order_summary AS
 SELECT o.id,
    o.customer_id,
    c.full_name,
    o.total,
    o.status
   FROM (kitchen.orders o
     JOIN kitchen.customers c ON ((c.id = o.customer_id)));


--
-- Name: orders_by_region; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.orders_by_region (
    region text NOT NULL,
    order_id bigint NOT NULL,
    placed_on date DEFAULT CURRENT_DATE NOT NULL
)
PARTITION BY LIST (region);


--
-- Name: orders_by_region_eu; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.orders_by_region_eu (
    region text NOT NULL,
    order_id bigint NOT NULL,
    placed_on date DEFAULT CURRENT_DATE NOT NULL
)
PARTITION BY HASH (order_id);


--
-- Name: orders_by_region_eu_0; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.orders_by_region_eu_0 (
    region text NOT NULL,
    order_id bigint NOT NULL,
    placed_on date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: orders_by_region_eu_1; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.orders_by_region_eu_1 (
    region text NOT NULL,
    order_id bigint NOT NULL,
    placed_on date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: orders_by_region_other; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.orders_by_region_other (
    region text NOT NULL,
    order_id bigint NOT NULL,
    placed_on date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME kitchen.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.products ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME kitchen.products_id_seq
    START WITH 100
    INCREMENT BY 5
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: referral_chain; Type: VIEW; Schema: kitchen; Owner: -
--

CREATE VIEW kitchen.referral_chain AS
 WITH RECURSIVE referral_chain(customer_id, root_id, depth) AS (
         SELECT customers.id,
            customers.id,
            0 AS "?column?"
           FROM kitchen.customers
          WHERE (customers.referred_by IS NULL)
        UNION ALL
         SELECT c.id,
            r.root_id,
            (r.depth + 1)
           FROM (kitchen.customers c
             JOIN referral_chain r ON ((c.referred_by = r.customer_id)))
        )
 SELECT customer_id,
    root_id,
    depth
   FROM referral_chain;


--
-- Name: room_bookings; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.room_bookings (
    id bigint NOT NULL,
    room_id integer NOT NULL,
    during tstzrange NOT NULL,
    booked_by bigint
);


--
-- Name: room_bookings_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.room_bookings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME kitchen.room_bookings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sensors; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.sensors (
    id integer NOT NULL,
    label text NOT NULL
);


--
-- Name: sensors_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.sensors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME kitchen.sensors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: session_cache; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE UNLOGGED TABLE kitchen.session_cache (
    key text NOT NULL,
    value jsonb,
    expires_at timestamp with time zone
)
WITH (fillfactor='70', autovacuum_enabled='false');
ALTER TABLE ONLY kitchen.session_cache ALTER COLUMN value SET STORAGE EXTERNAL;


--
-- Name: shipments; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.shipments (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    line_no smallint NOT NULL,
    carrier text DEFAULT 'post'::text NOT NULL,
    shipped_on date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: shipments_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

CREATE SEQUENCE kitchen.shipments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: kitchen; Owner: -
--

ALTER SEQUENCE kitchen.shipments_id_seq OWNED BY kitchen.shipments.id;


--
-- Name: ticket_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

CREATE SEQUENCE kitchen.ticket_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_seq; Type: SEQUENCE OWNED BY; Schema: kitchen; Owner: -
--

ALTER SEQUENCE kitchen.ticket_seq OWNED BY kitchen.orders.ticket_no;


--
-- Name: trucks; Type: TABLE; Schema: kitchen; Owner: -
--

CREATE TABLE kitchen.trucks (
    payload_kg integer NOT NULL,
    CONSTRAINT trucks_payload_kg_check CHECK ((payload_kg > 0))
)
INHERITS (kitchen.vehicles);


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: kitchen; Owner: -
--

CREATE SEQUENCE kitchen.vehicles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: kitchen; Owner: -
--

ALTER SEQUENCE kitchen.vehicles_id_seq OWNED BY kitchen.vehicles.id;


--
-- Name: events; Type: TABLE; Schema: kitchen_audit; Owner: -
--

CREATE TABLE kitchen_audit.events (
    id bigint NOT NULL,
    table_name text NOT NULL,
    operation text NOT NULL,
    row_count bigint NOT NULL,
    logged_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: kitchen_audit; Owner: -
--

ALTER TABLE kitchen_audit.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME kitchen_audit.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: measurements_2025; Type: TABLE ATTACH; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.measurements ATTACH PARTITION kitchen.measurements_2025 FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');


--
-- Name: measurements_2026; Type: TABLE ATTACH; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.measurements ATTACH PARTITION kitchen.measurements_2026 FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');


--
-- Name: measurements_default; Type: TABLE ATTACH; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.measurements ATTACH PARTITION kitchen.measurements_default DEFAULT;


--
-- Name: orders_by_region_eu; Type: TABLE ATTACH; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region ATTACH PARTITION kitchen.orders_by_region_eu FOR VALUES IN ('de', 'fr', 'pt');


--
-- Name: orders_by_region_eu_0; Type: TABLE ATTACH; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region_eu ATTACH PARTITION kitchen.orders_by_region_eu_0 FOR VALUES WITH (modulus 2, remainder 0);


--
-- Name: orders_by_region_eu_1; Type: TABLE ATTACH; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region_eu ATTACH PARTITION kitchen.orders_by_region_eu_1 FOR VALUES WITH (modulus 2, remainder 1);


--
-- Name: orders_by_region_other; Type: TABLE ATTACH; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region ATTACH PARTITION kitchen.orders_by_region_other DEFAULT;


--
-- Name: buses id; Type: DEFAULT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.buses ALTER COLUMN id SET DEFAULT nextval('kitchen.vehicles_id_seq'::regclass);


--
-- Name: customers legacy_no; Type: DEFAULT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.customers ALTER COLUMN legacy_no SET DEFAULT nextval('kitchen.customers_legacy_no_seq'::regclass);


--
-- Name: orders ticket_no; Type: DEFAULT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders ALTER COLUMN ticket_no SET DEFAULT nextval('kitchen.ticket_seq'::regclass);


--
-- Name: shipments id; Type: DEFAULT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.shipments ALTER COLUMN id SET DEFAULT nextval('kitchen.shipments_id_seq'::regclass);


--
-- Name: trucks id; Type: DEFAULT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.trucks ALTER COLUMN id SET DEFAULT nextval('kitchen.vehicles_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.vehicles ALTER COLUMN id SET DEFAULT nextval('kitchen.vehicles_id_seq'::regclass);


--
-- Name: Order; Lines Order; Lines_pkey; Type: CONSTRAINT; Schema: Sink Área; Owner: -
--

ALTER TABLE ONLY "Sink Área"."Order; Lines"
    ADD CONSTRAINT "Order; Lines_pkey" PRIMARY KEY ("Id");


--
-- Name: customers customers_legacy_no_key; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.customers
    ADD CONSTRAINT customers_legacy_no_key UNIQUE (legacy_no);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: measurements measurements_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.measurements
    ADD CONSTRAINT measurements_pkey PRIMARY KEY (sensor_id, measured_at);


--
-- Name: measurements_2025 measurements_2025_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.measurements_2025
    ADD CONSTRAINT measurements_2025_pkey PRIMARY KEY (sensor_id, measured_at);


--
-- Name: measurements_2026 measurements_2026_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.measurements_2026
    ADD CONSTRAINT measurements_2026_pkey PRIMARY KEY (sensor_id, measured_at);


--
-- Name: measurements_default measurements_default_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.measurements_default
    ADD CONSTRAINT measurements_default_pkey PRIMARY KEY (sensor_id, measured_at);


--
-- Name: order_lines order_lines_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.order_lines
    ADD CONSTRAINT order_lines_pkey PRIMARY KEY (order_id, line_no);


--
-- Name: orders_by_region orders_by_region_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region
    ADD CONSTRAINT orders_by_region_pkey PRIMARY KEY (region, order_id);


--
-- Name: orders_by_region_eu orders_by_region_eu_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region_eu
    ADD CONSTRAINT orders_by_region_eu_pkey PRIMARY KEY (region, order_id);


--
-- Name: orders_by_region_eu_0 orders_by_region_eu_0_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region_eu_0
    ADD CONSTRAINT orders_by_region_eu_0_pkey PRIMARY KEY (region, order_id);


--
-- Name: orders_by_region_eu_1 orders_by_region_eu_1_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region_eu_1
    ADD CONSTRAINT orders_by_region_eu_1_pkey PRIMARY KEY (region, order_id);


--
-- Name: orders_by_region_other orders_by_region_other_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders_by_region_other
    ADD CONSTRAINT orders_by_region_other_pkey PRIMARY KEY (region, order_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE kitchen.orders CLUSTER ON orders_pkey;


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: products products_weight_positive; Type: CHECK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.products
    ADD CONSTRAINT products_weight_positive CHECK ((weight_grams > 0)) NOT VALID;


--
-- Name: room_bookings room_bookings_no_overlap; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.room_bookings
    ADD CONSTRAINT room_bookings_no_overlap EXCLUDE USING gist (room_id WITH =, during WITH &&);


--
-- Name: room_bookings room_bookings_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.room_bookings
    ADD CONSTRAINT room_bookings_pkey PRIMARY KEY (id);


--
-- Name: sensors sensors_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.sensors
    ADD CONSTRAINT sensors_pkey PRIMARY KEY (id);


--
-- Name: session_cache session_cache_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.session_cache
    ADD CONSTRAINT session_cache_pkey PRIMARY KEY (key);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: kitchen_audit; Owner: -
--

ALTER TABLE ONLY kitchen_audit.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: Order; Lines "select" idx; Type: INDEX; Schema: Sink Área; Owner: -
--

CREATE INDEX "Order; Lines ""select"" idx" ON "Sink Área"."Order; Lines" USING btree ("select");


--
-- Name: customer_totals_customer_id_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE UNIQUE INDEX customer_totals_customer_id_idx ON kitchen.customer_totals USING btree (customer_id);


--
-- Name: customers_email_lower_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE UNIQUE INDEX customers_email_lower_idx ON kitchen.customers USING btree (lower((email)::text));


--
-- Name: INDEX customers_email_lower_idx; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON INDEX kitchen.customers_email_lower_idx IS 'Case-insensitive e-mail lookups';


--
-- Name: customers_last_name_trgm_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX customers_last_name_trgm_idx ON kitchen.customers USING gin (last_name kitchen.gin_trgm_ops);


--
-- Name: customers_name_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX customers_name_idx ON kitchen.customers USING btree (last_name, first_name DESC NULLS LAST) INCLUDE (mood);


--
-- Name: customers_referred_by_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX customers_referred_by_idx ON kitchen.customers USING btree (referred_by) WHERE (referred_by IS NOT NULL);


--
-- Name: customers_settings_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX customers_settings_idx ON kitchen.customers USING gin (settings jsonb_path_ops);


--
-- Name: measurements_value_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX measurements_value_idx ON ONLY kitchen.measurements USING btree (value);


--
-- Name: measurements_2025_value_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX measurements_2025_value_idx ON kitchen.measurements_2025 USING btree (value);


--
-- Name: measurements_2026_value_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX measurements_2026_value_idx ON kitchen.measurements_2026 USING btree (value);


--
-- Name: measurements_default_value_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX measurements_default_value_idx ON kitchen.measurements_default USING btree (value);


--
-- Name: order_lines_product_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX order_lines_product_idx ON kitchen.order_lines USING btree (product_id) WITH (fillfactor='80');


--
-- Name: orders_open_ticket_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE UNIQUE INDEX orders_open_ticket_idx ON kitchen.orders USING btree (ticket_no) WHERE (status = ANY (ARRAY['new'::kitchen.order_status, 'paid'::kitchen.order_status]));


--
-- Name: orders_placed_at_brin_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX orders_placed_at_brin_idx ON kitchen.orders USING brin (placed_at) WITH (pages_per_range='32');


--
-- Name: orders_status_hash_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX orders_status_hash_idx ON kitchen.orders USING hash (status);


--
-- Name: room_bookings_during_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX room_bookings_during_idx ON kitchen.room_bookings USING gist (during);


--
-- Name: session_cache_expires_idx; Type: INDEX; Schema: kitchen; Owner: -
--

CREATE INDEX session_cache_expires_idx ON kitchen.session_cache USING btree (expires_at);


--
-- Name: measurements_2025_pkey; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.measurements_pkey ATTACH PARTITION kitchen.measurements_2025_pkey;


--
-- Name: measurements_2025_value_idx; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.measurements_value_idx ATTACH PARTITION kitchen.measurements_2025_value_idx;


--
-- Name: measurements_2026_pkey; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.measurements_pkey ATTACH PARTITION kitchen.measurements_2026_pkey;


--
-- Name: measurements_2026_value_idx; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.measurements_value_idx ATTACH PARTITION kitchen.measurements_2026_value_idx;


--
-- Name: measurements_default_pkey; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.measurements_pkey ATTACH PARTITION kitchen.measurements_default_pkey;


--
-- Name: measurements_default_value_idx; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.measurements_value_idx ATTACH PARTITION kitchen.measurements_default_value_idx;


--
-- Name: orders_by_region_eu_0_pkey; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.orders_by_region_eu_pkey ATTACH PARTITION kitchen.orders_by_region_eu_0_pkey;


--
-- Name: orders_by_region_eu_1_pkey; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.orders_by_region_eu_pkey ATTACH PARTITION kitchen.orders_by_region_eu_1_pkey;


--
-- Name: orders_by_region_eu_pkey; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.orders_by_region_pkey ATTACH PARTITION kitchen.orders_by_region_eu_pkey;


--
-- Name: orders_by_region_other_pkey; Type: INDEX ATTACH; Schema: kitchen; Owner: -
--

ALTER INDEX kitchen.orders_by_region_pkey ATTACH PARTITION kitchen.orders_by_region_other_pkey;


--
-- Name: customers customers_touch; Type: TRIGGER; Schema: kitchen; Owner: -
--

CREATE TRIGGER customers_touch BEFORE UPDATE ON kitchen.customers FOR EACH ROW EXECUTE FUNCTION kitchen.touch_updated_at();


--
-- Name: TRIGGER customers_touch ON customers; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON TRIGGER customers_touch ON kitchen.customers IS 'Keeps updated_at current';


--
-- Name: measurements measurements_clamp; Type: TRIGGER; Schema: kitchen; Owner: -
--

CREATE TRIGGER measurements_clamp BEFORE INSERT OR UPDATE ON kitchen.measurements FOR EACH ROW EXECUTE FUNCTION kitchen.clamp_measurement();


--
-- Name: order_lines order_lines_check; Type: TRIGGER; Schema: kitchen; Owner: -
--

CREATE CONSTRAINT TRIGGER order_lines_check AFTER INSERT OR UPDATE ON kitchen.order_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION kitchen.check_order_line();


--
-- Name: order_summary order_summary_insert; Type: TRIGGER; Schema: kitchen; Owner: -
--

CREATE TRIGGER order_summary_insert INSTEAD OF INSERT ON kitchen.order_summary FOR EACH ROW EXECUTE FUNCTION kitchen.insert_order_summary();


--
-- Name: orders orders_audit; Type: TRIGGER; Schema: kitchen; Owner: -
--

CREATE TRIGGER orders_audit AFTER INSERT ON kitchen.orders REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION kitchen_audit.log_statement();


--
-- Name: products products_touch; Type: TRIGGER; Schema: kitchen; Owner: -
--

CREATE TRIGGER products_touch BEFORE UPDATE OF price, discount_pct ON kitchen.products FOR EACH ROW WHEN ((((old.price)::numeric IS DISTINCT FROM (new.price)::numeric) OR (old.discount_pct IS DISTINCT FROM new.discount_pct))) EXECUTE FUNCTION kitchen.touch_updated_at();


--
-- Name: customers customers_referred_by_fkey; Type: FK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.customers
    ADD CONSTRAINT customers_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES kitchen.customers(id) ON DELETE SET NULL;


--
-- Name: measurements measurements_sensor_id_fkey; Type: FK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.measurements
    ADD CONSTRAINT measurements_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES kitchen.sensors(id);


--
-- Name: order_lines order_lines_order_fkey; Type: FK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.order_lines
    ADD CONSTRAINT order_lines_order_fkey FOREIGN KEY (order_id) REFERENCES kitchen.orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: order_lines order_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.order_lines
    ADD CONSTRAINT order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES kitchen.products(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES kitchen.customers(id) ON DELETE CASCADE;


--
-- Name: room_bookings room_bookings_booked_by_fkey; Type: FK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.room_bookings
    ADD CONSTRAINT room_bookings_booked_by_fkey FOREIGN KEY (booked_by) REFERENCES kitchen.customers(id);


--
-- Name: shipments shipments_order_id_line_no_fkey; Type: FK CONSTRAINT; Schema: kitchen; Owner: -
--

ALTER TABLE ONLY kitchen.shipments
    ADD CONSTRAINT shipments_order_id_line_no_fkey FOREIGN KEY (order_id, line_no) REFERENCES kitchen.order_lines(order_id, line_no) MATCH FULL ON UPDATE CASCADE;


--
-- Name: documents; Type: ROW SECURITY; Schema: kitchen; Owner: -
--

ALTER TABLE kitchen.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_owner_delete; Type: POLICY; Schema: kitchen; Owner: -
--

CREATE POLICY documents_owner_delete ON kitchen.documents AS RESTRICTIVE FOR DELETE USING ((owner_name = CURRENT_USER));


--
-- Name: documents documents_public_read; Type: POLICY; Schema: kitchen; Owner: -
--

CREATE POLICY documents_public_read ON kitchen.documents FOR SELECT USING (is_public);


--
-- Name: documents documents_tenant_isolation; Type: POLICY; Schema: kitchen; Owner: -
--

CREATE POLICY documents_tenant_isolation ON kitchen.documents USING ((tenant_id = kitchen.current_tenant())) WITH CHECK ((tenant_id = kitchen.current_tenant()));


--
-- Name: POLICY documents_tenant_isolation ON documents; Type: COMMENT; Schema: kitchen; Owner: -
--

COMMENT ON POLICY documents_tenant_isolation ON kitchen.documents IS 'One tenant per session';


--
-- PostgreSQL database dump complete
--

\unrestrict 0QmmktSHUz8KSvfK4nKJjy86XUgk3Qu54OJ1SucARGkrvjrS1ilsCAX8UfvSqoi

