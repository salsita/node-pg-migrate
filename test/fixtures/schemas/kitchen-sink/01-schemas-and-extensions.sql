-- Kitchen sink, family: schemas and contrib extensions.
-- btree_gist backs the exclusion constraint in 05-tables.sql and pg_trgm the
-- trigram index in 06-indexes.sql. Both ship with the official images and are
-- trusted extensions.

CREATE SCHEMA kitchen;

CREATE SCHEMA kitchen_audit;

CREATE EXTENSION btree_gist WITH SCHEMA public;

CREATE EXTENSION pg_trgm WITH SCHEMA kitchen;
