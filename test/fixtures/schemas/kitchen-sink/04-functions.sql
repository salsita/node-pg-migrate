-- Kitchen sink, family: functions. LANGUAGE sql and plpgsql functions
-- (trigger functions for 08-partitions.sql and 10-triggers.sql among them),
-- OUT, VARIADIC, DEFAULT and TABLE results, SECURITY DEFINER with a SET
-- clause, a procedure, an aggregate and an operator.
--
-- customer_order_total() and recent_orders() are LANGUAGE sql functions that
-- read kitchen.orders, which 05-tables.sql creates later. PostgreSQL checks
-- SQL function bodies when they are created unless check_function_bodies is
-- off, which is also what pg_dump's preamble does. No dependency on the table
-- is recorded, so pg_dump may emit such a function before the table, and it
-- does for customer_order_total().

SET check_function_bodies = false;

CREATE FUNCTION kitchen.customer_order_total(p_customer_id bigint) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
    SELECT coalesce(sum(o.total), 0)
    FROM kitchen.orders AS o
    WHERE o.customer_id = p_customer_id
      AND o.status <> 'cancelled'
$$;

CREATE FUNCTION kitchen.recent_orders(p_days integer DEFAULT 30)
    RETURNS TABLE (order_id bigint, placed_at timestamptz)
    LANGUAGE sql STABLE
    AS $$
    SELECT o.id, o.placed_at
    FROM kitchen.orders AS o
    WHERE o.placed_at > now() - make_interval(days => p_days)
$$;

CREATE FUNCTION kitchen.split_name(full_name text, OUT first_name text, OUT last_name text)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
    SELECT split_part(full_name, ' ', 1),
           nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), '')
$$;

CREATE FUNCTION kitchen.join_nonempty(sep text, VARIADIC parts text[]) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT string_agg(p, sep) FROM unnest(parts) AS p WHERE p <> ''
$$;

CREATE FUNCTION kitchen.current_tenant() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, pg_temp
    AS $$
    SELECT nullif(current_setting('kitchen.tenant_id', true), '')::integer
$$;

CREATE FUNCTION kitchen.describe_price(p_price numeric) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $body$
DECLARE
    label text := 'price; not the end of a statement'; -- a comment; with a semicolon
BEGIN
    /* a block comment; also with a semicolon */
    IF p_price IS NULL THEN
        RETURN $q$n/a$q$;
    END IF;
    RETURN format(E'%s EUR\t(%s)', p_price, label);
END;
$body$;

CREATE FUNCTION kitchen.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

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

CREATE FUNCTION kitchen_audit.log_statement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO kitchen_audit.events (table_name, operation, row_count)
    SELECT TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_OP, count(*) FROM new_rows;
    RETURN NULL;
END;
$$;

CREATE PROCEDURE kitchen.purge_cancelled_orders(IN p_before timestamptz, INOUT p_purged integer DEFAULT 0)
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM kitchen.orders WHERE placed_at < p_before AND status = 'cancelled';
    GET DIAGNOSTICS p_purged = ROW_COUNT;
END;
$$;

CREATE FUNCTION kitchen.pipe_concat(state text, next text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT CASE WHEN state IS NULL THEN next ELSE state || '|' || next END
$$;

CREATE AGGREGATE kitchen.pipe_agg(text) (
    SFUNC = kitchen.pipe_concat,
    STYPE = text
);

CREATE FUNCTION kitchen.roughly_equal(a numeric, b numeric) RETURNS boolean
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
    SELECT abs(a - b) < 0.01
$$;

CREATE OPERATOR kitchen.=~= (
    LEFTARG = numeric,
    RIGHTARG = numeric,
    FUNCTION = kitchen.roughly_equal
);
