import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'function planner options (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'function_planner'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }
      if (container) {
        await container.stop();
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-function-planner-'));
      await client.query('CREATE SCHEMA function_planner');
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS function_planner CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'function_planner',
        migrationsSchema: 'function_planner',
        migrationsTable: 'pgmigrations',
        direction,
        count: 1,
        log: () => {},
      });
    }

    it('stores fractional estimates and the matching support function, then rolls back', async () => {
      await writeFile(
        join(dir, '1000000000000_series.mjs'),
        `
        export function up(pgm) {
          pgm.createFunction(
            { schema: 'function_planner', name: 'series' },
            ['integer', 'integer'],
            { language: 'internal', returns: 'SETOF integer', cost: 2.5, rows: 4.5,
              support: { schema: 'pg_catalog', name: 'generate_series_int4_support' } },
            'generate_series_int4'
          );
        }
      `
      );

      await migrate('up');
      expect(
        (
          await client.query(`
        SELECT procost AS cost, prorows AS rows,
          prosupport = 'pg_catalog.generate_series_int4_support'::regproc::oid AS support
        FROM pg_proc WHERE oid = 'function_planner.series(integer,integer)'::regprocedure
      `)
        ).rows
      ).toEqual([{ cost: 2.5, rows: 4.5, support: true }]);
      expect(
        (await client.query('SELECT function_planner.series(1, 3) AS value'))
          .rows
      ).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
      expect(
        (await client.query('SELECT name FROM function_planner.pgmigrations'))
          .rows
      ).toEqual([{ name: '1000000000000_series' }]);

      await migrate('down');
      expect(
        (
          await client.query(
            "SELECT to_regprocedure('function_planner.series(integer,integer)') AS value"
          )
        ).rows
      ).toEqual([{ value: null }]);
      expect(
        (await client.query('SELECT name FROM function_planner.pgmigrations'))
          .rows
      ).toEqual([]);
    });

    it('explicitly replaces a strict function with one called on null input', async () => {
      await writeFile(
        join(dir, '1000000000000_strict.mjs'),
        `
        export function up(pgm) {
          pgm.createFunction({ schema: 'function_planner', name: 'nullable' }, ['integer'],
            { language: 'sql', returns: 'integer', onNull: 'RETURNS NULL' }, 'SELECT COALESCE($1, 7)');
        }
      `
      );
      await migrate('up');
      const before = (
        await client.query(`
        SELECT oid::text, proisstrict FROM pg_proc
        WHERE oid = 'function_planner.nullable(integer)'::regprocedure
      `)
      ).rows[0];
      expect(before).toEqual({ oid: expect.any(String), proisstrict: true });
      expect(
        (await client.query('SELECT function_planner.nullable(NULL) AS value'))
          .rows
      ).toEqual([{ value: null }]);

      await writeFile(
        join(dir, '1000000000001_called.mjs'),
        `
        const name = { schema: 'function_planner', name: 'nullable' };
        export function up(pgm) {
          pgm.createFunction(name, ['integer'],
            { language: 'sql', returns: 'integer', replace: true, onNull: 'CALLED' }, 'SELECT COALESCE($1, 7)');
        }
        export function down(pgm) {
          pgm.createFunction(name, ['integer'],
            { language: 'sql', returns: 'integer', replace: true, onNull: true }, 'SELECT COALESCE($1, 7)');
        }
      `
      );
      await migrate('up');
      expect(
        (
          await client.query(`
        SELECT oid::text, proisstrict FROM pg_proc
        WHERE oid = 'function_planner.nullable(integer)'::regprocedure
      `)
        ).rows
      ).toEqual([{ oid: before.oid, proisstrict: false }]);
      expect(
        (await client.query('SELECT function_planner.nullable(NULL) AS value'))
          .rows
      ).toEqual([{ value: 7 }]);

      await migrate('down');
      expect(
        (
          await client.query(`
        SELECT oid::text, proisstrict FROM pg_proc
        WHERE oid = 'function_planner.nullable(integer)'::regprocedure
      `)
        ).rows
      ).toEqual([before]);
      expect(
        (await client.query('SELECT function_planner.nullable(NULL) AS value'))
          .rows
      ).toEqual([{ value: null }]);
    });
  }
);
