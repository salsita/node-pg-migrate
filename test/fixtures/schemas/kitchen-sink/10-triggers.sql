-- Kitchen sink, family: triggers. Row triggers (one with UPDATE OF and WHEN),
-- a statement trigger with a transition table and a function in another
-- schema, a deferrable constraint trigger and an INSTEAD OF trigger on a
-- view. The row trigger on a partitioned table is in 08-partitions.sql.

CREATE TRIGGER customers_touch BEFORE UPDATE ON kitchen.customers
    FOR EACH ROW EXECUTE FUNCTION kitchen.touch_updated_at();

CREATE TRIGGER products_touch BEFORE UPDATE OF price, discount_pct ON kitchen.products
    FOR EACH ROW
    WHEN (OLD.price IS DISTINCT FROM NEW.price OR OLD.discount_pct IS DISTINCT FROM NEW.discount_pct)
    EXECUTE FUNCTION kitchen.touch_updated_at();

CREATE TRIGGER orders_audit AFTER INSERT ON kitchen.orders
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION kitchen_audit.log_statement();

CREATE CONSTRAINT TRIGGER order_lines_check AFTER INSERT OR UPDATE ON kitchen.order_lines
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION kitchen.check_order_line();

CREATE TRIGGER order_summary_insert INSTEAD OF INSERT ON kitchen.order_summary
    FOR EACH ROW EXECUTE FUNCTION kitchen.insert_order_summary();
