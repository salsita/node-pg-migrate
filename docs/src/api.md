# Programmatic API

Alongside command line, you can use `node-pg-migrate` also programmatically. It exports runner function,
which takes options argument with the following structure (similar to [command line arguments](cli.md#configuration)).
It also exports [`baseline()`](#baseline), the programmatic form of `node-pg-migrate baseline`.

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
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

await runner({
  databaseUrl: process.env.DATABASE_URL,
  dir: `${import.meta.dirname}/migrations`,
  migrationsTable: 'pgmigrations',
  direction: 'up',
  verbose: true,
});
```

## Options

> [!NOTE]
> If you use `dbClient`, you should not use `databaseUrl` at the same time and vice versa.

| Option                      | Type                                        | Description                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `databaseUrl`               | `string or object`                          | Connection string or client config which is passed to [new pg.Client](https://node-postgres.com/api/client#constructor)                                                                                                                                                                                                                |
| `dbClient`                  | `pg.Client`                                 | Instance of [new pg.Client](https://node-postgres.com/api/client). Instance should be connected to DB, and after finishing migration, user is responsible to close connection                                                                                                                                                          |
| `migrationsTable`           | `string`                                    | The table storing which migrations have been run                                                                                                                                                                                                                                                                                       |
| `migrationsSchema`          | `string`                                    | The schema storing table which migrations have been run (defaults to same value as `schema`). See [Migration History](cli#migration-history)                                                                                                                                                                                           |
| `schema`                    | `string or array[string]`                   | The schema on which migration will be run (defaults to `public`)                                                                                                                                                                                                                                                                       |
| `schemaIsDefault`           | `boolean`                                   | Only matters when `schema` is set: marks it as a default your code filled in, as the CLI does without `--schema`. It still sets the `search_path`, but a run that finds no history there is refused when another schema holds one. A call without `schema` is already treated this way. See [Migration History](cli#migration-history) |
| `dir`                       | `string or array[string]`                   | The directory containing your migration files. This path is resolved from `cwd()`. Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or an array of glob patterns and set `useGlob = true`. Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns                                 |
| `useGlob`                   | `boolean`                                   | Use [glob](https://www.npmjs.com/package/glob) to find migration files. This will use `dir` _and_ `ignorePattern` to glob-search for migration files. Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns                                                                                                 |
| `checkOrder`                | `boolean`                                   | Check order of migrations before running them                                                                                                                                                                                                                                                                                          |
| `direction`                 | `enum`                                      | `up` or `down`                                                                                                                                                                                                                                                                                                                         |
| `count`                     | `number`                                    | Amount of migration to run                                                                                                                                                                                                                                                                                                             |
| `timestamp`                 | `boolean`                                   | Treats `count` as timestamp                                                                                                                                                                                                                                                                                                            |
| `ignorePattern`             | `string or array[string]`                   | Regex pattern for file names to ignore (ignores files starting with `.` by default). Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or an array of glob patterns and set `isGlob = true`. Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns                                |
| `file`                      | `string`                                    | Run-only migration with this name                                                                                                                                                                                                                                                                                                      |
| `singleTransaction`         | `boolean`                                   | Combines all pending migrations into a single transaction so that if any migration fails, all will be rolled back (defaults to `true`)                                                                                                                                                                                                 |
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

## Baseline

`baseline()` writes a baseline migration for a database that node-pg-migrate didn't create,
like [`node-pg-migrate baseline`](baseline), and returns what it wrote. It logs the same lines
as the CLI through `logger`.

```javascript
import { baseline } from 'node-pg-migrate';

const result = await baseline({
  databaseUrl: process.env.DATABASE_URL,
  dir: 'migrations',
});

console.log(result.fakeCommand);
// node-pg-migrate up 1789084800000_baseline --fake
```

When the options, the database or the dump can't make a baseline, it throws a `BaselineError`
(exported too) and writes nothing. Its `code` says what went wrong (see
[Error Codes](baseline#error-codes)), and its `message` says what to do.

### Baseline Options

> [!NOTE]
> Pass either `databaseUrl` or `dbClient`, not both. pg_dump can't use `dbClient`, so a SQL
> baseline with only a `dbClient` needs `fromFile` (the client then checks the migration history).

| Option             | Type                                        | Description                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `databaseUrl`      | `string or object`                          | Connection string or client config which is passed to [new pg.Client](https://node-postgres.com/api/client#constructor). pg_dump gets the same settings through `PG*` environment variables. Optional with `fromFile` |
| `dbClient`         | `pg.Client`                                 | Instance of [new pg.Client](https://node-postgres.com/api/client), connected to the database. `baseline()` doesn't close it                                                                                           |
| `dir`              | `string`                                    | The directory the migration is written to, resolved from `cwd()`. It is created if it doesn't exist, and must not have any file yet                                                                                   |
| `name`             | `string`                                    | The migration name, after the file name prefix (defaults to `baseline`)                                                                                                                                               |
| `migrationsTable`  | `string`                                    | The table storing which migrations have been run (defaults to `pgmigrations`). It must not record any migration, and is left out of the dump                                                                          |
| `migrationsSchema` | `string`                                    | The schema storing table which migrations have been run (defaults to the first `schema`, else `public`)                                                                                                               |
| `schema`           | `string or array[string]`                   | The schema(s) on which migrations will be run, as for `runner()`. It doesn't limit the dump: see `includeSchemas`                                                                                                     |
| `fromFile`         | `string`                                    | Path of a `pg_dump --schema-only` output to clean up instead of running pg_dump; `'-'` reads standard input                                                                                                           |
| `pgDump`           | `string`                                    | The pg_dump executable to run (defaults to `pg_dump`). Its major version must be at least the server's                                                                                                                |
| `includeSchemas`   | `array[string]`                             | Only dump these schemas (`pg_dump --schema`), or only read them with `format` `ts` or `js`                                                                                                                            |
| `excludeSchemas`   | `array[string]`                             | Leave these schemas out of the dump (`pg_dump --exclude-schema`), or of what `format` `ts` or `js` reads                                                                                                              |
| `lockWaitTimeout`  | `string`                                    | How long pg_dump waits for table locks before it fails (defaults to `'10s'`)                                                                                                                                          |
| `filenameFormat`   | `timestamp`, `utc` or `index`               | Prefix of the migration file name (defaults to `timestamp`)                                                                                                                                                           |
| `logger`           | `object with debug/info/warn/error methods` | Redirect messages to this logger object, rather than `console`                                                                                                                                                        |
| `format`           | `sql`, `ts` or `js`                         | The language of the migration (defaults to `sql`). `ts` and `js` are [experimental](baseline#typescript-output), need a connection and can't be combined with `fromFile`                                              |
| `strict`           | `boolean`                                   | With `format` `ts` or `js`: throw `UNSUPPORTED_OBJECTS` instead of writing a migration with raw SQL fallbacks (defaults to `false`)                                                                                   |
| `decamelize`       | `boolean`                                   | With `format` `ts` or `js`: whether the migrations run with `decamelize`, as for `runner()`. Then a database with identifiers that it would rename is refused with `INVALID_OPTIONS` (defaults to `false`)            |

### Baseline Result

| Property                         | Type            | Description                                                                                                             |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `path`                           | `string`        | Absolute path of the written migration                                                                                  |
| `migrationName`                  | `string`        | The file name without its extension, as the migrations table records it                                                 |
| `fakeCommand`                    | `string`        | The command that records the migration without running it, e.g. `node-pg-migrate up 1789084800000_baseline --fake`      |
| `relations`                      | `number`        | About how many relations the migration creates in its transaction                                                       |
| `requiredMaxLocksPerTransaction` | `number`        | The `max_locks_per_transaction` blank databases need, only set when it is more than the default of 64                   |
| `warnings`                       | `string[]`      | What you should know about the migration; each one is also logged as a warning                                          |
| `source`                         | `object`        | Where the schema came from, as far as known: `serverVersion`, `pgDumpVersion` and `file` (`'stdin'` for standard input) |
| `fallbacks`                      | `array[object]` | With `format` `ts` or `js`: the objects written as raw SQL, each with its `kind`, `identity` and `reason`               |
