import type { ClientBase } from 'pg';
import { describe, expect, it } from 'vitest';
import { requiredMaxLocksPerTransaction } from '../../src/baseline/core/locks';
import { buildPgDumpArgs } from '../../src/baseline/core/pgDumpArgs';
import { BaselineError } from '../../src/baseline/errors';
import type { PgDumpPlan } from '../../src/baseline/plan';
import {
  assertCanBaseline,
  locksNeeded,
  migrationsObjects,
  pgDumpArguments,
  resolveSettings,
} from '../../src/baseline/plan';
import type {
  BaselineOptions,
  PgDumpVersion,
  ServerFacts,
} from '../../src/baseline/types';
import { messageOf, thrownBy } from './helpers';

const CLIENT = { query: () => Promise.resolve() } as unknown as ClientBase;

const URL = 'postgres://app:secret@db:5432/app';

const FACTS: ServerFacts = {
  isCockroach: false,
  version: '18.6',
  versionNum: 180_006,
  maxConnections: 100,
  maxPreparedTransactions: 0,
  migrationsTableExists: false,
  recordedMigrations: 0,
};

const PG_DUMP_18: PgDumpVersion = { major: 18, minor: 6, raw: '18.6' };

const MIGRATIONS = {
  table: { schema: 'public', name: 'pgmigrations' },
  sequence: { schema: 'public', name: 'pgmigrations_id_seq' },
};

/**
 * What `resolveSettings()` throws for some options.
 */
function refusalOf(options: BaselineOptions): BaselineError {
  const error = thrownBy(() => resolveSettings(options));
  expect(error).toBeInstanceOf(BaselineError);

  return error as BaselineError;
}

/**
 * A plan to run pg_dump.
 */
function pgDumpPlan(overrides: Partial<PgDumpPlan> = {}): PgDumpPlan {
  return {
    kind: 'pg_dump',
    connection: URL,
    bin: 'pg_dump',
    includeSchemas: [],
    excludeSchemas: [],
    lockWaitTimeout: '10s',
    ...overrides,
  };
}

