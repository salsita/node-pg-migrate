# Programmatic API

Alongside command line, you can use `node-pg-migrate` also programmatically. It exports runner function,
which takes options argument with the following structure (similar to [command line arguments](cli.md#configuration)):

## Options

>[!NOTE]
> If you use `dbClient`, you should not use `databaseUrl` at the same time and vice versa.

| Option                   | Type                                        | Description                                                                                                                                                                   |
|--------------------------|---------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `databaseUrl`            | `string or object`                          | Connection string or client config which is passed to [new pg.Client](https://node-postgres.com/api/client#constructor)                                                       |
| `dbClient`               | `pg.Client`                                 | Instance of [new pg.Client](https://node-postgres.com/api/client). Instance should be connected to DB, and after finishing migration, user is responsible to close connection |
| `migrationsTable`        | `string`                                    | The table storing which migrations have been run                                                                                                                              |
| `migrationsSchema`       | `string`                                    | The schema storing table which migrations have been run (defaults to same value as `schema`)                                                                                  |
| `schema`                 | `string or array[string]`                   | The schema on which migration will be run (defaults to `public`)                                                                                                              |
| `dir`                    | `string`                                    | The directory containing your migration files                                                                                                                                 |
| `checkOrder`             | `boolean`                                   | Check order of migrations before running them                                                                                                                                 |
| `direction`              | `enum`                                      | `up` or `down`                                                                                                                                                                |
| `count`                  | `number`                                    | Amount of migration to run                                                                                                                                                    |
| `timestamp`              | `boolean`                                   | Treats `count` as timestamp                                                                                                                                                   |
| `ignorePattern`          | `string`                                    | Regex pattern for file names to ignore (ignores files starting with `.` by default)                                                                                           |
| `file`                   | `string`                                    | Run-only migration with this name                                                                                                                                             |
| `singleTransaction`      | `boolean`                                   | Combines all pending migrations into a single transaction so that if any migration fails, all will be rolled back (defaults to `true`)                                        |
| `createSchema`           | `boolean`                                   | Creates the configured schema if it doesn't exist                                                                                                                             |
| `createMigrationsSchema` | `boolean`                                   | Creates the configured migration schema if it doesn't exist                                                                                                                   |
| `noLock`                 | `boolean`                                   | Disables locking mechanism and checks                                                                                                                                         |
| `fake`                   | `boolean`                                   | Mark migrations as run without actually performing them (use with caution!)                                                                                                   |
| `dryRun`                 | `boolean`                                   |                                                                                                                                                                               |
| `log`                    | `function`                                  | Redirect log messages to this function, rather than `console`                                                                                                                 |
| `logger`                 | `object with debug/info/warn/error methods` | Redirect messages to this logger object, rather than `console`                                                                                                                |
| `verbose`                | `boolean`                                   | Print all debug messages like DB queries run (if you switch it on, it will disable `logger.debug` method)                                                                     |
| `decamelize`             | `boolean`                                   | Runs [`decamelize`](https://github.com/salsita/node-pg-migrate/blob/main/src/utils/decamelize.ts) on table/column/etc. names                                                  |

