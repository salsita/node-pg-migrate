# Adversarial dumps

Small dumps that each exercise one rule of `sanitizeDump` (the R0–R10 rules of
the baseline contract). Except for `psql-connect.sql`, every file is unedited
output of `pg_dump` 18.6 from a throwaway database. That's why they keep real
`\restrict` / `\unrestrict` pairs with random keys and `pg_dump`'s `SET`
preamble. Line numbers below are 1-based lines of the file.

Expected outcomes assume the default options: migrations table
`public.pgmigrations` and sequence `public.pgmigrations_id_seq`. "Kept" means
no error and the named text reaches the output byte for byte. "Dropped" means
only the named statement is removed and everything else is kept.

| File                                  | Rule                                                      | Expected outcome                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backslash-line-in-function-body.sql` | R1 / scanner: a `\` line inside a statement belongs to it | Kept. The function `public.psql_help()` is unchanged, with the body lines `\connect app` (30), `\dt public.*` (31) and `\.` (33).                                                                                                                                                                                                         |
| `clean-dump.sql`                      | R4                                                        | `CLEAN_DUMP` at line 23, `DROP TABLE IF EXISTS public.notes;`. The `ALTER TABLE IF EXISTS ONLY … DROP CONSTRAINT IF EXISTS …` on line 22 is not a `DROP` statement.                                                                                                                                                                       |
| `comment-on-extension.sql`            | R7                                                        | Dropped: line 33, `COMMENT ON EXTENSION pg_trgm IS '…';`. `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;` (line 26) and the rest are kept.                                                                                                                                                                                   |
| `copy-data.sql`                       | R2                                                        | `DATA_IN_DUMP` at line 54, `COPY public.notes (id, body) FROM stdin;`. The data ends with `\.` on line 57.                                                                                                                                                                                                                                |
| `create-database.sql`                 | R3                                                        | `CREATE_DATABASE` at line 26, `CREATE DATABASE app …;`. It comes before the `\connect app` on line 30.                                                                                                                                                                                                                                    |
| `create-schema-public.sql`            | R8, R8b                                                   | Dropped: line 26, `CREATE SCHEMA public;` (R8) and line 33, `COMMENT ON SCHEMA public IS 'standard public schema';` (R8b: the default comment blank databases already have). The rest is kept.                                                                                                                                            |
| `custom-format.dump`                  | R0                                                        | `BINARY_DUMP`: a custom-format archive (`PGDMP` header), not SQL. The message gives the `pg_restore` command that turns it into SQL.                                                                                                                                                                                                      |
| `marker-in-function-body.sql`         | R10                                                       | `MARKER_COLLISION` at line 30, `-- Up Migration`, a line of the body of `public.migration_template()`. Line 33, `-- Down Migration`, matches too.                                                                                                                                                                                         |
| `migrations-sequence.sql`             | R9                                                        | `MIGRATIONS_TABLE_IN_DUMP` at line 40, `CREATE SEQUENCE public.pgmigrations_id_seq`.                                                                                                                                                                                                                                                      |
| `migrations-table.sql`                | R9                                                        | `MIGRATIONS_TABLE_IN_DUMP` at line 40, `CREATE TABLE public.pgmigrations (`. Its sequence follows on line 51.                                                                                                                                                                                                                             |
| `migrations-table-lookalike.sql`      | R9, identifier rules                                      | Kept: neither `app.pgmigrations` (another schema) nor `public."PgMigrations"` (quoted, so not folded to lower case) is the migrations table. With `migrationsSchema: 'app'` it is `MIGRATIONS_TABLE_IN_DUMP` for `app.pgmigrations`. With `migrationsTable: 'PgMigrations'` it is `MIGRATIONS_TABLE_IN_DUMP` for `public."PgMigrations"`. |
| `psql-connect.sql`                    | R1                                                        | `PSQL_META_COMMAND` at line 23, `\connect app`. The `\restrict` on line 5 and the `\unrestrict` with the same key on line 22 are dropped before it.                                                                                                                                                                                       |
| `tar-format.tar`                      | R0                                                        | `BINARY_DUMP`: a tar-format archive (`ustar` at byte 257, holding `toc.dat` and `restore.sql`), not SQL. The message gives the `pg_restore` command that turns it into SQL.                                                                                                                                                               |

Every SQL file also starts with the `SET` preamble and
`SELECT pg_catalog.set_config('search_path', '', false);` (R5, R6).

## How they were made

All files come from PostgreSQL 18.6 (`postgres:18-alpine`), each dumped from
its own database with `pg_dump --schema-only --no-owner --no-privileges`
plus the flags below:

- `clean-dump.sql` (`--clean --if-exists`), `create-database.sql`
  (`--create`, database `app`) and `copy-data.sql` (without
  `--schema-only`, so with its two rows) all dump one table,
  `public.notes (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text NOT NULL)`.
- `create-schema-public.sql`: `--schema=public`, which is what makes `pg_dump`
  write `CREATE SCHEMA public;`. The source was a table `public.notes`.
- `comment-on-extension.sql`: `pg_trgm` with a trigram index on
  `public.words`.
- `marker-in-function-body.sql` and `backslash-line-in-function-body.sql`:
  `LANGUAGE sql` functions returning string literals that span several
  lines.
- `migrations-table.sql`: a database with node-pg-migrate's own table
  (`CREATE TABLE "public"."pgmigrations" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)`)
  and `public.notes`. `migrations-sequence.sql` is the same database dumped
  with `--exclude-table=public.pgmigrations`: that leaves the table's serial
  sequence in the dump.
- `migrations-table-lookalike.sql`: tables like node-pg-migrate's, named
  `public."PgMigrations"` and `app.pgmigrations`.
- `custom-format.dump` (`--format=custom`) and `tar-format.tar`
  (`--format=tar`) dump the same `public.notes` table. They are binary,
  which `.gitattributes` keeps byte for byte.
- `psql-connect.sql`: `create-database.sql` with its
  `-- Name: app; Type: DATABASE` entry, the `CREATE DATABASE` statement, cut
  out by hand. That leaves the `\connect app` that `--create` writes.