describe('resolveSettings', () => {
  it('applies the defaults to a dump file', () => {
    expect(
      resolveSettings({ dir: 'migrations', fromFile: 'dumps/schema.sql' })
    ).toEqual({
      dir: 'migrations',
      name: 'baseline',
      filenameFormat: 'timestamp',
      migrationsSchema: 'public',
      migrationsTable: 'pgmigrations',
      createdSchemas: ['public'],
      logger: console,
      dump: {
        kind: 'file',
        path: 'dumps/schema.sql',
        label: 'schema.sql',
        connection: undefined,
      },
    });
  });

  it('keeps the given options', () => {
    const logger = { info: () => null, warn: () => null, error: () => null };

    expect(
      resolveSettings({
        dir: 'db',
        name: 'initial-schema',
        filenameFormat: 'utc',
        migrationsSchema: 'audit',
        migrationsTable: 'history',
        schema: ['app', 'audit'],
        fromFile: '-',
        dbClient: CLIENT,
        format: 'sql',
        logger,
      })
    ).toEqual({
      dir: 'db',
      name: 'initial-schema',
      filenameFormat: 'utc',
      migrationsSchema: 'audit',
      migrationsTable: 'history',
      createdSchemas: ['app', 'audit'],
      logger,
      dump: { kind: 'file', path: '-', label: 'stdin', connection: CLIENT },
    });
  });

  it.each([
    { schema: 'app', migrationsSchema: 'app', createdSchemas: ['app'] },
    {
      schema: ['app', 'other'],
      migrationsSchema: 'app',
      createdSchemas: ['app', 'other'],
    },
    { schema: [], migrationsSchema: 'public', createdSchemas: ['public'] },
  ])(
    'looks for the migrations table in the first of the schemas $schema',
    ({ schema, migrationsSchema, createdSchemas }) => {
      expect(
        resolveSettings({ dir: 'migrations', fromFile: 'dump.sql', schema })
      ).toMatchObject({ migrationsSchema, createdSchemas });
    }
  );

  it('checks the history of the database of a dump file', () => {
    expect(
      resolveSettings({
        dir: 'migrations',
        fromFile: 'dump.sql',
        databaseUrl: URL,
      }).dump
    ).toMatchObject({ kind: 'file', connection: URL });
  });

  it('runs pg_dump without a dump file', () => {
    expect(
      resolveSettings({ dir: 'migrations', databaseUrl: URL }).dump
    ).toEqual(pgDumpPlan());
    expect(
      resolveSettings({
        dir: 'migrations',
        databaseUrl: { host: 'db', database: 'app' },
        pgDump: '/usr/lib/postgresql/18/bin/pg_dump',
        includeSchemas: ['app'],
        excludeSchemas: ['app_audit'],
        lockWaitTimeout: '1min',
      }).dump
    ).toEqual(
      pgDumpPlan({
        connection: { host: 'db', database: 'app' },
        bin: '/usr/lib/postgresql/18/bin/pg_dump',
        includeSchemas: ['app'],
        excludeSchemas: ['app_audit'],
        lockWaitTimeout: '1min',
      })
    );
  });

  it('accepts empty schema lists with a dump file', () => {
    expect(
      resolveSettings({
        dir: 'migrations',
        fromFile: 'dump.sql',
        includeSchemas: [],
        excludeSchemas: [],
      }).dump
    ).toMatchObject({ kind: 'file' });
  });

  it.each(['ts', 'js'] as const)('refuses the %s format', (format) => {
    const error = refusalOf({
      dir: 'migrations',
      fromFile: 'dump.sql',
      format,
    });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toContain(format);
  });

  it.each([
    'dir',
    'name',
    'migrationsTable',
    'migrationsSchema',
    'fromFile',
    'pgDump',
    'lockWaitTimeout',
  ] as const)('refuses an empty %s', (key) => {
    const error = refusalOf({
      dir: 'migrations',
      databaseUrl: URL,
      [key]: '',
    });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toBe(`${key} must not be empty.`);
  });

  it.each(['initial schema', 'db/baseline', String.raw`db\baseline`, 'a\nb'])(
    'refuses the migration name %j',
    (name) => {
      const error = refusalOf({
        dir: 'migrations',
        fromFile: 'dump.sql',
        name,
      });

      expect(error.code).toBe('INVALID_OPTIONS');
      expect(error.message).toContain(name);
    }
  );

  it('refuses both databaseUrl and dbClient', () => {
    const error = refusalOf({
      dir: 'migrations',
      fromFile: 'dump.sql',
      databaseUrl: URL,
      dbClient: CLIENT,
    });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toContain('databaseUrl');
    expect(error.message).toContain('dbClient');
  });

  it('refuses to run without a dump file or a connection', () => {
    const error = refusalOf({ dir: 'migrations' });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toContain('fromFile');
  });

  it('refuses to run pg_dump with only a dbClient', () => {
    const error = refusalOf({ dir: 'migrations', dbClient: CLIENT });

    expect(error.code).toBe('INVALID_OPTIONS');
    expect(error.message).toContain('pg_dump needs databaseUrl');
  });

  it.each([{ includeSchemas: ['app'] }, { excludeSchemas: ['app_audit'] }])(
    'refuses schemas to dump with a dump file (%j)',
    (schemas) => {
      const error = refusalOf({
        dir: 'migrations',
        fromFile: 'dump.sql',
        ...schemas,
      });

      expect(error.code).toBe('INVALID_OPTIONS');
      expect(error.message).toContain('--from-file');
    }
  );
});

