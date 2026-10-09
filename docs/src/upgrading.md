# Upgrading

This page documents the changes you need to be aware of when upgrading between
major versions of `node-pg-migrate`.

## From v9 to v10

### Migration history corrections

Migration names containing apostrophes are now recorded exactly. This does not
repair history written by older versions: for example, `0001_users''table.cjs`
could have been recorded as `0001_users'table`. Before running migrations after
upgrading, compare affected files with your configured `migrationsTable` and
the database's actual state. For a confirmed applied migration, update the
existing row's `name` to the exact filename without its extension
(`0001_users''table` in this example), preserving `id` and `run_on`.

If the correct name is already recorded too, reconcile the duplicate entries
first. Disabling order checking does not repair old names and can replay an
already-applied migration. Schema changes left unrecorded by an earlier failed
run also need manual reconciliation before retrying.

### Migration action direction

`Migration` instances can now be reused after an inferred `down`: subsequent
`up` calls execute forward SQL and insert their history rows. If `up` and `down`
explicitly share a function, it now executes as written in both directions,
with history recording the requested direction instead of always deleting.

The underscore-prefixed internal helpers also changed: `_getMarkAsRun(direction)`
accepts a direction instead of an action function, and `_apply(action, pgm, direction)`
requires a third parameter. Callers should use `apply(direction)` or
`markAsRun(direction)` rather than relying on these internal helpers.

### Programmatic redo

`runner()` now supports `direction: 'redo'` to revert the selected migrations and reapply
pending migrations using one connection and advisory lock. See the [Programmatic API](api).

`RunnerOptionConfig.direction` now accepts `MigrationDirection | 'redo'`. TypeScript code
that reads this option and passes it to an API accepting `MigrationDirection` (`'up'` or
`'down'`) must narrow out `'redo'` first.

### Breaking changes

#### CockroachDB shared transactions disable DDL autocommit

The runner now disables `autocommit_before_ddl` for shared transactions, including the
CLI's default `up`, `down` and `redo` runs. On CockroachDB v25, migrations that previously
relied on DDL autocommit can now fail: for a table created by an earlier run, an `UPDATE`
cannot reference a column added during the same transaction, even by another migration in the run.

Use `pgm.noTransaction()` for affected migrations, or `--no-single-transaction`
(`singleTransaction: false` in the API) with `autocommit_before_ddl` enabled. These opt-outs
can retain committed changes after failure. See the [CockroachDB transaction limitations](cli).

#### The programmatic API validates migrationsTable

`runner()` now rejects a missing, empty or non-string `migrationsTable` with a
`TypeError` before accessing the database. This option was already required by
the TypeScript API. JavaScript callers must also supply it explicitly; the CLI
continues to default to `pgmigrations`.

Earlier versions could create a history table named `"undefined"` when this
option was omitted. Before changing your configuration, inspect the existing
history in the schema where migrations were run. To continue using that history,
pass `migrationsTable: 'undefined'`, or deliberately rename the existing table
while preserving its rows and then configure the new name. Switching directly
to `pgmigrations` without transferring the history can replay already-applied
migrations. This validation does not rename or repair existing history tables.

If `pgmigrations` does not already exist, rename the existing table with:

```sql
ALTER TABLE "public"."undefined" RENAME TO pgmigrations;
```

Use the schema containing the existing history: `migrationsSchema` when set,
otherwise `schema` (its first non-empty entry if it is a list), or `public` by
default. Renaming preserves the rows and the `id` sequence. If `pgmigrations`
already exists in that schema, inspect the applied migrations and reconcile
duplicate names and execution order before merging the two histories and
switching to it, instead of renaming over the existing table.

#### The CLI now uses subcommands

The command-line parser was rewritten around idiomatic subcommands. Options now
belong to the command they apply to and must be passed **after** the command:

```bash
node-pg-migrate up --pretty -m migrations # [!code ++]
node-pg-migrate --pretty up -m migrations # [!code --]
```

