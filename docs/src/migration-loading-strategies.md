# Migration Loading Strategies

`migrationLoaderStrategies` lets you control how migration files are loaded based on file extension.

This is useful when you need custom loading behavior, or when you want SQL files to use the new grouped `.up.sql` / `.down.sql` strategy.

## Default Behavior

If `migrationLoaderStrategies` is not provided, the loader uses built-in defaults:

- `.sql` files use the legacy SQL loader (`legacySql`)
- `.js` and `.ts` files use the default loader (`default`)
- unsupported extensions fall back to `default`

This keeps existing behavior intact.

## Configuration Shape

```ts
type MigrationLoader = (filePaths: string[]) => Promise<MigrationUnit[]>

interface MigrationLoaderStrategy {
  extensions: string[]
  loader: MigrationLoader | "default" | "legacySql" | "sql"
}
```

## Example: Use Grouped SQL Loader

This enables grouping `*.up.sql` and `*.down.sql` into one migration unit:

```ts
import { runner } from "node-pg-migrate"

await runner({
  databaseUrl: process.env.DATABASE_URL!,
  dir: "migrations",
  direction: "up",
  migrationsTable: "pgmigrations",
  migrationLoaderStrategies: [
    { extensions: [".sql"], loader: "sql" },
  ],
})
```

With this configuration:

- `001_init.up.sql` + `001_init.down.sql` are treated as one migration (`001_init`)
- `001_init.sql` still works as a single-file SQL migration
- mixing `001_init.sql` with `001_init.up.sql` / `001_init.down.sql` throws an error

## Example: Custom Loader

You can provide a loader function directly:

```ts
import type { MigrationLoader } from "node-pg-migrate"
import { runner } from "node-pg-migrate"

const customLoader: MigrationLoader = async (filePaths) => {
  // map files to migration units
  return []
}

await runner({
  databaseUrl: process.env.DATABASE_URL!,
  dir: "migrations",
  direction: "up",
  migrationsTable: "pgmigrations",
  migrationLoaderStrategies: [
    { extensions: [".sql"], loader: "sql" },
    { extensions: [".mjs"], loader: customLoader },
  ],
})
```
## Strategy Matching Rules

- Extension matching is case-insensitive
- Each strategy handles one or more extensions
- If no strategy matches an extension, the `default` loader is used

# Legacy SQL migrations

## Why it exists

The legacy SQL loader has been supported for a long time, even when it was less visible in the docs.

Common use cases include:

- onboarding an existing project by importing an initial schema dump as the first migration
- keeping specific advanced migrations as pure SQL when that is cleaner than a builder-based migration

So if your team already relies on plain `.sql` files, that workflow is still supported.

## Markers and default fallback

The classic SQL template uses marker comments:

```sql
-- Up Migration

-- Down Migration
```

Behavior for a single `.sql` file:

- when both markers are present, `up` and `down` sections are extracted
- when no markers are present, the full file is treated as an `up` migration
- if there is no `down` section, there is no actionable `down` migration
