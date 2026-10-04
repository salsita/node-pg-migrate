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

const migrationName = '1000000000000_column_trigger';

describe.each(PG_VERSIONS)(
  'column-specific triggers (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'trigger_columns'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-trigger-columns-'));
      await client.query('CREATE SCHEMA trigger_columns');
      await client.query(`CREATE TABLE trigger_columns.accounts (
        "CamelCaseColumn" text, camel_case_column text, other text,
        "order" text, "a""b" text, "a,b" text
      )`);
      await client.query(`CREATE TABLE trigger_columns.events (
        id integer GENERATED ALWAYS AS IDENTITY, event text
      )`);
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS trigger_columns CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog() {
      return (
        await client.query<{ definition: string }>(
          `SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger
          WHERE tgrelid = 'trigger_columns.accounts'::regclass AND NOT tgisinternal`
        )
      ).rows;
    }

    async function events() {
      return (
        await client.query<{ event: string }>(
          'SELECT event FROM trigger_columns.events ORDER BY id'
        )
      ).rows.map(({ event }) => event);
    }

    it.each([
      { decamelize: false, column: '"CamelCaseColumn"' },
      { decamelize: true, column: 'camel_case_column' },
    ])(
      'should restrict updates and reverse with decamelize=$decamelize',
      async ({ decamelize, column }) => {
        await writeFile(
          join(dir, `${migrationName}.mjs`),
          `export function up(pgm) {
          pgm.createTrigger(
            { schema: 'trigger_columns', name: 'accounts' },
            'account_changed',
            {
              when: 'AFTER',
              operation: ['INSERT', 'UPDATE', 'DELETE'],
              updateOf: ['CamelCaseColumn', 'order', 'a"b', 'a,b'],
              level: 'ROW',
              language: 'plpgsql',
              function: { schema: 'trigger_columns', name: 'record_event' },
            },
            \`BEGIN
              INSERT INTO trigger_columns.events (event) VALUES (TG_OP);
              RETURN NULL;
            END;\`
          );
        }`
        );

        const options = {
          databaseUrl: container.getConnectionUri(),
          dir,
          schema: 'trigger_columns',
          migrationsSchema: 'trigger_columns',
          migrationsTable: 'pgmigrations',
          count: 1,
          decamelize,
          log: () => {},
        };

        await runner({ ...options, direction: 'up' });
        expect(await catalog()).toEqual([
          {
            definition: expect.stringContaining(
              `UPDATE OF ${column}, "order", "a""b", "a,b"`
            ),
          },
        ]);
        expect(
          (await client.query('SELECT name FROM trigger_columns.pgmigrations'))
            .rows
        ).toEqual([{ name: migrationName }]);

        await client.query(
          "INSERT INTO trigger_columns.accounts (other) VALUES ('original')"
        );
        expect(await events()).toEqual(['INSERT']);
        await client.query(
          "UPDATE trigger_columns.accounts SET other = 'changed'"
        );
        expect(await events()).toEqual(['INSERT']);
        await client.query(
          `UPDATE trigger_columns.accounts SET ${column} = 'changed'`
        );
        expect(await events()).toEqual(['INSERT', 'UPDATE']);
        await client.query(
          `UPDATE trigger_columns.accounts SET ${column} = ${column}`
        );
        expect(await events()).toEqual(['INSERT', 'UPDATE', 'UPDATE']);
        await client.query(
          'UPDATE trigger_columns.accounts SET "order" = \'changed\''
        );
        await client.query(
          'UPDATE trigger_columns.accounts SET "a""b" = \'changed\''
        );
        await client.query(
          'UPDATE trigger_columns.accounts SET "a,b" = \'changed\''
        );
        await client.query('DELETE FROM trigger_columns.accounts');
        expect(await events()).toEqual([
          'INSERT',
          'UPDATE',
          'UPDATE',
          'UPDATE',
          'UPDATE',
          'UPDATE',
          'DELETE',
        ]);

        await runner({ ...options, direction: 'down' });
        expect(await catalog()).toEqual([]);
        expect(
          (await client.query('SELECT name FROM trigger_columns.pgmigrations'))
            .rows
        ).toEqual([]);
        expect(
          (
            await client.query(
              "SELECT to_regprocedure('trigger_columns.record_event()') AS function"
            )
          ).rows
        ).toEqual([{ function: null }]);
      }
    );
  }
);
