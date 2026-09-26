import { describe, expect, it } from 'vitest';
import type { CatalogOptions } from '../../../src/baseline/core/plan';
import { resolveCatalogOptions } from '../../../src/baseline/core/plan';
import { BaselineError } from '../../../src/baseline/errors';
import type { CatalogPlan } from '../../../src/baseline/plan';
import { resolveSettings } from '../../../src/baseline/plan';
import type { BaselineOptions } from '../../../src/baseline/types';
import { thrownBy } from '../helpers';

// The options of `generateBaselineFromCatalogs()`: `baseline()`'s, with the
// same names, defaults and refusals, plus the migration name.

const MIGRATION_NAME = '1700000000000_baseline';

/**
 * What `resolveCatalogOptions()` throws for some options.
 *
 * @param options The options.
 * @returns The error, checked to be a `BaselineError` with code
 * `INVALID_OPTIONS`.
 */
function refusalOf(options: CatalogOptions): BaselineError {
  const error = thrownBy(() => resolveCatalogOptions(options));
  expect(error).toBeInstanceOf(BaselineError);
  expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });

  return error as BaselineError;
}

/**
 * What `baseline()` resolves from the same options, for a TypeScript or
 * JavaScript baseline: its settings and the catalog plan, without the
 * connection.
 *
 * @param options The options of `baseline()`.
 * @returns What `resolveCatalogOptions()` must return for them.
 */
function resolvedByBaseline(
  options: BaselineOptions
): ReturnType<typeof resolveCatalogOptions> {
  const { dir, migrationsSchema, migrationsTable, createdSchemas, dump } =
    resolveSettings({ ...options, databaseUrl: 'postgres://db/app' });
  const {
    kind: _kind,
    connection: _connection,
    ...catalog
  } = dump as CatalogPlan;

  return {
    settings: { dir, migrationsSchema, migrationsTable, createdSchemas },
    catalog,
  };
}

describe('resolveCatalogOptions', () => {
  it('applies the defaults of baseline(), with format ts and dir migrations', () => {
    expect(
      resolveCatalogOptions({ migrationName: MIGRATION_NAME })
    ).toStrictEqual({
      settings: {
        dir: 'migrations',
        migrationsSchema: 'public',
        migrationsTable: 'pgmigrations',
        createdSchemas: ['public'],
      },
      catalog: {
        language: 'ts',
        strict: false,
        decamelize: false,
        excludeSchemas: [],
      },
    });
  });

  it('keeps the given options', () => {
    expect(
      resolveCatalogOptions({
        migrationName: MIGRATION_NAME,
        format: 'js',
        dir: 'db/migrations',
        schema: ['app', 'public'],
        migrationsSchema: 'audit',
        migrationsTable: 'history',
        includeSchemas: ['app'],
        excludeSchemas: ['app_audit'],
        strict: true,
        decamelize: true,
      })
    ).toStrictEqual({
      settings: {
        dir: 'db/migrations',
        migrationsSchema: 'audit',
        migrationsTable: 'history',
        createdSchemas: ['app', 'public'],
      },
      catalog: {
        language: 'js',
        strict: true,
        decamelize: true,
        includeSchemas: ['app'],
        excludeSchemas: ['app_audit'],
      },
    });
  });

  it.each<BaselineOptions>([
    { dir: 'migrations', format: 'ts' },
    { dir: 'migrations', format: 'js', schema: 'app' },
    {
      dir: '/srv/app/migrations',
      format: 'ts',
      schema: ['kitchen', 'public'],
      migrationsTable: 'kitchen_migrations',
      migrationsSchema: 'kitchen_audit',
    },
    { dir: 'migrations', format: 'ts', schema: [], includeSchemas: [] },
    {
      dir: 'migrations',
      format: 'js',
      includeSchemas: ['kitchen', 'Sink Área'],
      excludeSchemas: ['kitchen_audit'],
      strict: true,
      decamelize: false,
    },
  ])('resolves %j like baseline() does', (options) => {
    expect(
      resolveCatalogOptions({ ...options, migrationName: MIGRATION_NAME })
    ).toStrictEqual(resolvedByBaseline(options));
  });

  it.each(['sql', 'xml'])('refuses the format %s', (format) => {
    const error = refusalOf({ migrationName: MIGRATION_NAME, format });

    expect(error.message).toBe(`format must be ts or js, not ${format}.`);
  });

  it.each([
    'migrationName',
    'dir',
    'migrationsTable',
    'migrationsSchema',
  ] as const)('refuses an empty %s', (key) => {
    const error = refusalOf({ migrationName: MIGRATION_NAME, [key]: '' });

    expect(error.message).toBe(`${key} must not be empty.`);
  });

  it.each([
    '1700000000000_initial schema',
    'db/1700000000000_baseline',
    String.raw`db\1700000000000_baseline`,
    '1700000000000_a\nb',
  ])('refuses the migration name %j', (migrationName) => {
    const error = refusalOf({ migrationName });

    expect(error.message).toContain(migrationName);
  });
});
