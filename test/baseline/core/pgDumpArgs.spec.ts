import { describe, expect, it } from 'vitest';
import { buildPgDumpArgs } from '../../../src/baseline/core/pgDumpArgs';
import type { PgDumpArgsOptions } from '../../../src/baseline/types';

/**
 * The options every baseline dump starts with, in this order.
 */
const FIXED = [
  '--schema-only',
  '--no-owner',
  '--no-privileges',
  '--no-publications',
  '--no-subscriptions',
  '--no-security-labels',
  '--no-tablespaces',
];

/**
 * The migrations table and its sequence, excluded from every dump.
 */
const MIGRATIONS: PgDumpArgsOptions['excludeTables'] = [
  { schema: 'public', name: 'pgmigrations' },
  { schema: 'public', name: 'pgmigrations_id_seq' },
];

const EXCLUDED_MIGRATIONS = [
  '--exclude-table="public"."pgmigrations"',
  '--exclude-table="public"."pgmigrations_id_seq"',
];

/**
 * Options pg_dump must never get from a baseline: they would add data, drop
 * or create the database, write to a file, or carry connection settings and
 * credentials (which go in the environment instead).
 */
const FORBIDDEN = new Set([
  '--clean',
  '--create',
  '--data-only',
  '--inserts',
  '--column-inserts',
  '--rows-per-insert',
  '--file',
  '--dbname',
  '--host',
  '--port',
  '--username',
  '--password',
]);

describe('buildPgDumpArgs', () => {
  it('dumps the schema only, without owners, privileges and the migrations table', () => {
    expect(
      buildPgDumpArgs({
        pgDumpMajor: 18,
        excludeTables: MIGRATIONS,
        lockWaitTimeout: '10s',
      })
    ).toEqual([...FIXED, '--lock-wait-timeout=10s', ...EXCLUDED_MIGRATIONS]);
  });

  it('passes the lock wait timeout as given', () => {
    expect(
      buildPgDumpArgs({
        pgDumpMajor: 18,
        excludeTables: MIGRATIONS,
        lockWaitTimeout: '1min',
      })
    ).toContain('--lock-wait-timeout=1min');
  });

  it('adds the included schemas, every extension, the excluded schemas and tables, in this order', () => {
    const args = buildPgDumpArgs({
      pgDumpMajor: 18,
      includeSchemas: ['app', 'Sink Área'],
      excludeSchemas: ['audit', 'App Archive'],
      excludeTables: MIGRATIONS,
      lockWaitTimeout: '10s',
    });
    const extension = args.indexOf('--extension=*');

    expect(args.slice(0, 8)).toEqual([...FIXED, '--lock-wait-timeout=10s']);
    expect(args.filter((arg) => arg !== '--extension=*').slice(8)).toEqual([
      '--schema="app"',
      '--schema="Sink Área"',
      '--exclude-schema="audit"',
      '--exclude-schema="App Archive"',
      ...EXCLUDED_MIGRATIONS,
    ]);
    expect(args.filter((arg) => arg === '--extension=*')).toHaveLength(1);
    expect(extension).toBeGreaterThan(7);
    expect(extension).toBeLessThan(args.indexOf('--exclude-schema="audit"'));
  });

  it.each([14, 15, 18])(
    'keeps the extensions with included schemas on pg_dump %i',
    (pgDumpMajor) => {
      expect(
        buildPgDumpArgs({
          pgDumpMajor,
          includeSchemas: ['app'],
          excludeTables: MIGRATIONS,
          lockWaitTimeout: '10s',
        })
      ).toContain('--extension=*');
    }
  );

  it.each([12, 13])(
    'has no --extension with included schemas on pg_dump %i, which does not know it',
    (pgDumpMajor) => {
      const args = buildPgDumpArgs({
        pgDumpMajor,
        includeSchemas: ['app'],
        excludeTables: MIGRATIONS,
        lockWaitTimeout: '10s',
      });

      expect(args).toContain('--schema="app"');
      expect(args.filter((arg) => arg.startsWith('--extension'))).toEqual([]);
    }
  );

  it('has no --extension without included schemas', () => {
    expect(
      buildPgDumpArgs({
        pgDumpMajor: 18,
        excludeSchemas: ['audit'],
        excludeTables: MIGRATIONS,
        lockWaitTimeout: '10s',
      }).filter((arg) => arg.startsWith('--extension'))
    ).toEqual([]);
  });

  it('quotes the patterns so that they match exactly one object', () => {
    const args = buildPgDumpArgs({
      pgDumpMajor: 18,
      includeSchemas: ['My "Main" Schema'],
      excludeSchemas: ['tmp*'],
      excludeTables: [
        { schema: 'Sink Área', name: 'Order; Lines' },
        { schema: 'we"ird', name: 'PgMigrations' },
      ],
      lockWaitTimeout: '10s',
    });

    expect(args).toContain('--schema="My ""Main"" Schema"');
    expect(args).toContain('--exclude-schema="tmp*"');
    expect(args).toContain('--exclude-table="Sink Área"."Order; Lines"');
    expect(args).toContain('--exclude-table="we""ird"."PgMigrations"');
  });

  it.each<PgDumpArgsOptions>([
    { pgDumpMajor: 18, excludeTables: MIGRATIONS, lockWaitTimeout: '10s' },
    {
      pgDumpMajor: 13,
      includeSchemas: ['app'],
      excludeSchemas: ['audit'],
      excludeTables: [],
      lockWaitTimeout: '0',
    },
    {
      pgDumpMajor: 17,
      includeSchemas: ['public', 'app'],
      excludeSchemas: [],
      excludeTables: MIGRATIONS,
      lockWaitTimeout: '30s',
    },
  ])(
    'never adds data, database, file or connection options (pg_dump $pgDumpMajor)',
    (options) => {
      const args = buildPgDumpArgs(options);

      expect(args.filter((arg) => !arg.startsWith('--'))).toEqual([]);
      expect(
        args.filter((arg) => FORBIDDEN.has(arg.split('=')[0] ?? ''))
      ).toEqual([]);
      expect(args.filter((arg) => arg.includes('://'))).toEqual([]);
    }
  );
});
