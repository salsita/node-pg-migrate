# Programmatic API

Alongside with command line, you can use `node-pg-migrate` also programmatically. It exports runner function,
which takes options argument with following structure (similar to [command line arguments](cli.md#configuration)):

- `databaseUrl` _[string or object]_ - Connection string or client config which is passed to [new pg.Client](https://node-postgres.com/api/client#new-client-config-object-)
- or `dbClient` _[pg.Client]_ - instance of [new pg.Client](https://node-postgres.com/api/client). Instance should be connected to DB and after finishing migration, user is responsible to close connection
- `migrationsTable` _[string]_ - The table storing which migrations have been run
- `migrationsSchema` _[string]_ - The schema storing table which migrations have been run (defaults to same value as `schema`)
- `schema` _[string]_ - The schema on which migration will be run (defaults to `public`)
- `dir` _[string]_ - The directory containing your migration files
- `checkOrder` _[boolean]_ - Check order of migrations before running them
- `direction` _[enum]_ - `up` or `down`
- `count` _[number]_ - Number of migration to run
- `timestamp` _[boolean]_ - Treats `count` as timestamp
- `ignorePattern` _[string]_ - Regex pattern for file names to ignore (ignores files starting with `.` by default)
- `file` _[string]_ - Run only migration with this name
- `singleTransaction` _[boolean]_ - Combines all pending migrations into a single transaction so that if any migration fails, all will be rolled back (defaults to `true`)
- `createSchema` _[boolean]_ - Creates the configured schema if it doesn't exist
- `createMigrationsSchema` _[boolean]_ - Creates the configured migration schema if it doesn't exist
- `noLock` _[boolean]_ - Disables locking mechanism and checks
- `fake` _[boolean]_ - Mark migrations as run without actually performing them (use with caution!)
- `dryRun` _[boolean]_
- `log` _[function]_ - Redirect log messages to this function, rather than `console.log`
