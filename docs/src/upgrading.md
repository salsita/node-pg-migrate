# Upgrading

This page documents the changes you need to be aware of when upgrading between
major versions of `node-pg-migrate`.

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
