-- Kitchen sink, family: indexes. Unique and expression, partial, INCLUDE,
-- multi-column with sort options, BRIN, hash, GIN (jsonb_path_ops and the
-- pg_trgm operator class), GiST on a range, storage parameters and
-- CLUSTER ON.

CREATE UNIQUE INDEX customers_email_lower_idx ON kitchen.customers (lower(email));

CREATE INDEX customers_referred_by_idx ON kitchen.customers (referred_by)
    WHERE referred_by IS NOT NULL;

CREATE INDEX customers_name_idx ON kitchen.customers (last_name, first_name DESC NULLS LAST)
    INCLUDE (mood);

CREATE INDEX customers_last_name_trgm_idx ON kitchen.customers
    USING gin (last_name kitchen.gin_trgm_ops);

CREATE INDEX customers_settings_idx ON kitchen.customers USING gin (settings jsonb_path_ops);

CREATE INDEX orders_placed_at_brin_idx ON kitchen.orders USING brin (placed_at)
    WITH (pages_per_range = 32);

CREATE INDEX orders_status_hash_idx ON kitchen.orders USING hash (status);

CREATE UNIQUE INDEX orders_open_ticket_idx ON kitchen.orders (ticket_no)
    WHERE status IN ('new', 'paid');

CREATE INDEX order_lines_product_idx ON kitchen.order_lines (product_id)
    WITH (fillfactor = 80);

CREATE INDEX room_bookings_during_idx ON kitchen.room_bookings USING gist (during);

CREATE INDEX session_cache_expires_idx ON kitchen.session_cache (expires_at);

ALTER TABLE kitchen.orders CLUSTER ON orders_pkey;