describe('assertCanBaseline', () => {
  const settings = {
    migrationsSchema: 'Audit.Trail',
    migrationsTable: 'Schema "Migrations"',
  };

  it('accepts a PostgreSQL server without a history', () => {
    expect(() => {
      assertCanBaseline(
        { ...FACTS, migrationsTableExists: true, recordedMigrations: 0 },
        settings
      );
    }).not.toThrow();
  });

  it('refuses CockroachDB', () => {
    const error = thrownBy(() => {
      assertCanBaseline(
        { ...FACTS, isCockroach: true, version: 'CockroachDB CCL v25.3.5' },
        settings
      );
    });

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'UNSUPPORTED_SERVER' });
    expect(messageOf(error)).toContain('CockroachDB CCL v25.3.5');
  });

  it('refuses a recorded history, naming the quoted table', () => {
    const error = thrownBy(() => {
      assertCanBaseline(
        { ...FACTS, migrationsTableExists: true, recordedMigrations: 2 },
        settings
      );
    });

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'HISTORY_EXISTS' });
    expect(messageOf(error)).toContain(
      '"Audit.Trail"."Schema ""Migrations""" already records 2 migration(s)'
    );
  });
});

describe('migrationsObjects', () => {
  const settings = { migrationsSchema: 'app', migrationsTable: 'history' };
  const defaults = {
    table: { schema: 'app', name: 'history' },
    sequence: { schema: 'app', name: 'history_id_seq' },
  };

  it('names the sequence the runner creates when the server does not say', () => {
    expect(migrationsObjects(settings, undefined)).toEqual(defaults);
    expect(migrationsObjects(settings, FACTS)).toEqual(defaults);
  });

  it('names the sequence the table really uses', () => {
    expect(
      migrationsObjects(settings, {
        ...FACTS,
        migrationsTableExists: true,
        migrationsSequence: { schema: 'app', name: 'old_history_id_seq' },
      })
    ).toEqual({
      ...defaults,
      sequence: { schema: 'app', name: 'old_history_id_seq' },
    });
  });
});

