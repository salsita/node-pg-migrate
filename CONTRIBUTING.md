# Contributing to node-pg-migrate

Thanks for your interest in improving `node-pg-migrate`!
All contributions are welcome, whether it's a bug report, a feature idea, a docs fix, or code.
Please read this guide before you open a pull request.

## Before you start

It's generally helpful to [create an issue](https://github.com/salsita/node-pg-migrate/issues/new/choose) first:

- If you are proposing a new feature, this allows other users to upvote the issue and discuss the design before any code is written.
- If you found a bug, this allows you to describe the steps to reproduce it, and allows others to confirm it.
  Please include your `node-pg-migrate`, Node.js and PostgreSQL (or CockroachDB) versions, and the migration that triggers the problem.
- It's not required in all cases.
  For example, you can open a pull request for a typo in the docs right away.

Looking for something to work on?
Check the [good first issue](https://github.com/salsita/node-pg-migrate/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) and [help wanted](https://github.com/salsita/node-pg-migrate/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) labels.

## Set up a development environment

Requirements:

- [Node.js](https://nodejs.org) `>=22.12.0`
- [pnpm](https://pnpm.io) (the exact version is pinned via `packageManager` in [package.json](package.json); [Corepack](https://nodejs.org/api/corepack.html) or pnpm itself will pick it up)
- [Docker](https://www.docker.com) (only needed for the integration tests)

Fork the repository, clone your fork, and install the dependencies:

```shell
git clone https://github.com/<your-username>/node-pg-migrate.git
cd node-pg-migrate
pnpm install
pnpm run build
```

Please use `pnpm`, not `npm` or `yarn`, so the lockfile stays consistent.

## Important

Please make sure that you run `pnpm run preflight` before opening a PR to ensure that everything works.
This is a shorthand for running the following scripts in order:

- `pnpm install` - installs the dependencies defined in [package.json](package.json)
- `pnpm run format` - runs [oxfmt](https://oxc.rs/docs/guide/usage/formatter) to format the code
- `pnpm run build` - builds the library and the CLI
- `pnpm run lint` - runs [oxlint](https://oxc.rs/docs/guide/usage/linter) to enforce the project code standards
- `pnpm run test:update-snapshots` - runs all tests, and updates any snapshots if needed
- `pnpm run ts-check` - checks that there are no TypeScript errors in any files

Please review any changed snapshots before committing them.

## Good to know

- The project is ESM-only and written in TypeScript.
- The project is built by [tsdown](https://tsdown.dev) (see [tsdown.config.ts](tsdown.config.ts)).
  It produces two outputs: the library at `dist/index.js` (+ `dist/index.d.ts`) and the CLI at `bin/node-pg-migrate.js`.
  The CLI imports the library through the package's own name (`node-pg-migrate`), so **build the project before running the CLI or the tests that use it**.
- The tests run with [Vitest](https://vitest.dev) (see [vitest.config.ts](vitest.config.ts)).
- The documentation runs on [VitePress](https://vitepress.dev) and lives in [docs/src](docs/src).

## Architecture

The sources are located in the [src](src) directory:

- [src/cli](src/cli) - the [commander](https://github.com/tj/commander.js)-based CLI, built to `bin/node-pg-migrate.js`
- [src/runner.ts](src/runner.ts) - the `runner()` orchestrator: connects to the database, takes the advisory lock, loads and runs the migrations
- [src/migration.ts](src/migration.ts) - migration file discovery, sorting, and the `Migration` class
- [src/migrationLoader.ts](src/migrationLoader.ts) - strategy-based loading of migration files (JS/TS via [jiti](https://github.com/unjs/jiti), SQL)
- [src/migrationBuilder.ts](src/migrationBuilder.ts) - the `pgm` object passed to migrations; it collects the SQL statements and supports reverse mode
- [src/operations](src/operations) - one directory per category (tables, indexes, types, ...) with one file per operation
- [src/utils](src/utils) - escaping, quoting, formatting, and other helpers

### Operations

Each operation is a factory that receives the `MigrationOptions` and returns a function that generates the SQL string:

```ts
export function dropTable(mOptions: MigrationOptions): DropTable {
  const _drop: DropTable = (tableName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const tableNameStr = mOptions.literal(tableName);

    return `DROP TABLE${ifExistsStr} ${tableNameStr}${cascadeStr};`;
  };

  return _drop;
}
```

New operations need to be exported from their category's `index.ts` and wired into [src/migrationBuilder.ts](src/migrationBuilder.ts).

Operations that can be undone automatically define a `reverse` function, so `down` migrations can be inferred.
`reverse` is called with **the same arguments as the original operation**.
If the drop function's options are not at the same position as the create function's, use a wrapper instead of assigning the drop function directly:

```ts
_create.reverse = (tableName, columns, options) =>
  dropTable(mOptions)(tableName, options);
```

Always use `mOptions.literal()` / `mOptions.schemalize()` and the helpers from [src/utils](src/utils) to quote identifiers and escape values.
Never interpolate user input into SQL directly.

## Testing

```shell
pnpm run build

pnpm run test:unit
pnpm run test:integration
# or
pnpm run test:coverage
```

You can view a generated code coverage report at `coverage/index.html`.
The unit tests must keep the coverage thresholds defined in [vitest.config.ts](vitest.config.ts).

### Unit tests

The unit tests live in [test](test) and mirror the structure of [src](src), e.g. [src/operations/indexes](src/operations/indexes) is tested in [test/operations/indexes](test/operations/indexes).
They check the generated SQL without a database:

```ts
import { describe, expect, it } from 'vitest';
import { createIndex } from '../../../src/operations/indexes';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('indexes', () => {
    describe('createIndex', () => {
      const createIndexFn = createIndex(options1);

      it('should return sql statement', () => {
        const statement = createIndexFn('films', ['title'], {
          name: 'title_idx',
        });

        expect(statement).toBe(
          'CREATE INDEX "title_idx" ON "films" ("title");'
        );
      });
    });
  });
});
```

Please add a test for each new option, and for reversible operations, a test that calls `reverse` with those options as well.

### Integration tests

The integration tests live in [test/integration](test/integration) and run against a real PostgreSQL database started via [Testcontainers](https://testcontainers.com), so Docker has to be running.
By default they use PostgreSQL 18; set `PGM_VERSIONS` to test other versions:

```shell
PGM_VERSIONS=14,18 pnpm run test:integration
```

If your change generates new SQL, please verify that PostgreSQL actually accepts it, either with an integration test or by adding a migration to [test/migrations](test/migrations).

### Other CI checks

CI additionally runs `migrate up` and `migrate down 0` over [test/migrations](test/migrations) against PostgreSQL with various configurations, and over [test/cockroach](test/cockroach) against several CockroachDB versions.
If your change affects CockroachDB, please keep that in mind (CockroachDB does not support every PostgreSQL feature).

You can run the migrations locally against your own database:

```shell
DATABASE_URL=postgres://user:password@localhost:5432/database pnpm run migrate up -m test/migrations
DATABASE_URL=postgres://user:password@localhost:5432/database pnpm run migrate down 0 -m test/migrations
```

## Documentation

If you add or change a feature, please update the related page in [docs/src](docs/src), e.g. [docs/src/migrations](docs/src/migrations) for operations, [docs/src/cli.md](docs/src/cli.md) for the CLI, or [docs/src/api.md](docs/src/api.md) for the programmatic API.

The docs use [Twoslash](https://twoslash.netlify.app) and depend on the built `dist`, so build the project first:

```shell
pnpm run build

pnpm run docs:dev
```

If you changed something heavily in the docs, check the static build as well, because it could differ from the dev version:

```shell
pnpm run docs:build
pnpm run docs:preview
```

The docs also have browser smoke tests, see [test/docs/README.md](test/docs/README.md).

### Documenting changes for new major versions

Each major version has an [upgrading guide](docs/src/upgrading.md).
Anything that requires a user to change their code, configuration, or database when upgrading to the new major version must be documented there, e.g.:

- Removed or renamed options, methods, or CLI flags
- Changed default values or behavior
- Changes to the generated SQL that affect existing migrations or the migrations table
- New minimum versions of Node.js, PostgreSQL, or `pg`

New features and bug fixes where nobody could have relied on the old behavior don't need to be in the guide.

## Committing

The pull request title must follow the [Conventional Commits](https://www.conventionalcommits.org) format, because PRs are squash merged and the title becomes the commit message.
This is checked by CI.

```text
<type>(<optional scope>): <description>
```

Allowed types are `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`, `build`, `infra`, `revert`, and `release`.
The scope is usually the affected area, e.g. `indexes`, `grants`, `runner`, or `cli`.
Breaking changes are marked with a `!` after the type/scope.

Examples:

```text
feat(indexes): support the BRIN index method
fix(runner): reject empty migration schemas
fix(grants)!: preserve named table selections with schema
docs(migrations): clarify async execution
```

Please keep pull requests focused on a single change, and link the related issue in the description (e.g. `fixes #123`).
