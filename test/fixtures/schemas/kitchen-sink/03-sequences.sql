-- Kitchen sink, family: standalone sequences. Serial and identity sequences
-- come with their tables in 05-tables.sql, which also makes ticket_seq owned
-- by a column.

CREATE SEQUENCE kitchen.invoice_number
    AS integer
    START WITH 1000
    INCREMENT BY 10
    MINVALUE 1000
    MAXVALUE 999990
    CACHE 5
    CYCLE;

CREATE SEQUENCE kitchen.countdown
    INCREMENT BY -1
    MINVALUE -1000
    MAXVALUE -1
    START WITH -1;

CREATE SEQUENCE kitchen.ticket_seq AS bigint;
