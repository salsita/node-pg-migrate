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

const migrationName = '1000000000000_defaulted_function';
const cases = [
  { title: 'string shorthand', params: '["defaultInt"]' },
  {
    title: 'object shorthand',
    params: '[{ name: "inputValue", type: "defaultInt" }]',
  },
  {
    title: 'chained shorthand',
    params: '[{ name: "inputValue", type: "nested" }]',
  },
];

describe.each(PG_VERSIONS)(
  'dropping functions with shorthand defaults (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'function_defaults'
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-function-defaults-'));
      await client.query('CREATE SCHEMA function_defaults');
      await client.query(`CREATE FUNCTION function_defaults.defaulted_function(text)
        RETURNS integer LANGUAGE sql AS 'SELECT 99'`);
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS function_defaults CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog() {
      return (
        await client.query<{ oid: string; identity: string; defaults: number }>(
          `SELECT p.oid::text, pg_catalog.oidvectortypes(p.proargtypes) AS identity,
            p.pronargdefaults AS defaults
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'function_defaults' AND p.proname = 'defaulted_function'
          ORDER BY p.oid`
        )
      ).rows;
    }

    describe.each(['automatic', 'explicit'] as const)('%s down', (down) => {
      it.each(cases)(
        'rolls back a $title and its history',
        async ({ params }) => {
          await writeFile(
            join(dir, `${migrationName}.mjs`),
            `export const shorthands = {
            defaultInt: { type: 'integer', default: 2 },
            nested: 'defaultInt',
          };
          const name = { schema: 'function_defaults', name: 'defaulted_function' };
          const params = ${params};
          export function up(pgm) {
            pgm.createFunction(name, params,
              { language: 'sql', returns: 'integer' }, 'SELECT $1');
          }
          ${
            down === 'explicit'
              ? `export function down(pgm) {
            pgm.dropFunction(name, params, { ifExists: true, cascade: true });
          }`
              : ''
          }`
          );

          const options = {
            databaseUrl: container.getConnectionUri(),
            dir,
            schema: 'function_defaults',
            migrationsSchema: 'function_defaults',
            migrationsTable: 'pgmigrations',
            count: 1,
            log: () => {},
          };
          const overload = await catalog();
          expect(overload).toEqual([
            { oid: expect.any(String), identity: 'text', defaults: 0 },
          ]);

          await runner({ ...options, direction: 'up' });
          expect(await catalog()).toEqual([
            ...overload,
            { oid: expect.any(String), identity: 'integer', defaults: 1 },
          ]);
          expect(
            (
              await client.query(
                'SELECT function_defaults.defaulted_function() AS value'
              )
            ).rows
          ).toEqual([{ value: 2 }]);
          expect(
            (
              await client.query(
                'SELECT name FROM function_defaults.pgmigrations'
              )
            ).rows
          ).toEqual([{ name: migrationName }]);

          await runner({ ...options, direction: 'down' });
          expect(await catalog()).toEqual(overload);
          expect(
            (
              await client.query(
                'SELECT name FROM function_defaults.pgmigrations'
              )
            ).rows
          ).toEqual([]);
          expect(
            (
              await client.query(
                "SELECT function_defaults.defaulted_function('unchanged'::text) AS value"
              )
            ).rows
          ).toEqual([{ value: 99 }]);
        }
      );
    });
  }
);
