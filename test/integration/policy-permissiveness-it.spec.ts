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

const permissiveMigration = '1000000000000_permissive_policies';
const restrictiveMigration = '1000000000001_restrictive_policy';

describe.each(PG_VERSIONS)(
  'policy permissiveness (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let reader: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'policy_permissiveness'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
      await client.query(
        "CREATE ROLE policy_reader LOGIN PASSWORD 'policy_reader' NOSUPERUSER NOBYPASSRLS"
      );
      const readerUri = new URL(container.getConnectionUri());
      readerUri.username = 'policy_reader';
      readerUri.password = 'policy_reader';
      reader = new pg.Client(readerUri.toString());
      await reader.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      try {
        if (reader) {
          await reader.end();
        }
        if (client) {
          await client.end();
        }
      } finally {
        if (container) {
          await container.stop();
        }
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-policy-permissiveness-'));
      await client.query('CREATE SCHEMA policy_permissiveness');
      await client.query(
        'CREATE TABLE policy_permissiveness.records (id integer PRIMARY KEY)'
      );
      await client.query(
        'INSERT INTO policy_permissiveness.records VALUES (1), (2), (3)'
      );
      await client.query(
        'ALTER TABLE policy_permissiveness.records ENABLE ROW LEVEL SECURITY'
      );
      await client.query(
        'GRANT USAGE ON SCHEMA policy_permissiveness TO policy_reader'
      );
      await client.query(
        'GRANT SELECT ON policy_permissiveness.records TO policy_reader'
      );
    });

    afterEach(async () => {
      try {
        await client.query(
          'DROP SCHEMA IF EXISTS policy_permissiveness CASCADE'
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog() {
      return (
        await client.query<{ name: string; permissive: string }>(
          `SELECT policyname AS name, permissive FROM pg_policies
          WHERE schemaname = 'policy_permissiveness' AND tablename = 'records'
          ORDER BY policyname`
        )
      ).rows;
    }

    async function history() {
      return (
        await client.query<{ name: string }>(
          'SELECT name FROM policy_permissiveness.pgmigrations ORDER BY name'
        )
      ).rows;
    }

    async function visibleRows() {
      return (
        await reader.query<{ id: number }>(
          'SELECT id FROM policy_permissiveness.records ORDER BY id'
        )
      ).rows;
    }

    async function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'policy_permissiveness',
        migrationsSchema: 'policy_permissiveness',
        migrationsTable: 'pgmigrations',
        count: 1,
        singleTransaction: true,
        direction,
        log: () => {},
      });
    }

    it('combines permissive policies with OR and restrictive policies with AND, then reverses them', async () => {
      await writeFile(
        join(dir, `${permissiveMigration}.mjs`),
        `const table = { schema: 'policy_permissiveness', name: 'records' };
        export function up(pgm) {
          pgm.createPolicy(table, 'default_permissive', {
            command: 'SELECT', role: 'policy_reader', using: 'id = 1'
          });
          pgm.createPolicy(table, 'explicit_permissive', {
            as: 'PERMISSIVE', command: 'SELECT', role: 'policy_reader', using: 'id = 2'
          });
        }`
      );
      await writeFile(
        join(dir, `${restrictiveMigration}.mjs`),
        `export function up(pgm) {
          pgm.createPolicy(
            { schema: 'policy_permissiveness', name: 'records' }, 'restrictive',
            { as: 'RESTRICTIVE', command: 'SELECT', role: 'policy_reader', using: 'id > 1' }
          );
        }`
      );

      expect(await visibleRows()).toEqual([]);
      await migrate('up');
      const permissivePolicies = [
        { name: 'default_permissive', permissive: 'PERMISSIVE' },
        { name: 'explicit_permissive', permissive: 'PERMISSIVE' },
      ];
      expect(await catalog()).toEqual(permissivePolicies);
      expect(await history()).toEqual([{ name: permissiveMigration }]);
      expect(await visibleRows()).toEqual([{ id: 1 }, { id: 2 }]);

      await migrate('up');
      expect(await catalog()).toEqual([
        ...permissivePolicies,
        { name: 'restrictive', permissive: 'RESTRICTIVE' },
      ]);
      expect(await history()).toEqual([
        { name: permissiveMigration },
        { name: restrictiveMigration },
      ]);
      expect(await visibleRows()).toEqual([{ id: 2 }]);

      await migrate('down');
      expect(await catalog()).toEqual(permissivePolicies);
      expect(await history()).toEqual([{ name: permissiveMigration }]);
      expect(await visibleRows()).toEqual([{ id: 1 }, { id: 2 }]);

      await migrate('down');
      expect(await catalog()).toEqual([]);
      expect(await history()).toEqual([]);
      expect(await visibleRows()).toEqual([]);
    });
  }
);
