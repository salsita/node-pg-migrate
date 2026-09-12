import type { ClientBase } from 'pg';
import { describe, expect, it } from 'vitest';
import { BaselineError } from '../../src/baseline/errors';
import {
  assertDecamelizeKeepsNames,
  fallbackWarnings,
  resolveSettings,
} from '../../src/baseline/plan';
import type { BaselineOptions } from '../../src/baseline/types';
import type { SchemaModel } from '../../src/introspect/types';
import {
  emptyModel,
  makeColumn,
  makeComposite,
  makeFunction,
  makeTable,
  makeView,
} from '../introspect/objects';
import { thrownBy } from './helpers';

// `format: 'ts' | 'js'`: the options it takes and refuses, and what it checks
// once it has read the catalogs.

const CLIENT = { query: () => Promise.resolve() } as unknown as ClientBase;

const URL = 'postgres://app:secret@db:5432/app';

/**
 * What `resolveSettings()` throws for some options.
 */
function refusalOf(options: BaselineOptions): BaselineError {
  const error = thrownBy(() => resolveSettings(options));
  expect(error).toBeInstanceOf(BaselineError);

  return error as BaselineError;
}

/**
 * What `assertDecamelizeKeepsNames()` throws for a model.
 */
function decamelizeRefusalOf(model: SchemaModel): BaselineError {
  const error = thrownBy(() => {
    assertDecamelizeKeepsNames(model, true);
  });
  expect(error).toBeInstanceOf(BaselineError);

  return error as BaselineError;
}

describe('resolveSettings with format ts or js', () => {
  it.each(['ts', 'js'] as const)(
    'reads the catalogs of the database for %s',
    (format) => {
      expect(
        resolveSettings({ dir: 'migrations', databaseUrl: URL, format })
      ).toEqual({
        dir: 'migrations',
        name: 'baseline',
        filenameFormat: 'timestamp',
        migrationsSchema: 'public',
        migrationsTable: 'pgmigrations',
        createdSchemas: ['public'],
        logger: console,
        dump: {
          kind: 'catalogs',
          language: format,
          connection: URL,
          strict: false,
          decamelize: false,
          excludeSchemas: [],
        },
      });
    }
  );

  it('keeps the given options, and takes a dbClient', () => {
    const { dump } = resolveSettings({
      dir: 'migrations',
      dbClient: CLIENT,
      format: 'ts',
      strict: true,
      decamelize: true,
      includeSchemas: ['app'],
      excludeSchemas: ['app_audit'],
    });

    expect(dump).toStrictEqual({
      kind: 'catalogs',
      language: 'ts',
      connection: CLIENT,
      strict: true,
      decamelize: true,
      includeSchemas: ['app'],
      excludeSchemas: ['app_audit'],
    });
  });

  it('reads every schema when the included ones are an empty list', () => {
    expect(
      resolveSettings({
        dir: 'migrations',
        databaseUrl: URL,
        format: 'js',
        includeSchemas: [],
      }).dump
    ).not.toHaveProperty('includeSchemas');
  });

  it.each(['ts', 'js'] as const)(
    'refuses a dump file with format %s, naming both options',
    (format) => {
      const error = refusalOf({
        dir: 'migrations',
        databaseUrl: URL,
        fromFile: 'schema.sql',
        format,
      });

      expect(error.code).toBe('INVALID_OPTIONS');
      expect(error.message).toContain(`--format ${format}`);
      expect(error.message).toContain('--from-file');
    }
  );

  it('refuses to run without a connection', () => {
    const error = refusalOf({ dir: 'migrations', format: 'ts' });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toContain('databaseUrl');
    expect(error.message).toContain('dbClient');
  });

  it('refuses a format it does not know', () => {
    const error = refusalOf({
      dir: 'migrations',
      databaseUrl: URL,
      format: 'xml' as BaselineOptions['format'],
    });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toBe('format must be sql, ts or js, not xml.');
  });

  it('refuses strict with format sql, which has nothing to be strict about', () => {
    const error = refusalOf({
      dir: 'migrations',
      databaseUrl: URL,
      format: 'sql',
      strict: true,
    });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toContain('--strict');
    expect(error.message).toContain('--format ts');
  });

  it('accepts strict: false with format sql', () => {
    expect(
      resolveSettings({ dir: 'migrations', databaseUrl: URL, strict: false })
        .dump
    ).toMatchObject({ kind: 'pg_dump' });
  });
});