Each command has its own help (`node-pg-migrate up --help`,
`node-pg-migrate create --help`, …). The `migration-file-language` (`-j`),
`migration-filename-format` and `template-file-name` options are only valid on
the `create` command.

If you previously used a package.json script that placed options before the
command, move the options after it:

```jsonc
{
  "scripts": {
    "migrate": "node-pg-migrate -j ts", // [!code --]
    "migrate": "node-pg-migrate", // [!code ++]
  },
}
```

```bash
npm run migrate create my-migration -j ts
```

The version flag is `-i`/`--version` (unchanged), and the minimum supported
Node.js version is now `>=22.12.0`.

#### SQL statements are now single-line by default

The generated SQL statements are now emitted on a **single line by default**.
Previously, statements were always formatted across multiple lines with
indentation.

This is purely cosmetic — the SQL is semantically identical — but it changes the
output you see in logs, dry runs, and `MigrationBuilder.getSql()`. If you snapshot
or assert on the generated SQL, update those expectations accordingly.

To restore the previous multi-line formatting, enable the new `pretty` option:

```bash
node-pg-migrate up --pretty
```

```jsonc
{
  "pretty": true,
}
```

Or, when using the programmatic API, pass `pretty: true` to `runner()`.

#### `--dry-run` no longer writes to the database

`--dry-run` used to suppress only the _generated_ SQL. Everything else still ran for real:
it created the migrations schema and the migrations table, `--fake --dry-run` inserted into
(or deleted from) the migrations table, and any statement a migration issued itself through
`pgm.db.query(...)` was executed - including destructive ones.

A dry run now runs inside a read-only transaction (`BEGIN; SET TRANSACTION READ ONLY;`), so
the database refuses every write. In practice:

- the migrations schema and table are no longer created - if you relied on
  `up --dry-run` to provision them, run a real migration instead;
- `--fake --dry-run` prints the `INSERT`/`DELETE` and records nothing;
- a migration that writes through `pgm.db.query(...)` now **fails** under `--dry-run`
  instead of silently applying its changes;
- no advisory lock is taken, so a dry run can no longer block (or be blocked by) a real
  migration.

On CockroachDB, `autocommit_before_ddl` is turned off for the session first, because v25 and
newer would otherwise commit DDL out of the transaction. If that cannot be guaranteed, the
dry run refuses to start rather than proceed.

`Migration.markAsRun()` now resolves to `void` instead of the `pg` `QueryResult`; it does not
query at all during a dry run.

