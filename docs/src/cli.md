# CLI Usage

## Database Connection

You can specify your database connection information using [config](https://www.npmjs.com/package/config).

```jsonc
// config/default.json
{
  "db": {
    "url": "postgres://postgres:password@localhost:5432/database",
  },
}
```

or

```jsonc
// config/default.json
{
  "db": {
    "user": "postgres",
    "password": "",
    "host": "localhost",
    "port": 5432,
    "database": "database",
  },
}
```

You could also specify your database url by setting the environment variable `DATABASE_URL`.

```
DATABASE_URL=postgres://postgres@localhost/database node-pg-migrate
```

You can specify custom JSON file with config (the format is same as for `db` entry
of [config](https://www.npmjs.com/package/config) file), for example:

```jsonc
// path/to/config.json
{
  "user": "postgres",
  "password": "",
  "host": "localhost",
  "port": 5432,
  "database": "database",
}
```

> [!TIP]
> If a `.env` file exists, it will be loaded using [dotenv](https://www.npmjs.com/package/dotenv) (if installed) when
> running the node-pg-migrate binary.
> If the .env file is not on the same level where the command has been called, you
> can
> use the `--envPath` option to point to the location of your .env file.

Depending on your project's setup, it may make sense to write some custom grunt/gulp/whatever tasks that set this env
var and run your migration commands.
More on that below.

## Available Commands

| Command                                   |                                                       Description                                                       |
| ----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------: |
| `node-pg-migrate create {migration-name}` | creates a new migration file with a timestamp prepended to the name you provide. Dashes replace spaces and underscores. |
| `node-pg-migrate up`                      |                                     runs all up migrations from the current state.                                      |
| `node-pg-migrate up {N}`                  |                                      runs N up migrations from the current state.                                       |
| `node-pg-migrate down`                    |                                              runs a single down migration.                                              |
| `node-pg-migrate down {N}`                |                                     runs N down migrations from the current state.                                      |
| `node-pg-migrate redo`                    |                     redoes last migration (runs a single down migration, then single up migration).                     |
| `node-pg-migrate redo {N}`                |                        redoes N last migrations (runs N down migrations, then N up migrations).                         |

## Configuration

> [!TIP]
> See all by running `node-pg-migrate --help`.
>
> Most of the configuration options can be also specified in [config](https://www.npmjs.com/package/config) file.

You can adjust defaults by passing arguments to `node-pg-migrate`:

| Argument                    | Aliases | Default                         | Description                                                                                                                                                                                                                                                                             |
| --------------------------- | ------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config-file`               | `f`     | `undefined`                     | The file with migration JSON config                                                                                                                                                                                                                                                     |
| `config-value`              |         | `db`                            | Name of config section with db options                                                                                                                                                                                                                                                  |
| `schema`                    | `s`     | `public`                        | The schema(s) on which migration will be run, used to set `search_path`                                                                                                                                                                                                                 |
| `create-schema`             |         | `false`                         | Create the configured schema if it doesn't exist                                                                                                                                                                                                                                        |
| `database-url-var`          | `d`     | `DATABASE_URL`                  | Name of env variable with database url string                                                                                                                                                                                                                                           |
| `migrations-dir`            | `m`     | `migrations`                    | The directory containing your migration files. This path is resolved from `cwd()`. Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern and set `--use-glob`. Note: enabling glob will read both, `--migrations-dir` _and_ `--ignore-pattern` as glob patterns   |
| `use-glob`                  |         | `false`                         | Use [glob](https://www.npmjs.com/package/glob) to find migration files. This will use `--migrations-dir` _and_ `--ignore-pattern` to glob-search for migration files.                                                                                                                   |
| `migrations-schema`         |         | same value as `schema`          | The schema storing table which migrations have been run                                                                                                                                                                                                                                 |
| `create-migrations-schema`  |         | `false`                         | Create the configured migrations schema if it doesn't exist                                                                                                                                                                                                                             |
| `migrations-table`          | `t`     | `pgmigrations`                  | The table storing which migrations have been run                                                                                                                                                                                                                                        |
| `ignore-pattern`            |         | `undefined`                     | Regex pattern for file names to ignore (ignores files starting with `.` by default). Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern and set `--use-glob`. Note: enabling glob will read both, `--migrations-dir` _and_ `--ignore-pattern` as glob patterns |
| `migration-filename-format` |         | `timestamp`                     | Choose prefix of file, `utc` (`20200605075829074`), `timestamp` (`1591343909074`), `iso` (`2020-06-05T07:58:29.074Z`) or `index` (`0012`))                                                                                                                                              |
| `migration-file-language`   | `j`     | `js`                            | Language of the migration file to create (`js`, `ts` or `sql`)                                                                                                                                                                                                                          |
| `template-file-name`        |         | `undefined`                     | Utilize a custom migration template file with language inferred from its extension. The file should export the up method, accepting a MigrationBuilder instance.                                                                                                                        |
| `tsconfig`                  |         | `undefined`                     | Path to tsconfig.json. Used to setup transpiling of TS migration files. (Also sets `migration-file-language` to typescript, if not overridden)                                                                                                                                          |
| `envPath`                   |         | `same level where it's invoked` | Retrieve the path to a .env file. This feature proves handy when dealing with nested projects or when referencing a global .env file.                                                                                                                                                   |
| `timestamp`                 |         | `false`                         | Treats number argument to up/down migration as timestamp (running up migrations less or equal to timestamp or down migrations greater or equal to timestamp)                                                                                                                            |
| `check-order`               |         | `true`                          | Check order of migrations before running them, to switch it off supply `--no-check-order`                                                                                                                                                                                               |
| `single-transaction`        |         | `true`                          | Combines all pending migrations into a single transaction so that if any migration fails, all will be rolled back, to switch it off supply `--no-single-transaction`                                                                                                                    |
| `no-lock`                   |         | `false`                         | Disables locking mechanism and checks                                                                                                                                                                                                                                                   |
| `fake`                      |         | `false`                         | Mark migrations as run without actually performing them, (use with caution!)                                                                                                                                                                                                            |
| `decamelize`                |         | `false`                         | Runs `decamelize` on table/column/etc. names                                                                                                                                                                                                                                            |
| `verbose`                   |         | `true`                          | Print all debug messages like DB queries run, to switch it off supply `--no-verbose`                                                                                                                                                                                                    |
| `reject-unauthorized`       |         | `undefined`                     | Sets ssl `rejectUnauthorized` parameter. Use for e.g. self-signed certificates on the server. [see](https://node-postgres.com/announcements#2020-02-25)                                                                                                                                 |

For SSL connection to DB you can set `PGSSLMODE` environment variable to value
from [list](https://www.postgresql.org/docs/current/static/libpq-connect.html#LIBPQ-CONNECT-SSLMODE) other
than `disable`.
e.g. `PGSSLMODE=require node-pg-migrate up` ([pg](https://github.com/brianc/node-postgres/blob/main/CHANGELOG.md#v260)
will take it into account)

### JSON Configuration

> [!TIP]
> You can use [config](https://www.npmjs.com/package/config) or your own json file with configuration
> (`config-file` command line option).

You can also specify your database connection here, [see](#database-connection).

Other available options are:

```jsonc
{
  "schema": "public",
  "createSchema": false,
  "migrationsDir": "migrations",
  "migrationsSchema": "public",
  "createMigrationsSchema": false,
  "migrationsTable": "pgmigrations",
  "migrationFilenameFormat": "utc",
  "migrationFileLanguage": "js",
  "ignorePattern": undefined,
  "checkOrder": true,
  "verbose": true,
  "decamelize": false,
  "tsconfig": "tsconfig.json",
}
```
