# Migration Loading Strategies

`migrationLoaderStrategies` lets you control how migration files are loaded based on file extension.

This is useful when you need custom loading behavior, or when you want SQL files to use the new grouped `.up.sql` / `.down.sql` strategy.

## Default Behavior

If `migrationLoaderStrategies` is not provided, the loader uses built-in defaults:

- `.sql` files use the legacy SQL loader (`legacySql`)
- `.js` , `.ts`, `.cjs`, `.mjs`, `.cts` and `.mts` files use the default loader (`default`)
- unsupported extensions fall back to `default`

This keeps existing behavior intact.

## Configuration Shape

```ts
type MigrationLoader = (filePaths: string[]) => Promise<MigrationUnit[]>;

interface MigrationLoaderStrategy {
  extensions: string[];
  loader: MigrationLoader | 'default' | 'legacySql' | 'sql';
}
```

## Example: Use Grouped SQL Loader

This enables grouping `*.up.sql` and `*.down.sql` into one migration unit:

```ts
import { runner } from 'node-pg-migrate';

await runner({
  databaseUrl: process.env.DATABASE_URL!,
  dir: 'migrations',
  direction: 'up',
  migrationsTable: 'pgmigrations',
  migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
});
```

With this configuration:

- `001_init.up.sql` + `001_init.down.sql` are treated as one migration (`001_init`)
- The final SQL extension is case-insensitive: `001_init.up.SQL` + `001_init.down.SqL` also form one migration. Filename stems and source paths retain their case.
- The `.up` and `.down` direction tokens must be lowercase. Names such as `001_init.UP.SQL` or `001_init.Down.sql` throw an error before migration SQL is read or executed.
- The split migration `id` always ends in lowercase `.sql`, regardless of the files' extension case (`001_init.up.SQL` / `001_init.down.SqL` -> `001_init.sql`). This means you can switch from a single `001_init.sql` migration to split `.up/.down` files (or vice versa) without creating a second entry in `migrationsTable`.
- `001_init.sql` still works as a single-file SQL migration
- mixing `001_init.sql` with `001_init.up.sql` / `001_init.down.sql` throws an error

If you already applied uppercase or mixed-case extension split files with
`loader: 'sql'`, their history may contain separate `001_init.up` and
`001_init.down` entries. Before upgrading, rename the applied up entry to
`001_init` and remove the corresponding down entry if present. See the
[upgrade instructions](upgrading#grouped-sql-filenames-and-existing-history)
for the required history and filename adjustments.

## Example: Custom Loader

You can provide a loader function directly:

```ts
import type { MigrationLoader } from 'node-pg-migrate';
import { runner } from 'node-pg-migrate';

const customLoader: MigrationLoader = async (filePaths) => {
  // map files to migration units
  return [];
};

await runner({
  databaseUrl: process.env.DATABASE_URL!,
  dir: 'migrations',
  direction: 'up',
  migrationsTable: 'pgmigrations',
  migrationLoaderStrategies: [
    { extensions: ['.sql'], loader: 'sql' },
    { extensions: ['.mjs'], loader: customLoader },
  ],
});
```

## TypeScript Path Aliases (`tsconfigPaths`)

The default loader uses [`jiti`](https://github.com/unjs/jiti) to load `.js` / `.ts` migration files.
By default, `compilerOptions.paths` aliases from your `tsconfig.json` are **not** resolved.
Set `tsconfigPaths` to enable them:

- `true` — auto-discover the nearest `tsconfig.json` (walking up from `cwd()`)
- a `string` — explicit path to a `tsconfig.json` file
- `false` / omitted (default) — disabled

```ts
import { runner } from 'node-pg-migrate';

await runner({
  databaseUrl: process.env.DATABASE_URL!,
  dir: 'migrations',
  direction: 'up',
  migrationsTable: 'pgmigrations',
  // resolve `compilerOptions.paths` aliases inside migration files
  tsconfigPaths: './tsconfig.json',
});
```

This option only affects the jiti-based loader; it has no effect on the SQL loaders.
When a custom `migrationLoaderStrategies` array maps an extension to the `'default'` predefined
loader, that loader honors `tsconfigPaths` as well.

## Strategy Matching Rules

- Extension matching is case-insensitive
- Each strategy handles one or more extensions
- If no strategy matches an extension, the `default` loader is used

## Legacy SQL migrations

### Why it exists

The legacy SQL loader has been supported for a long time, even when it was less visible in the docs.

Common use cases include:

- onboarding an existing project by importing an initial schema dump as the first migration
- keeping specific advanced migrations as pure SQL when that is cleaner than a builder-based migration

So if your team already relies on plain `.sql` files, that workflow is still supported.

### Markers and default fallback

The classic SQL template uses marker comments:

```sql
-- Up Migration

-- Down Migration
```

Behavior for a single `.sql` file:

- when both markers are present, `up` and `down` sections are extracted
- when no markers are present, the full file is treated as an `up` migration
- if there is no `down` section, there is no actionable `down` migration

### Running SQL outside a transaction

Add `-- noTransaction` or `-- no transaction` on its own line in the file's
leading header of blank lines and `--` comments. The directive is case-insensitive
and must appear before the first SQL statement. UTF-8 BOMs and CRLF line endings
are supported; an initial BOM is omitted before SQL is queued. Mentions in longer comments, SQL strings, function bodies, or
comments after SQL do not enable this behavior.

```sql
-- noTransaction
-- Up Migration
CREATE INDEX CONCURRENTLY users_email_idx ON users (email);

-- Down Migration
DROP INDEX CONCURRENTLY users_email_idx;
```

For a single `.sql` file, the directive applies to both `up` and `down` actions.
For grouped `.up.sql` / `.down.sql` files, each file has its own header; add the
directive to each direction that needs it.

The directive calls `pgm.noTransaction()` before queuing the SQL. This also breaks
the surrounding transaction when `singleTransaction` is enabled, so those
changes cannot be rolled back as part of the batch. SQL files without the directive
keep their existing transaction behavior. A dry run still executes no migration
SQL and changes no objects or migration history.

PostgreSQL requires commands such as `CREATE INDEX CONCURRENTLY` and
`DROP INDEX CONCURRENTLY` to run outside a transaction block. Keep such a command
as the only SQL statement in its direction: PostgreSQL also places multiple
statements submitted in one query in an implicit transaction.
