-- Kitchen sink, family: views and materialized views. A plain view, a view on
-- a view, a security_barrier view WITH CHECK OPTION, a recursive view, a view
-- that gets an INSTEAD OF trigger in 10-triggers.sql, and a materialized view
-- with a unique index.
--
-- order_count() is a LANGUAGE sql function with a BEGIN ATOMIC body. Unlike
-- the functions in 04-functions.sql, PostgreSQL parses it when it is created
-- and records that it depends on kitchen.orders, so pg_dump emits it after
-- the table. Its body contains a semicolon outside any quotes.

CREATE VIEW kitchen.active_customers AS
    SELECT id, full_name, email, mood
    FROM kitchen.customers
    WHERE mood <> 'sad';

CREATE VIEW kitchen.happy_customers AS
    SELECT id, full_name
    FROM kitchen.active_customers
    WHERE mood IN ('happy', 'ecstatic');

CREATE VIEW kitchen.cheap_products WITH (security_barrier = true) AS
    SELECT id, sku, name, price
    FROM kitchen.products
    WHERE price < 10
    WITH LOCAL CHECK OPTION;

CREATE RECURSIVE VIEW kitchen.referral_chain (customer_id, root_id, depth) AS
    SELECT id, id, 0 FROM kitchen.customers WHERE referred_by IS NULL
    UNION ALL
    SELECT c.id, r.root_id, r.depth + 1
    FROM kitchen.customers AS c
    JOIN referral_chain AS r ON c.referred_by = r.customer_id;

CREATE VIEW kitchen.order_summary AS
    SELECT o.id, o.customer_id, c.full_name, o.total, o.status
    FROM kitchen.orders AS o
    JOIN kitchen.customers AS c ON c.id = o.customer_id;

CREATE FUNCTION kitchen.order_count(p_customer_id bigint) RETURNS bigint
    LANGUAGE sql STABLE
BEGIN ATOMIC
    SELECT count(*) FROM kitchen.orders WHERE customer_id = p_customer_id;
END;

CREATE MATERIALIZED VIEW kitchen.customer_totals AS
    SELECT c.id AS customer_id,
           c.full_name,
           kitchen.order_count(c.id) AS order_count,
           kitchen.customer_order_total(c.id) AS total_spent
    FROM kitchen.customers AS c;

CREATE UNIQUE INDEX customer_totals_customer_id_idx ON kitchen.customer_totals (customer_id);
