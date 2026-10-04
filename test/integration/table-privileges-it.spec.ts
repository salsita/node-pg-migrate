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

const migrationName = '1000000000000_table_privileges';
const namedTables = [
  {
    name: 'unqualified table',
    tables: "'selected'",
    schema: 'table_privileges',
  },
  {
    name: 'qualified table with a different top-level schema',
    tables: "{ schema: 'table_privileges', name: 'selected' }",
    schema: 'other_tables',
  },
];

describe.each(PG_VERSIONS)(
  'table privileges (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'table_privileges'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
      await client.query('CREATE ROLE table_reader NOSUPERUSER');
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      try {
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-table-privileges-'));
      await client.query(`
        CREATE SCHEMA table_privileges;
        CREATE SCHEMA other_tables;
        CREATE TABLE table_privileges.selected (id integer);
        CREATE TABLE table_privileges.unselected (id integer);
        CREATE TABLE other_tables.unselected (id integer);
        GRANT USAGE ON SCHEMA table_privileges, other_tables TO table_reader
      `);
    });

    afterEach(async () => {
      try {
        if (client) {
          await client.query(`
            DROP SCHEMA IF EXISTS table_privileges CASCADE;
            DROP SCHEMA IF EXISTS other_tables CASCADE
          `);
        }
      } finally {
        if (dir) {
          await rm(dir, { recursive: true, force: true });
        }
      }
    });

    async function privileges() {
      return (
        await client.query<{
          selected: boolean;
          unselected: boolean;
          other: boolean;
        }>(
          `SELECT
            has_table_privilege('table_reader', 'table_privileges.selected', 'SELECT') AS selected,
            has_table_privilege('table_reader', 'table_privileges.unselected', 'SELECT') AS unselected,
            has_table_privilege('table_reader', 'other_tables.unselected', 'SELECT') AS other`
        )
      ).rows[0];
    }

    async function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'table_privileges',
        migrationsSchema: 'table_privileges',
        migrationsTable: 'pgmigrations',
        count: 1,
        singleTransaction: true,
        direction,
        log: () => {},
      });
    }

    it.each(namedTables)(
      'grants only the $name and preserves independent grants on automatic down',
      async ({ tables, schema }) => {
        await writeFile(
          join(dir, `${migrationName}.mjs`),
          `export function up(pgm) {
            pgm.grantOnTables({
              tables: ${tables}, schema: '${schema}',
              privileges: 'SELECT', roles: 'table_reader'
            });
          }`
        );

        await migrate('up');
        expect(await privileges()).toEqual({
          selected: true,
          unselected: false,
          other: false,
        });

        await client.query(`
          GRANT SELECT ON table_privileges.unselected, other_tables.unselected
            TO table_reader
        `);
        await migrate('down');
        expect(await privileges()).toEqual({
          selected: false,
          unselected: true,
          other: true,
        });
      }
    );

    it.each(namedTables)(
      'revokes only the $name and preserves independent grants',
      async ({ tables, schema }) => {
        await client.query(`
          GRANT SELECT ON table_privileges.selected, table_privileges.unselected,
            other_tables.unselected TO table_reader
        `);
        await writeFile(
          join(dir, `${migrationName}.mjs`),
          `export function up(pgm) {
            pgm.revokeOnTables({
              tables: ${tables}, schema: '${schema}',
              privileges: 'SELECT', roles: 'table_reader'
            });
          }`
        );

        await migrate('up');
        expect(await privileges()).toEqual({
          selected: false,
          unselected: true,
          other: true,
        });
      }
    );

    it('grants and automatically revokes ALL tables only in the selected schema', async () => {
      await client.query(
        'GRANT SELECT ON other_tables.unselected TO table_reader'
      );
      await writeFile(
        join(dir, `${migrationName}.mjs`),
        `export function up(pgm) {
          pgm.grantOnTables({
            tables: 'ALL', schema: 'table_privileges',
            privileges: 'SELECT', roles: 'table_reader'
          });
        }`
      );

      await migrate('up');
      expect(await privileges()).toEqual({
        selected: true,
        unselected: true,
        other: true,
      });

      await migrate('down');
      expect(await privileges()).toEqual({
        selected: false,
        unselected: false,
        other: true,
      });
    });
  }
);
