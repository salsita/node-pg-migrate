# Programmatic API

Alongside command line, you can use `node-pg-migrate` also programmatically. It exports runner function,
which takes options argument with the following structure (similar to [command line arguments](cli.md#configuration)):

## Example

For a directory structure of

```
.
├── migrations
│   ├── 00_init.sql
│   └── 01_foobar.sql
└── run_migrations.js
```

this will run migrations from `migrations/` directory:

```javascript
import { runner } from 'node-pg-migrate';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

await runner({
  databaseUrl: process.env.DATABASE_URL,
  dir: `${import.meta.dirname}/migrations`,
  migrationsTable: 'pgmigrations',
  direction: 'up',
  verbose: true,
});
```

For `direction: 'redo'`, the runner reverts the migrations selected by `count`, `timestamp`,
or `file`, then applies pending migrations on the same connection while retaining its
advisory lock. With `file`, reapplication remains limited to that migration; otherwise, it
includes all pending migrations. Set `singleTransaction: true` explicitly to wrap both phases in one
transaction. On PostgreSQL, a failure in either phase rolls back the attempted changes and
history updates.
The result lists reverted migrations followed by applied migrations.

With `singleTransaction: false` or an omitted option, migrations use individual transactions.
Calling `pgm.noTransaction()` also breaks a shared transaction. These modes can retain
committed changes after a later failure. See the [CLI transaction behavior](cli).

CockroachDB [does not provide full atomicity for DDL](https://www.cockroachlabs.com/docs/v25.3/online-schema-changes).
For `singleTransaction: true` and dry runs, the runner disables and verifies
`autocommit_before_ddl` before setup or migrations, refusing to continue if it cannot be disabled.
If the runner changes this setting on a supplied `dbClient`, it restores the enabled setting
after cleanup, on success or failure; restoration failures are logged without replacing the run's result or error.
This prevents DDL from ending the shared transaction early, but schema changes can still fail
at commit with `XXA00` after other changes have committed. The runner preserves that error and
warns that rollback cannot undo committed changes: inspect the schema, data and migration history
before retrying.

The shared transaction follows CockroachDB's [transactional DDL limitations](https://www.cockroachlabs.com/docs/v25.3/online-schema-changes#schema-changes-within-transactions).
For a table that existed before the transaction, an `UPDATE` cannot reference a column
added during that transaction, including by another migration in the same run. For this pattern, use
`pgm.noTransaction()`, or `singleTransaction: false` with `autocommit_before_ddl` enabled.
Both opt-outs can retain committed changes after a later failure.

Outside dry runs, `singleTransaction: false` or an omitted option leaves `autocommit_before_ddl`
unchanged. When enabled (the [v25 default](https://www.cockroachlabs.com/docs/v25.3/session-variables)),
DDL commits the preceding transaction before executing, even inside a migration's own
transaction; a failed run can retain changes and history updates.

Both phases share a session. Session-level `SET` statements in a down migration carry over
into reapplication, including changes to the role or `lock_timeout`. When `schema` is
configured, the runner reapplies its schema setup and `search_path` before the up phase;
otherwise, changes to `search_path` also carry over.

## Options

> [!NOTE]
> If you use `dbClient`, you should not use `databaseUrl` at the same time and vice versa.

`migrationsTable` is required and must be a non-empty string. Unlike the CLI,
the programmatic API does not default to `pgmigrations`. An omitted or invalid
value causes `runner()` to reject with a `TypeError` before connecting to the
database or issuing queries. See the [upgrade guide](upgrading.md#the-programmatic-api-validates-migrationstable)
if an earlier version created a table named `"undefined"`.

| Option                      | Type                                        | Description                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `databaseUrl`               | `string or object`                          | Connection string or client config which is passed to [new pg.Client](https://node-postgres.com/api/client#constructor)                                                                                                                                                                                                                |
| `dbClient`                  | `pg.Client`                                 | Instance of [new pg.Client](https://node-postgres.com/api/client). Instance should be connected to DB, and after finishing migration, user is responsible to close connection                                                                                                                                                          |
| `migrationsTable`           | `string`                                    | The table storing which migrations have been run (required)                                                                                                                                                                                                                                                                            |
| `migrationsSchema`          | `string`                                    | The schema storing table which migrations have been run (defaults to same value as `schema`). See [Migration History](cli#migration-history)                                                                                                                                                                                           |
| `schema`                    | `string or array[string]`                   | The schema on which migration will be run (defaults to `public`)                                                                                                                                                                                                                                                                       |
| `schemaIsDefault`           | `boolean`                                   | Only matters when `schema` is set: marks it as a default your code filled in, as the CLI does without `--schema`. It still sets the `search_path`, but a run that finds no history there is refused when another schema holds one. A call without `schema` is already treated this way. See [Migration History](cli#migration-history) |
| `dir`                       | `string or array[string]`                   | The directory containing your migration files. This path is resolved from `cwd()`. Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or an array of glob patterns and set `useGlob = true`. Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns                                 |
| `useGlob`                   | `boolean`                                   | Use [glob](https://www.npmjs.com/package/glob) to find migration files. This will use `dir` _and_ `ignorePattern` to glob-search for migration files. Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns                                                                                                 |
| `checkOrder`                | `boolean`                                   | Check order of migrations before running them                                                                                                                                                                                                                                                                                          |
| `direction`                 | `enum`                                      | `up`, `down`, or `redo`                                                                                                                                                                                                                                                                                                                |
| `count`                     | `number`                                    | Amount of migration to run                                                                                                                                                                                                                                                                                                             |
| `timestamp`                 | `boolean`                                   | Treats `count` as timestamp                                                                                                                                                                                                                                                                                                            |
| `ignorePattern`             | `string or array[string]`                   | Regex pattern for file names to ignore (ignores files starting with `.` by default). Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or an array of glob patterns and set `isGlob = true`. Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns                                |
| `file`                      | `string`                                    | Run-only migration with this name                                                                                                                                                                                                                                                                                                      |
| `singleTransaction`         | `boolean`                                   | Runs the migrations in a shared transaction, including both phases of `redo`. Defaults to `false` in the API; the CLI defaults to `true`. See the transaction limitations above                                                                                                                                                        |
| `createSchema`              | `boolean`                                   | Creates the configured schema if it doesn't exist                                                                                                                                                                                                                                                                                      |
| `createMigrationsSchema`    | `boolean`                                   | Creates the configured migration schema if it doesn't exist                                                                                                                                                                                                                                                                            |
| `noLock`                    | `boolean`                                   | Disables locking mechanism and checks                                                                                                                                                                                                                                                                                                  |
| `lockValue`                 | `number`                                    | Value to use for the lock                                                                                                                                                                                                                                                                                                              |
| `advisoryLockMode`          | `fail or wait`                              | Controls behavior when the migration advisory lock is already held by another process. Use `fail` to throw immediately or `wait` to block until the lock becomes available ( defaults to `fail` )                                                                                                                                      |
| `fake`                      | `boolean`                                   | Mark migrations as run without actually performing them (use with caution!)                                                                                                                                                                                                                                                            |
| `dryRun`                    | `boolean`                                   | Print the SQL that would be run without applying anything. Runs inside a read-only transaction, so nothing is created, recorded or written, and no advisory lock is taken. See [Dry Runs](cli#dry-runs)                                                                                                                                |
| `log`                       | `function`                                  | Redirect log messages to this function, rather than `console`                                                                                                                                                                                                                                                                          |
| `logger`                    | `object with debug/info/warn/error methods` | Redirect messages to this logger object, rather than `console`                                                                                                                                                                                                                                                                         |
| `verbose`                   | `boolean`                                   | Print all debug messages like DB queries run (if you switch it on, it will disable `logger.debug` method)                                                                                                                                                                                                                              |
| `decamelize`                | `boolean`                                   | Runs [`decamelize`](https://github.com/salsita/node-pg-migrate/blob/main/src/utils/decamelize.ts) on table/column/etc. names used in migrations (not on `migrationsTable`, `migrationsSchema` or `schema`)                                                                                                                             |
| `pretty`                    | `boolean`                                   | Formats the generated SQL statements with linebreaks and indentation for better readability. When `false` (the default), each statement is emitted as a single line                                                                                                                                                                    |
| `migrationLoaderStrategies` | `MigrationLoaderStrategy[]`                 | Allows custom loading strategies based on file extensions. If omitted, default behavior is used. See [Migration Loading Strategies](migration-loading-strategies).                                                                                                                                                                     |

An explicitly empty `migrationsSchema` rejects with `TypeError` before the database is accessed,
including in dry runs. Omit the option or use `undefined` to retain the existing schema default.
Non-empty schema names are used as supplied, including whitespace and embedded double-quote characters.
The library quotes the identifier itself.

### MigrationLoaderStrategy

```ts
export interface MigrationLoaderStrategy {
  // File extensions handled by this strategy.
  extensions: string[];

  /**
   * Loader that handles conversion of file paths to migration units.
   *
   * @param filePaths - The file paths to load migrations from.
   * @returns The migration units.
   */
  loader: MigrationLoader | 'default' | 'legacySql' | 'sql';
}
```

### MigrationUnit

```ts
export interface MigrationUnit {
  // The unique identifier for the migration unit. Represents the significant part of the file name used for tracking which migrations have been performed.
  id: string;

  // File paths that are part of the migration unit.
  filePaths: string[];

  // The migration builder actions that are contained within the migration files.
  actions: MigrationBuilderActions;
}
```
