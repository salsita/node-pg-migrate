# CLI Usage

You can specify your database connection information using [config](https://www.npmjs.com/package/config).

```json
// config/default.json
{
  "url": "postgres://postgres:password@localhost:5432/database"
}
```

or

```json
// config/default.json
{
  "user": "postgres",
  "password": "",
  "host": "localhost",
  "port": 5432,
  "database": "database"
}
```

You could also specify your database url by setting the environment variable `DATABASE_URL`.

```
DATABASE_URL=postgres://postgres@localhost/database node-pg-migrate
```

You can specify custom JSON file with config (format is same as for `db` entry of [config](https://www.npmjs.com/package/config) file), for example:

```json
// path/to/config.json
{
  "user": "postgres",
  "password": "",
  "host": "localhost",
  "port": 5432,
  "database": "database"
}
```

If a .env file exists, it will be loaded using [dotenv](https://www.npmjs.com/package/dotenv) (if installed) when running the node-pg-migrate binary.

Depending on your project's setup, it may make sense to write some custom grunt/gulp/whatever tasks that set this env var and run your migration commands. More on that below.

**The following are the available commands:**

- `node-pg-migrate create {migration-name}` - creates a new migration file with the name you give it. Dashes will replace spaces and underscores, and a timestamp is prepended to your file name.
- `node-pg-migrate up` - runs all up migrations from the current state.
- `node-pg-migrate up {N}` - runs N up migrations from the current state.
- `node-pg-migrate down` - runs a single down migration.
- `node-pg-migrate down {N}` - runs N down migrations from the current state.
- `node-pg-migrate redo` - redoes last migration (runs a single down migration, then single up migration).
- `node-pg-migrate redo {N}` - redoes N last migrations (runs N down migrations, then N up migrations).

## Configuration

You can adjust defaults by passing arguments to `node-pg-migrate`:

- `config-file` (`f`) - The file with migration JSON config (defaults to undefined)
- `schema` (`s`) - The schema(s) on which migration will be run (defaults to `public`, used to set `search_path`)
- `create-schema` - Create the configured schema if it doesn't exist (defaults to `false`)
- `database-url-var` (`d`) - Name of env variable with database url string (defaults to `DATABASE_URL`)
- `migrations-dir` (`m`) - The directory containing your migration files (defaults to `migrations`)
- `migrations-schema` - The schema storing table which migrations have been run (defaults to same value as `schema`)
- `create-migrations-schema` - Create the configured migrations schema if it doesn't exist (defaults to `false`)
- `migrations-table` (`t`) - The table storing which migrations have been run (defaults to `pgmigrations`)
- `ignore-pattern` - Regex pattern for file names to ignore (e.g. `ignore_file|\..*|.*\.spec\.js`)
- `migration-filename-format` - Choose prefix of file - either UTC (`20200605075829074`) or timestamp (`1591343909074`)
- `migration-file-language` (`j`) - Language of the migration file to create (`js` or `ts`)
- `template-file-name` - Use your own template file for migrations (language will be determined from the extension of the template). The file must export the `up` method accepting `MigrationBuilder` instance.
- `tsconfig` - Path to tsconfig.json. Used to setup transpiling of TS migration files. (Also sets `migration-file-language` to typescript, if not overridden)
- `timestamp` - Treats number argument to up/down migration as timestamp (running up migrations less or equal to timestamp or down migrations greater or equal to timestamp)
- `check-order` - Check order of migrations before running them (defaults to `true`, to switch it off supply `--no-check-order` on the command line).
  (There should be no migration with timestamp lesser than last run migration.)
- `single-transaction` - Combines all pending migrations into a single transaction so that if any migration fails, all will be rolled back (defaults to `true`, to switch it off supply `--no-single-transaction` on the command line).
- `no-lock` - Disables locking mechanism and checks (useful for DBs which does not support SQL commands used for [locking](migrations.md#locking))
- `fake` - Mark migrations as run without actually performing them (use with caution!)
- `decamelize` - Runs [`decamelize`](https://github.com/sindresorhus/decamelize) on table/column/etc. names
- `verbose` - Print all debug messages like DB queries run (defaults to `true`, to switch it off supply `--no-verbose` on the command line)
- `reject-unauthorized` - Sets ssl `rejectUnauthorized` parameter. Use for e.g. self-signed certificates on the server. [see](https://node-postgres.com/announcements#2020-02-25) and [see](https://github.com/brianc/node-postgres/issues/2009)

See all by running `node-pg-migrate --help`.

Most of the configuration options can be also specified in [config](https://www.npmjs.com/package/config) file.

For SSL connection to DB you can set `PGSSLMODE` environment variable to value from [list](https://www.postgresql.org/docs/current/static/libpq-connect.html#LIBPQ-CONNECT-SSLMODE) other then `disable`.
e.g. `PGSSLMODE=require node-pg-migrate up` ([pg](https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md#v260) will take it into account)

### JSON Configuration

You can use [config](https://www.npmjs.com/package/config) or your own json file with configuration (`config-file` command line option).

Available options are:

- Almost all options you can specify on the command line are also supported in config files: `schema`, `create-schema`, `migrations-dir`, `migrations-schema`, `create-migrations-schema`, `migrations-table`, `migration-file-language`, `migration-filename-format`, `ignore-pattern`, `check-order`, `verbose`, `decamelize`, `tsconfig`
- either
  - `url` can be connection string or config object accepted by `pg` [see](https://node-postgres.com/features/connecting#Programmatic)
  - or [`user`], [`password`], `host` (defaults to localhost), `port` (defaults to 5432), `database`, [`ssl`] - for connection details
