---
outline: [2, 3]
---

# Adopting an Existing Database

Have a database that node-pg-migrate didn't create, made by hand, by another tool or by an ORM?
`node-pg-migrate baseline` writes its first migration: one migration that creates the schema
the database has today. Databases that already have the schema record it without running it.
Blank databases, such as CI or a new laptop, run it. After that, you write ordinary
migrations.

## Step by Step

1. **Connect to the database that has the schema**, the same way as for `up`: `DATABASE_URL`,
   your [config](cli#database-connection) or the `PG*` variables.

   ```sh
   export DATABASE_URL=postgres://me:secret@localhost:5432/app
   ```

2. **Generate the baseline.** It runs `pg_dump --schema-only` and only reads the database.

   ```console
   $ node-pg-migrate baseline
   > Wrote migrations/1789084800000_baseline.sql
   > On databases that already have this schema, record it without running it:
   >   node-pg-migrate up 1789084800000_baseline --fake
   > Blank databases run it with a normal `node-pg-migrate up`.
   ```

3. **Review the file and commit it.**

4. **Record it on every database that already has the schema**, such as production, staging
   and your own. `--fake` marks it as run without running it:

   ```sh
   node-pg-migrate up 1789084800000_baseline --fake
   ```

5. **Run it on blank databases** like any other migration:

   ```sh
   node-pg-migrate up
   ```

That's it: create your next migration with `node-pg-migrate create …` as usual.

> [!TIP]
> Forgot `--fake` in step 4? Your schema is unchanged. The baseline stops at the first object
> that already exists (`… already exists`) and rolls back. Only node-pg-migrate's own, empty
> migrations table was created. Run step 4, then `up` again.

## Variations

### TypeScript Instead of SQL <Badge type="warning" text="experimental" />

```sh
node-pg-migrate baseline --format ts
```

This writes `…_baseline.ts`, made of `pgm.createTable(…)` and the other `pgm` calls. Use
`--format js` for JavaScript. Steps 3–5 stay the same. Anything the `pgm` calls can't express
is written as raw SQL with `pgm.sql(…)`. Add `--strict` to fail instead. See
[TypeScript Output](#typescript-output) for the details.

### From a Dump File

Can't run pg_dump where node-pg-migrate runs? Make a schema-only dump wherever you can, then
pass it with `--from-file`. A database connection is optional then.

```sh
pg_dump --schema-only --no-owner --no-privileges --no-tablespaces --no-publications \
  --no-subscriptions --no-security-labels --encoding=UTF8 -d app > schema.sql
node-pg-migrate baseline --from-file schema.sql
```

- Pass the same flags as above: they're what `baseline` uses itself. Without
  `--no-tablespaces`, for example, blank servers fail on tablespaces they don't have.
- Use pg_dump's default plain-text format. Turn a custom-format dump (`-Fc`) into SQL first
  with `pg_restore` and the same flags, plus `-f schema.sql app.dump`.
- Leave out `--clean`, `--create`, `--sequence-data` and data. `--from-file -` reads the dump
  from standard input.
- `baseline` refuses a dump it can't use safely, and says how to make one it can: see
  [Error Codes](#error-codes).

`--format ts` reads a live database, not a file. Load the dump into a scratch database first,
then run the baseline against it:

```sh
createdb scratch && psql -d scratch -f schema.sql
DATABASE_URL=postgres://me:secret@localhost:5432/scratch node-pg-migrate baseline --format ts
```

### Only Some Schemas

```sh
node-pg-migrate baseline --include-schema app audit
node-pg-migrate baseline --exclude-schema scratch
```

Names match exactly. Mind the extensions: see [Schemas and Extensions](#schemas-and-extensions).

## Troubleshooting

| You see                                                        | Do this                                                                                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pg_dump 16.4 is older than the PostgreSQL 18.1 server`        | Install the client tools of the server's version and pass that pg_dump with `--pg-dump <path>`, or use a dump file.                    |
| `Could not run pg_dump: it was not found`                      | Install the PostgreSQL client tools, pass `--pg-dump <path>`, or use a dump file.                                                      |
| `The migrations directory … already has 1 file(s)`             | The baseline is the first migration: write it to an empty directory with `-m`, or with `migrations-dir` when your config file sets it. |
| `"public"."pgmigrations" already records 3 migration(s)`       | node-pg-migrate already manages this database. It doesn't need a baseline.                                                             |
| `… another session holds a lock on one of them`                | Retry once that session is done, or wait longer with `--lock-wait-timeout 2min`.                                                       |
| `out of shared memory` when a blank database runs the baseline | Raise `max_locks_per_transaction` on that server, see [Large Schemas](#large-schemas).                                                 |
| `User has disabled down migration on file: …_baseline.sql`     | Expected: a baseline has no down migration.                                                                                            |

Every refusal is listed under [Error Codes](#error-codes).

## Reference

### Options

The migration settings from your [configuration](cli#configuration) apply as they do for `up`,
and like for `up`, values in the configuration file win over `-m`, `-t`, `--migrations-schema`
and `-s`. To run it from code, see [`baseline()`](api#baseline).

| Option                        | Default              | Description                                                                                   |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `[name...]`                   | `baseline`           | The migration name. `baseline initial schema` writes `…_initial-schema.sql`, like `create`.   |
| `-m`, `--migrations-dir`      | `migrations`         | Where to write it: an empty directory (files starting with `.` don't count), not a glob.      |
| `--migration-filename-format` | `timestamp`          | The file name prefix: `timestamp`, `utc` or `index`.                                          |
| `-t`, `--migrations-table`    | `pgmigrations`       | The migrations table: it must record no migration, and is left out of the baseline.           |
| `--migrations-schema`         | the first `--schema` | The schema of the migrations table.                                                           |
| `-s`, `--schema`              | `public`             | node-pg-migrate's schemas, as for `up`. They don't limit what is dumped.                      |
| `-d`, `--database-url-var`    | `DATABASE_URL`       | The environment variable with the connection string.                                          |
| `--reject-unauthorized`       | `undefined`          | The SSL `rejectUnauthorized` option, as for `up`.                                             |
| `--from-file`                 | `undefined`          | Use this `pg_dump --schema-only` output instead of running pg_dump. `-` reads standard input. |
| `--pg-dump`                   | `pg_dump`            | The pg_dump to run.                                                                           |
| `--include-schema`            | every schema         | Only dump these schemas. A name that matches no schema is refused.                            |
| `--exclude-schema`            | none                 | Leave these schemas out.                                                                      |
| `--lock-wait-timeout`         | `10s`                | How long pg_dump waits for a table lock, e.g. `500ms`, `30s`, `2min`.                         |
| `--format`                    | `sql`                | `sql`, or `ts` or `js` for [`pgm` calls](#typescript-output).                                 |
| `--strict`                    | `false`              | With `--format ts` or `js`: fail instead of writing raw SQL fallbacks.                        |
| `-f`, `--config-file`         | `undefined`          | The config file, as for `up`. `--config-value` and `--envPath` work too.                      |

The printed `--fake` command carries `-m`, `-t` and `--migrations-schema` when they aren't the
defaults. `baseline` can't run with `use-glob` on: it writes into a plain directory.

With `--from-file`, the connection is only used to check for migration history, and
`--pg-dump`, `--include-schema`, `--exclude-schema` and `--lock-wait-timeout` don't apply:
pass pg_dump's own options when you make the dump. If a connection is configured but can't be
reached, `baseline` stops. To skip the check, run it without a connection, for example with
`-d` pointing at an unset environment variable.

### What the Baseline Contains

The schema and nothing else. `baseline` runs pg_dump like this, with `PGCLIENTENCODING=UTF8`
and `-c standard_conforming_strings=on` added to your `PGOPTIONS`:

```sh
pg_dump --schema-only --no-owner --no-privileges --no-publications --no-subscriptions \
  --no-security-labels --no-tablespaces --lock-wait-timeout=10s
```

- Every object pg_dump dumps: schemas, extensions, types, tables, constraints, indexes,
  sequences, functions, triggers, views, policies, comments.
- No rows. Sequences start again from their start value.
- No owners or grants: objects belong to the role that runs the migration.
- No roles, since they belong to the server. If the schema refers to roles (in a policy, for
  example), create them on blank servers first, e.g. from `pg_dumpall --roles-only`.
- Not the migrations table or its sequence: node-pg-migrate creates those itself.
- No down migration.

Before running it on blank databases, keep in mind:

- They need the source's PostgreSQL major version or newer.
- `CREATE EXTENSION` needs a superuser, or `CREATE` on the database for trusted extensions.
- Materialized views are created `WITH NO DATA`: refresh them after the first run. The file's
  header says so when there are any.

### How the Dump Is Cleaned Up

pg_dump's output doesn't work as a migration as it is. `baseline` keeps it byte for byte
except for a few lines, and never adds `DROP` statements.

::: details What changes, and why

| pg_dump writes                                            | The baseline                                       | Why                                                                                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `\restrict <key>` and `\unrestrict <key>`                 | drops them                                         | psql commands (since the August 2025 releases, CVE-2025-8714), not SQL.                                                                                                                |
| `SELECT pg_catalog.set_config('search_path', '', false);` | drops it                                           | It would empty the search path for the migrations that run after the baseline on the same connection.                                                                                  |
| `SET statement_timeout = 0;` and the other `*_timeout`s   | drops them                                         | Your own timeouts apply. `transaction_timeout` would also fail on PostgreSQL 16 and older.                                                                                             |
| other `SET`s, e.g. `SET check_function_bodies = false;`   | `SET LOCAL`, and restores the old value at the end | The baseline needs them; the migrations after it get their own settings back. Role changes, a non-UTF-8 `client_encoding` and `standard_conforming_strings = off` are refused instead. |
| `COMMENT ON EXTENSION …`                                  | drops it                                           | Only the extension's owner may run it, which often fails on managed PostgreSQL. `CREATE EXTENSION` sets the comment anyway.                                                            |
| `CREATE SCHEMA public;` and its default comment           | drops them                                         | Every database has them.                                                                                                                                                               |
| `CREATE SCHEMA` of the migrations schema or a `--schema`  | `CREATE SCHEMA IF NOT EXISTS`                      | `up --create-schema` or `--create-migrations-schema` may create it first.                                                                                                              |

:::

Dumps it can't use are refused rather than fixed: binary or non-UTF-8 files, data (`COPY`,
`INSERT`, `setval()`), `DROP`s, `CREATE DATABASE`, psql commands, role changes, legacy string
literals and the migrations table. See [Error Codes](#error-codes).

### pg_dump

`baseline` runs `pg_dump` from your `PATH`, or the one you pass with `--pg-dump`. pg_dump can't
dump a newer server than itself, so `baseline` checks its version first. If yours is older than
the server, install the client tools of the server's major version, or make the dump with a
pg_dump that matches and use `--from-file`.

The connection reaches pg_dump through its environment, never its command line, where other
users could see it:

- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` and `PGSSLMODE`, plus
  `PGSSLROOTCERT`, `PGSSLCERT`, `PGSSLKEY` and `PGSSLCRL` from the `sslrootcert`, `sslcert`,
  `sslkey` and `sslcrl` of a connection string.
- An `ssl` object in your config becomes `sslmode=verify-full`, or `require` with
  `rejectUnauthorized: false`. Its certificate contents (`ca`, `cert`, `key`) can't be passed
  on: use `sslrootcert=` in the URL, or set `PGSSLROOTCERT`.
- When the connection comes only from the `PG*` variables, they reach pg_dump as they are.
- `PGCLIENTENCODING=UTF8` and `-c standard_conforming_strings=on` (after your own
  `PGOPTIONS`), so the dump is UTF-8 with standard string literals.
- An inherited `PGSERVICE` or `PGSERVICEFILE` is ignored, and so is `PGHOSTADDR` when the
  connection names a host, so pg_dump dumps the database `baseline` checked.

Anything else falls back to your environment, then to pg_dump's defaults, such as `~/.pgpass`.

**Locks.** pg_dump takes an `ACCESS SHARE` lock on each table it dumps. Reads and writes carry
on. Only statements that need an `ACCESS EXCLUSIVE` lock wait, such as most `ALTER TABLE`s,
`DROP TABLE`, `TRUNCATE`, `VACUUM FULL` or a running migration. If such a lock is already held,
pg_dump waits up to `--lock-wait-timeout` (`10s`), and then `baseline` stops with
`PG_DUMP_FAILED`.

### Schemas and Extensions

By default the baseline has every schema but the system ones. `--include-schema` and
`--exclude-schema` take exact names, not patterns.

pg_dump creates each extension `WITH SCHEMA` its schema, so blank databases need that schema
before the extension:

- With `--include-schema`, the baseline keeps the extensions in an included schema or in
  `public` (with pg_dump 14 or newer; pg_dump 13 and older keep none). `baseline` warns about
  the ones it leaves out.
- With `--exclude-schema`, pg_dump still dumps every extension. `baseline` warns about one that
  lives in an excluded schema: blank databases need that schema first.

### Large Schemas

The baseline creates everything in one transaction, and PostgreSQL holds a lock on each
relation it creates until the end. The lock table fits about `max_locks_per_transaction` locks
per connection: 6,400 with the defaults. Past that, a blank database fails with
`out of shared memory` (`53200`).

When a blank database needs more than the default of 64, `baseline` prints a warning with the
value, and the file's header repeats it:

```sql
-- It creates about 40,500 relations in one transaction, so blank databases need
--   max_locks_per_transaction = 512 or more (the default is 64).
```

Set it on the servers that build databases from scratch, such as CI, and restart them:
`ALTER SYSTEM SET max_locks_per_transaction = 512;`, or `-c max_locks_per_transaction=512` on
the `postgres` command line. The estimate uses the source's `max_connections`, so a server with
fewer connections needs more. Databases that record the baseline with `--fake` don't need it.

For scale: 5,000 tables (about 40,000 relations, a 9 MB dump) took about two seconds to dump,
well under a second to clean up, and about 30 seconds to run on a blank database.

### Error Codes {#error-codes}

When `baseline` refuses, it exits with code 1, prints what's wrong and what to do, and writes
no file. [`baseline()`](api#baseline) throws a `BaselineError` with one of these codes:

| Code                       | When                                                                                                                                                                                                                           | What to do                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `MIGRATIONS_EXIST`         | The migrations directory already has a file.                                                                                                                                                                                   | Write the baseline to a new or empty directory: `-m`, or `migrations-dir` in your config file.              |
| `HISTORY_EXISTS`           | The migrations table records migrations.                                                                                                                                                                                       | None needed: node-pg-migrate already manages this database. Check `-t` and the database.                    |
| `INVALID_MIGRATIONS_TABLE` | Something with the migrations table's name exists, but it's a view or another kind of relation, not a table.                                                                                                                   | Point `-t` and `--migrations-schema` at the real table, or remove that relation. `baseline` never reads it. |
| `UNSUPPORTED_SERVER`       | The server is CockroachDB.                                                                                                                                                                                                     | See [CockroachDB](#cockroachdb).                                                                            |
| `BINARY_DUMP`              | The dump isn't SQL text: a `-Fc` or `-Ft` archive, a compressed file or UTF-16 text.                                                                                                                                           | Convert it with the `pg_restore` command in the message, decompress it, or save it as UTF-8.                |
| `NOT_UTF8`                 | The dump isn't UTF-8 text, or its `SET client_encoding` names another encoding.                                                                                                                                                | Make the dump with `pg_dump --encoding=UTF8`.                                                               |
| `NON_STANDARD_STRINGS`     | The dump was made with `standard_conforming_strings` off, so its backslashes are escapes.                                                                                                                                      | Make it again with `PGOPTIONS='-c standard_conforming_strings=on' pg_dump …`.                               |
| `PSQL_META_COMMAND`        | The dump has a psql command such as `\connect app`.                                                                                                                                                                            | Dump without `--create`, or take the command out.                                                           |
| `DATA_IN_DUMP`             | The dump has table data (`COPY`, `INSERT`) or sequence values (`setval()`).                                                                                                                                                    | Dump with `--schema-only`, and without `--sequence-data`.                                                   |
| `CREATE_DATABASE`          | The dump creates a database.                                                                                                                                                                                                   | Dump without `--create`.                                                                                    |
| `CLEAN_DUMP`               | The dump drops objects.                                                                                                                                                                                                        | Dump without `--clean`.                                                                                     |
| `SET_ROLE_IN_DUMP`         | The dump changes the role that runs the migration (`SET ROLE`, `SET SESSION AUTHORIZATION`).                                                                                                                                   | Dump with `--no-owner`, and convert archives without pg_restore's `--role`.                                 |
| `MIGRATIONS_TABLE_IN_DUMP` | The dump creates the migrations table or its sequence.                                                                                                                                                                         | Dump with the `--exclude-table` the message names.                                                          |
| `MARKER_COLLISION`         | A line would be read as `-- Up Migration` or `-- Down Migration`, e.g. in a function.                                                                                                                                          | Change that line in the database, then run `baseline` again.                                                |
| `PG_DUMP_NOT_FOUND`        | pg_dump isn't on the `PATH` or at `--pg-dump`.                                                                                                                                                                                 | Install the client tools, pass `--pg-dump <path>`, or use `--from-file`.                                    |
| `PG_DUMP_TOO_OLD`          | pg_dump is older than the server.                                                                                                                                                                                              | Use a pg_dump of the server's major version or newer.                                                       |
| `PG_DUMP_FAILED`           | pg_dump failed, or couldn't lock a table in time.                                                                                                                                                                              | Fix what the message quotes. For locks, see [pg_dump](#pg-dump).                                            |
| `INVALID_OPTIONS`          | The options can't work, e.g. `--format ts` with `--from-file`, an `--include-schema` name that doesn't exist, a glob migrations-dir, a `--from-file` path that can't be read, or an unreachable connection with `--from-file`. | Fix what the message says.                                                                                  |
| `UNSUPPORTED_OBJECTS`      | `--format ts` or `js`: objects that can't be written as `pgm` calls, or `--strict`.                                                                                                                                            | See [TypeScript Output](#typescript-output), or use `--format sql`.                                         |

### TypeScript Output <Badge type="warning" text="experimental" /> {#typescript-output}

> [!WARNING]
> `--format ts` and `--format js` are experimental. Review the migration before you commit it,
> and expect the output to change between releases. The SQL baseline is the one to rely on.

Instead of running pg_dump, `baseline` reads the database's catalogs (read-only, with the same
few queries however large the schema is) and writes `pgm` calls, with `export const down = false`.
For the [Chinook](https://github.com/lerocha/chinook-database) sample database:

<!-- prettier-ignore -->
```ts
import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder): void => {
  pgm.createTable('album', {
    album_id: 'serial',
    title: { type: 'character varying(160)', notNull: true },
    artist_id: { type: 'integer', notNull: true },
  });

  // …

  pgm.addConstraint('album', 'album_pkey', 'PRIMARY KEY (album_id)');
  pgm.createIndex('album', ['artist_id'], { name: 'album_artist_id_idx' });

  // …
};

export const down = false;
```

The real file also starts with a header comment, and with two `pgm.sql(…)` calls that turn
`check_function_bodies` off until the end, like the SQL baseline.

- It needs a live database, so it can't use `--from-file`. To use a dump, load it into a
  scratch database, see [From a Dump File](#from-a-dump-file). `--pg-dump` and
  `--lock-wait-timeout` don't apply.
- `--include-schema` and `--exclude-schema` work, but extensions are kept whatever their schema,
  and `--include-schema` leaves out casts, which belong to no schema.
- Names are relative to the first `--schema`. Objects in other schemas are written as
  `{ schema, name }`, and column defaults as `pgm.func(…)`, as PostgreSQL stores them.
- Owners, grants, publications, subscriptions, the migrations table and objects that belong to
  an extension are left out, like in the SQL baseline.
- Materialized views are created `WITH NO DATA`, like in the SQL baseline: refresh them after
  the first run.
- Indexes that aren't valid, such as what a failed `CREATE INDEX CONCURRENTLY` leaves, are left
  out like pg_dump does. A partitioned table's are kept.
- With `decamelize: true` in your config, `baseline` refuses names that `decamelize` would
  rename, such as `LegacyCustomer`: identifiers, constraint names and the settings of a
  function's `SET` clause (PostgreSQL stores `SET timezone` as `TimeZone`). Use `--format sql`
  for that database.
- The same migration can be generated without Node.js, from any client with a `query()` (such as
  PGlite in a browser), with the entry point `node-pg-migrate/baseline/catalogs`: see
  [Generating a Baseline Without Node.js](api#baseline-without-node).

**What becomes a `pgm` call:** schemas, extensions, enums and composite types, domains,
sequences, tables with their columns, identity and generated columns and comments,
constraints, indexes, views and materialized views, functions, triggers, row-level security and
policies, casts and operators.

**Fallbacks.** What the `pgm` calls can't express becomes `pgm.sql(…)` under a
`// fallback: <reason>` comment, and `baseline` prints how many there are. With `--strict`, it
writes nothing and fails with `UNSUPPORTED_OBJECTS`, listing each one. The
[Pagila](https://github.com/devrimgunduz/pagila) sample database gets 56 (its 55 partitions and
an aggregate); Chinook gets none.

::: details Every fallback reason

- **Tables** (the whole `CREATE TABLE`): `partition`, `virtual generated column`,
  `storage parameters`, `access method`, `multiple inheritance`, `identity sequence name`,
  `NOT NULL constraint name`, `column settings`, `replica identity`, `partition key`,
  `NOT NULL NO INHERIT`, `NOT NULL NOT VALID`, `bigint option`, `zero option`, `column order`,
  `no columns`, `line break`, `typed table` (`CREATE TABLE … OF type`). Tables written with
  `createTable` can still get `comment on column` (a comment on an inherited column),
  `comment on sequence` (on an identity sequence), `line break` (in an inherited column's
  default) and `comment on constraint` (on a NOT NULL constraint, PostgreSQL 18). A partition
  whose columns are in another order than its parent's is created on its own and attached,
  like pg_dump does.
- **Indexes:** `index method <method>` (not `btree`, `hash`, `gist`, `spgist` or `gin`),
  `operator class`, `collation`, `nulls order`, `storage parameters`, `partition index name`,
  `CLUSTER ON`, `replica identity`, `invalid index` (a partitioned table's `ON ONLY` index that
  isn't valid yet), `column settings` (a statistics target on an expression),
  `partition index settings` and `comment on index` (on the indexes of partitions).
- **Functions:** `procedure`, `SQL-standard body`, `leakproof`, `cost or rows`, `language c`,
  `language internal`, `support function`.
- **Triggers:** `transition tables`, `firing mode` (also for a partition's copy of a trigger),
  `referenced table`, `comment on trigger` (on a partition's copy). A trigger on `UPDATE OF`
  columns is a `pgm.createTrigger` call with `operation: 'UPDATE OF …'`.
- **Policies:** `restrictive policy`.
- **Domains:** `several constraints`, `NOT VALID constraint`.
- **Composite types:** `attribute collation`, `attribute order`.
- **Sequences:** `unlogged sequence`, `bigint option`, `zero option`.
- **Views:** `view options`. **Materialized views:** `storage parameters`, `access method`,
  `column settings`.
- **Operators:** `operator schema`, `commutator or negator`.
- **Constraints:** `CLUSTER ON`, `replica identity`, `line break`,
  `partition index settings`, `comment on index`.
- **Always:** range types, collations, aggregates, rules, extended statistics, shell types
  (`CREATE TYPE name;`), and comments on anything but tables and columns.

:::

**Not supported:** access methods, base types, conversions, event triggers, foreign data
wrappers, servers and tables, procedural languages, operator classes and families, ordered-set
aggregates, text search objects and transforms. If the database has any that don't belong to an
extension, `--format ts` fails with `UNSUPPORTED_OBJECTS`: use the SQL baseline.

### CockroachDB

`baseline` only supports PostgreSQL and refuses CockroachDB (`UNSUPPORTED_SERVER`). Write the
first migration yourself and record it the same way, with `node-pg-migrate up <name> --fake`.
