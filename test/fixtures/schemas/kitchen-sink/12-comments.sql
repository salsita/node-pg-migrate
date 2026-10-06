-- Kitchen sink, family: comments on many kinds of objects.

COMMENT ON SCHEMA kitchen IS 'Kitchen-sink fixture for the node-pg-migrate baseline tests';

COMMENT ON SCHEMA kitchen_audit IS 'Audit trail';

COMMENT ON TYPE kitchen.mood IS 'How a customer feels';

COMMENT ON TYPE kitchen.postal_address IS 'A postal address';

COMMENT ON DOMAIN kitchen.email_address IS 'A very loose e-mail check';

COMMENT ON TYPE kitchen.float_range IS 'A range of double precision values';

COMMENT ON COLLATION kitchen.bytewise IS 'Byte-wise ordering';

COMMENT ON SEQUENCE kitchen.invoice_number IS 'Cycles back to 1000';

COMMENT ON TABLE kitchen.customers IS 'Customers; the semicolon and the -- are part of the text';

COMMENT ON COLUMN kitchen.customers.full_name IS 'Generated from first_name and last_name';

COMMENT ON CONSTRAINT orders_shipped_after_placed ON kitchen.orders IS 'Nothing ships before it is placed';

COMMENT ON INDEX kitchen.customers_email_lower_idx IS 'Case-insensitive e-mail lookups';

COMMENT ON VIEW kitchen.active_customers IS 'Customers who are not sad';

COMMENT ON MATERIALIZED VIEW kitchen.customer_totals IS 'Refresh after loading orders';

COMMENT ON FUNCTION kitchen.customer_order_total(bigint) IS 'Sum of the orders of a customer that are not cancelled';

COMMENT ON PROCEDURE kitchen.purge_cancelled_orders(timestamptz, integer) IS 'Deletes old cancelled orders';

COMMENT ON AGGREGATE kitchen.pipe_agg(text) IS 'Joins values with |';

COMMENT ON OPERATOR kitchen.=~= (numeric, numeric) IS 'Equal within 0.01';

COMMENT ON TRIGGER customers_touch ON kitchen.customers IS 'Keeps updated_at current';

COMMENT ON POLICY documents_tenant_isolation ON kitchen.documents IS 'One tenant per session';