See [Dry Runs](cli#dry-runs) for the full behavior and its limitations.

#### A missing migrations table no longer means a new database

A run used to take a missing or empty migrations table for a database no migration had ever
run against, and replay every migration - even when the history was sitting in another schema,
for instance the one your role's `search_path` points at, or the one an earlier `--schema`
named. The replay failed half-way (`relation "…" does not exist`) or silently duplicated
objects into the wrong schema, `public` by default.

Such a run is now refused before it creates anything, and the error names the table it found
and the option that points the run at it:

- if your objects live in that schema too, pass `--schema <schema>` (`schema` in the API);
- if only the history lives there, or you reordered a `--schema` list, pass
  `--migrations-schema <schema>` (`migrationsSchema`);
- to start a new history on purpose, pin it with `--migrations-schema <schema>`
  (`migrationsSchema`), which unlike `--schema` leaves the `search_path` alone.

One schema per tenant (`--schema tenant_a`, `--schema tenant_b`, …) keeps working unchanged, and
`redo` re-applies into the migrations table it has just reverted from. Two separate runs cannot
tell, though: after `down 0`, the `up` that follows finds an empty migrations table and is
refused while another schema holds a history. Pass `--migrations-schema public` to start over.

This applies to `runner()` too. A call without `schema` gets the same check as the CLI's
default, since `public` is then only a fallback; to start a new history there, pass
`migrationsSchema: 'public'`. If your own code fills in `schema` as a default, also pass
`schemaIsDefault: true`. See [Migration History](cli#migration-history).

#### The migrations table is named exactly as configured

Under `decamelize`, the migrations table and schema names were decamelized in some statements
and not in others, so `-t pgMigrations --decamelize` or `-s myApp --create-schema --decamelize`
could not work. `migrations-table`, `migrations-schema` and `schema` are now always used as
given: `-t pgMigrations` is the table `"pgMigrations"`. Names that `decamelize` leaves as they
are, like the default `pgmigrations`, are not affected.

#### Privileges no longer hide the migrations table

The migrations table and its primary key are now looked up in the system catalogs instead of
`information_schema`, which only lists objects the connected role holds privileges on. A role
without privileges on an existing migrations table now gets the database's permissions error
instead of `relation "pgmigrations" already exists`.

#### Hyphenated index columns are quoted as identifiers

`createIndex('measurements', 'a-b')` now indexes the column `"a-b"` instead of
the subtraction expression `a - b`. This also applies to `[{ name: 'a-b' }]`.
If a migration intentionally indexes subtraction, use `a - b` or `(a-b)`.
We recommend an explicit index name for string expressions, but it is optional.
The explicitly quoted `"a-b"` workaround remains valid.

Generated index names are unchanged. For example, an index created in v9 with
`createIndex('measurements', 'a-b', { unique: true })` is still named
`measurements_a-b_unique_index`. Both
`dropIndex('measurements', 'a-b', { unique: true })` and the original migration's
automatic reversal continue to target that index.

Upgrading does not rebuild indexes that were already created on the wrong
expression. Inspect affected indexes with `pg_get_indexdef`, resolve any duplicate
column values, and use a new corrective migration to drop and recreate the
intended unique index. See [Index Operations](migrations/indexes).

#### Grouped SQL filenames and existing history

With `loader: 'sql'`, uppercase and mixed-case SQL extensions now group correctly:
`001_init.up.SQL` and `001_init.down.SqL` form one migration named `001_init`.
The split migration ID always ends in lowercase `.sql`.

Earlier versions could apply these files separately and record `001_init.up`
and `001_init.down`. Before upgrading, inspect the affected database and your
configured `migrationsTable` (in `migrationsSchema`, if configured). For an
already-applied migration, rename its `001_init.up` history entry to `001_init`
and remove its corresponding `001_init.down` entry if present. Keep the up
entry's `id` and `run_on` values. If `001_init` is already recorded, reconcile
the duplicate history against the database's actual state first.

The loader does not rewrite history automatically. Disabling `checkOrder` does
not correct old names and can execute an already-applied migration again.

Direction tokens must also be lowercase: filenames ending in `.UP.sql`,
`.Down.SQL`, or other non-lowercase variants now throw before migration SQL is
read or executed. Rename those tokens to `.up` and `.down` and, if already
applied, reconcile their case-sensitive history names using the same process.
The default and `legacySql` loaders are unchanged. See
[Migration Loading Strategies](migration-loading-strategies#example-use-grouped-sql-loader).

#### Named table grants ignore the top-level `schema`

`grantOnTables` and `revokeOnTables` used to treat any top-level `schema` as
`ALL TABLES IN SCHEMA`, even when `tables` named specific tables. Now `schema`
applies only with `tables: 'ALL'`. Named tables are used as given; qualify them
with `{ schema: 'app', name: 'foo' }`. Unqualified names resolve through the
connection's `search_path`, which the runner's `schema` option sets when
supplied. If no matching table is visible through that path, replay or rollback
can now fail with `relation "foo" does not exist`.

If a migration already applied with v9 combined named `tables` with `schema`,
its automatic rollback now revokes only the named tables, leaving privileges
on the other tables behind. Upgrading does not remove those privileges
automatically. Inspect existing grants and revoke remaining unintended
privileges with a new corrective migration. Use
`tables: 'ALL', schema: 'app'` only if revoking the specified privileges from
every table in that schema is intended; select individual tables when
independently granted privileges must remain. See
[Grant Operations](migrations/grants).

## From v8 to v9

`v9` is a **bridge release**: it modernizes the internals (new TypeScript
loader, pluggable loader strategies, stricter validation, Ox-based toolchain)
while staying friendly to the same runtimes as `v8`.

The **minimum Node.js version is unchanged** (`>=20.11.0`), and the package
remains **ESM-only** (as it already was in `v8`).

### Breaking changes

#### TypeScript / modern JS is now loaded via `jiti`

TypeScript and mixed-extension migrations are now handled out of the box by
[jiti](https://github.com/unjs/jiti), which ships as a dependency. You no longer
need to install and wire up `ts-node`, `tsx`, or Babel yourself.

As a result, the following CLI flags have been **removed**:

- `--ts-node`
- `--tsx`
- `--tsconfig`

Update your `package.json` scripts accordingly:

```jsonc
{
  "scripts": {
    "migrate": "ts-node node_modules/.bin/node-pg-migrate -j ts", // [!code --]
    "migrate": "node-pg-migrate -j ts", // [!code ++]
  },
}
```

If you relied on Babel (`babel-node`, `babel-core/register`) to transpile
migrations, that setup is no longer required — remove it and let `jiti` handle
transpilation.

If you used `--tsconfig` to resolve `tsconfig.json` path aliases, use the new
`--tsconfig-paths` flag instead. Pass `true` to auto-discover `tsconfig.json`,
or a path to a specific file:

```bash
node-pg-migrate up -j ts --tsconfig-paths true
node-pg-migrate up -j ts --tsconfig-paths ./config/tsconfig.json
```

See the [TypeScript FAQ](./faq/typescript) for the full setup.

#### Stricter input validation

Several operations that previously accepted empty options — silently producing
invalid or no-op SQL — now **throw an error early** instead. Review any calls
that may pass no options:

| Operation       | Now throws when                    |
| --------------- | ---------------------------------- |
| `addConstraint` | no constraint options are provided |
| `alterPolicy`   | no policy options are provided     |
| `alterSequence` | no sequence options are provided   |
| `alterTable`    | no table options are provided      |

If one of these throws after upgrading, it is surfacing a migration that was
already generating invalid SQL — fix the call by passing the intended options.

#### `indexMethod` is now typed as `string` (TypeScript only)

In the operator-family helpers (`createOperatorFamily`, `addToOperatorFamily`,
`renameOperatorClass`, `dropOperatorFamily`, …), the `indexMethod` parameter is
now typed as `string` instead of `Name`. This is a type-level change only; the
generated SQL is identical. If you passed an object `Name` (e.g.
`{ schema, name }`) for the index method, pass the plain method name string
(e.g. `'gist'`, `'btree'`) instead.

#### `StringIdGenerator` removed (internal utility)

The internal `StringIdGenerator` class was replaced by a generator function.
This was never part of the public root export; the change only affects code that
reached into the `node-pg-migrate/utils` subpath to import it directly.

#### Bundled dependency bumps

Internal dependencies were upgraded — `yargs` `17 → 18` and `glob` `11 → 13`.
These are used internally and require no changes for typical usage, but are worth
noting if you extend the CLI or rely on glob-based ignore patterns.

### Notable new features

None of these require action, but they may simplify your setup:

- **Migration loader strategies + grouped SQL migrations** — pluggable control
  over how migration files are discovered and grouped. See
  [Migration Loading Strategies](./migration-loading-strategies).
- **Index-based filename naming strategy** — an alternative to timestamp-based
  filenames.
- **More `create` file extensions** — in addition to `js`, `ts`, and `sql`, the
  `create` command now supports `cjs`, `mjs`, `cts`, and `mts`.
- **Advisory lock mode** — control what happens when the migration advisory lock
  is already held, via `--advisory-lock-mode fail | wait`.
- **`renameIndex`** operation.
- **`createIndex` `nulls` option** and **`PgLiteral` support in index
  expressions**.
- **Array column type option** for column definitions.
- **`dropConstraint` `ifExists` / table guard** for idempotent retries.