describe('pgDumpArguments', () => {
  const extensions = [
    { name: 'btree_gist', schema: 'public' },
    { name: 'pg_trgm', schema: 'kitchen' },
    { name: 'plpython3u', schema: 'pg_catalog' },
    { name: 'postgis', schema: 'gis' },
    { name: 'hstore', schema: 'Sink Área' },
  ];

  it('excludes the migrations table and its sequence', () => {
    const plan = pgDumpPlan({ excludeSchemas: ['app_audit'] });

    expect(
      pgDumpArguments({
        pgDump: PG_DUMP_18,
        plan,
        migrations: MIGRATIONS,
        extensions,
      })
    ).toEqual({
      args: buildPgDumpArgs({
        pgDumpMajor: 18,
        includeSchemas: [],
        excludeSchemas: ['app_audit'],
        excludeTables: [MIGRATIONS.table, MIGRATIONS.sequence],
        lockWaitTimeout: '10s',
      }),
      warnings: [],
    });
  });

  it('dumps the extensions a blank database can create with included schemas, and names the others', () => {
    const plan = pgDumpPlan({ includeSchemas: ['kitchen', 'kitchen_audit'] });
    const all = buildPgDumpArgs({
      pgDumpMajor: 18,
      includeSchemas: plan.includeSchemas,
      excludeSchemas: [],
      excludeTables: [MIGRATIONS.table, MIGRATIONS.sequence],
      lockWaitTimeout: '10s',
    });
    const { args, warnings } = pgDumpArguments({
      pgDump: PG_DUMP_18,
      plan,
      migrations: MIGRATIONS,
      extensions,
    });

    expect(all).toContain('--extension=*');
    expect(args).toEqual(
      all.flatMap((arg) =>
        arg === '--extension=*'
          ? [
              '--extension="btree_gist"',
              '--extension="pg_trgm"',
              '--extension="plpython3u"',
            ]
          : [arg]
      )
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('postgis (in schema gis)');
    expect(warnings[0]).toContain('hstore (in schema Sink Área)');
    expect(warnings[0]).toContain('--include-schema');
  });

  it('leaves out the extensions of a schema that is both included and excluded', () => {
    const { args, warnings } = pgDumpArguments({
      pgDump: PG_DUMP_18,
      plan: pgDumpPlan({
        includeSchemas: ['kitchen', 'gis'],
        excludeSchemas: ['gis', 'public'],
      }),
      migrations: MIGRATIONS,
      extensions,
    });

    expect(args.filter((arg) => arg.startsWith('--extension'))).toEqual([
      '--extension="btree_gist"',
      '--extension="pg_trgm"',
      '--extension="plpython3u"',
    ]);
    expect(warnings).toEqual([
      expect.stringContaining(
        'postgis (in schema gis), hstore (in schema Sink Área)'
      ),
    ]);
  });

  it('names the extensions whose schema is excluded, which pg_dump still creates', () => {
    const plan = pgDumpPlan({ excludeSchemas: ['gis', 'public'] });
    const { args, warnings } = pgDumpArguments({
      pgDump: PG_DUMP_18,
      plan,
      migrations: MIGRATIONS,
      extensions,
    });

    expect(args).toEqual(
      buildPgDumpArgs({
        pgDumpMajor: 18,
        includeSchemas: [],
        excludeSchemas: ['gis', 'public'],
        excludeTables: [MIGRATIONS.table, MIGRATIONS.sequence],
        lockWaitTimeout: '10s',
      })
    );
    // public is on every database, so btree_gist is fine.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('postgis (in schema gis)');
    expect(warnings[0]).not.toContain('btree_gist');
    expect(warnings[0]).toContain('--exclude-schema');
  });

  it('dumps no extension with included schemas when the database has none', () => {
    const { args, warnings } = pgDumpArguments({
      pgDump: PG_DUMP_18,
      plan: pgDumpPlan({ includeSchemas: ['app'] }),
      migrations: MIGRATIONS,
      extensions: [],
    });

    expect(args.filter((arg) => arg.startsWith('--extension'))).toEqual([]);
    expect(args).toContain('--schema="app"');
    expect(warnings).toEqual([]);
  });

  it('says that a pg_dump older than 14 leaves the extensions out of included schemas', () => {
    const pgDump = { major: 13, minor: 16, raw: '13.16' };
    const plan = pgDumpPlan({ includeSchemas: ['kitchen'] });
    const { args, warnings } = pgDumpArguments({
      pgDump,
      plan,
      migrations: MIGRATIONS,
      extensions,
    });

    expect(args).toEqual(
      buildPgDumpArgs({
        pgDumpMajor: 13,
        includeSchemas: ['kitchen'],
        excludeSchemas: [],
        excludeTables: [MIGRATIONS.table, MIGRATIONS.sequence],
        lockWaitTimeout: '10s',
      })
    );
    expect(args.filter((arg) => arg.startsWith('--extension'))).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('pg_dump 13.16');
    expect(warnings[0]).toContain('--include-schema');
  });
});

describe('locksNeeded', () => {
  it('needs nothing when the default is enough', () => {
    expect(locksNeeded(100, undefined)).toEqual({ warnings: [] });
  });

  it('says how many locks a large baseline needs', () => {
    const { requiredMaxLocksPerTransaction: required, warnings } = locksNeeded(
      8100,
      undefined
    );

    expect(required).toBe(requiredMaxLocksPerTransaction(8100));
    expect(required).toBe(128);
    expect(warnings).toEqual([
      expect.stringContaining('max_locks_per_transaction = 128'),
    ]);
    expect(warnings[0]).toContain('8100 relations');
  });

  it("sizes the lock table with the server's settings", () => {
    const facts = { ...FACTS, maxConnections: 20, maxPreparedTransactions: 5 };
    const { requiredMaxLocksPerTransaction: required } = locksNeeded(
      8100,
      facts
    );

    expect(required).toBe(requiredMaxLocksPerTransaction(8100, 20, 5));
    expect(required).toBeGreaterThan(128);
  });
});