describe('assertDecamelizeKeepsNames', () => {
  const legacy = makeTable('public', 'LegacyCustomer', {
    columns: [makeColumn('id', 'integer'), makeColumn('name', 'text')],
  });

  it('accepts any identifier when decamelize is off', () => {
    expect(() => {
      assertDecamelizeKeepsNames(emptyModel({ tables: [legacy] }), false);
    }).not.toThrow();
  });

  it('accepts identifiers that decamelize keeps', () => {
    expect(() => {
      assertDecamelizeKeepsNames(
        emptyModel({ tables: [makeTable('app', 'legacy_customer')] }),
        true
      );
    }).not.toThrow();
  });

  it('names the identifiers decamelize would rename, and what to', () => {
    const error = decamelizeRefusalOf(emptyModel({ tables: [legacy] }));

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toContain('decamelize');
    expect(error.message).toContain('"LegacyCustomer" (as legacy_customer)');
    expect(error.message).toContain('--format sql');
  });

  it.each<[string, SchemaModel, string]>([
    [
      'a schema',
      emptyModel({ tables: [makeTable('Legacy', 'customers')] }),
      '"Legacy" (as legacy)',
    ],
    [
      'a column',
      emptyModel({
        tables: [
          makeTable('app', 'customers', {
            columns: [makeColumn('firstName', 'text')],
          }),
        ],
      }),
      '"firstName" (as first_name)',
    ],
    [
      'an attribute of a composite type',
      emptyModel({
        composites: [
          makeComposite('app', 'address', [{ name: 'zipCode', type: 'text' }]),
        ],
      }),
      '"zipCode" (as zip_code)',
    ],
    [
      'an argument of a function',
      emptyModel({
        functions: [
          makeFunction('app', 'total', {
            arguments: [{ mode: 'IN', name: 'customerId', type: 'bigint' }],
          }),
        ],
      }),
      '"customerId" (as customer_id)',
    ],
    [
      'a column of a view',
      emptyModel({
        views: [
          makeView('app', 'totals', ' SELECT 1 AS "orderCount"', {
            columns: [{ name: 'orderCount' }],
          }),
        ],
      }),
      '"orderCount" (as order_count)',
    ],
  ])('refuses %s that decamelize would rename', (_, model, fragment) => {
    expect(decamelizeRefusalOf(model).message).toContain(fragment);
  });

  it('names ten identifiers, in order, and counts the others', () => {
    const tables = Array.from({ length: 12 }, (_, index) =>
      makeTable('app', `Table${String(index).padStart(2, '0')}`, {
        columns: [makeColumn('id', 'integer')],
      })
    );

    const { message } = decamelizeRefusalOf(emptyModel({ tables }));

    expect(message).toContain('"Table00" (as table00)');
    expect(message).toContain('"Table09" (as table09)');
    expect(message).not.toContain('"Table10"');
    expect(message).toContain(' and 2 more.');
  });
});

describe('fallbackWarnings', () => {
  it('warns about nothing without fallbacks', () => {
    expect(fallbackWarnings(0)).toStrictEqual([]);
  });

  it('gives one warning with the count', () => {
    const warnings = fallbackWarnings(56);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/\b56\b/);
    expect(warnings[0]).toContain('pgm.sql');
    expect(warnings[0]).toContain('// fallback:');
  });
});
