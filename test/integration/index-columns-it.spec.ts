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

const migrationName = '1000000000000_unique_measurement';

describe.each(PG_VERSIONS)(
  'hyphenated index columns (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'index_columns'
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-index-columns-'));
      await client.query('CREATE SCHEMA index_columns');
      await client.query(`CREATE TABLE index_columns.measurements (
        a integer, b integer, "a-b" integer
      )`);
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS index_columns CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog() {
      return (
        await client.query<{
          name: string;
          column: string | null;
          expression: string | null;
          unique: boolean;
          definition: string;
        }>(
          `SELECT c.relname AS name, a.attname AS column,
            pg_get_expr(i.indexprs, i.indrelid) AS expression,
            i.indisunique AS unique,
            pg_get_indexdef(i.indexrelid, 1, false) AS definition
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indexrelid
          LEFT JOIN pg_attribute a ON a.attrelid = i.indrelid
            AND a.attnum = i.indkey[0]
          WHERE i.indrelid = 'index_columns.measurements'::regclass`
        )
      ).rows;
    }

    it.each([
      { title: 'string', columns: '"a-b"' },
      { title: 'object', columns: '[{ name: "a-b" }]' },
    ])(
      'enforces uniqueness and reverses a $title-form column',
      async ({ columns }) => {
        await writeFile(
          join(dir, `${migrationName}.mjs`),
          `export function up(pgm) {
          pgm.createIndex(
            { schema: 'index_columns', name: 'measurements' },
            ${columns},
            { unique: true }
          );
        }`
        );

        const options = {
          databaseUrl: container.getConnectionUri(),
          dir,
          schema: 'index_columns',
          migrationsSchema: 'index_columns',
          migrationsTable: 'pgmigrations',
          count: 1,
          log: () => {},
        };
        expect(await catalog()).toEqual([]);

        await runner({ ...options, direction: 'up' });
        expect(await catalog()).toEqual([
          {
            name: 'measurements_a-b_unique_index',
            column: 'a-b',
            expression: null,
            unique: true,
            definition: '"a-b"',
          },
        ]);
        expect(
          (await client.query('SELECT name FROM index_columns.pgmigrations'))
            .rows
        ).toEqual([{ name: migrationName }]);

        await client.query(`INSERT INTO index_columns.measurements (a, b, "a-b")
        VALUES (10, 1, 100)`);
        // Different subtraction results must not allow duplicate column values.
        await expect(
          client.query(`INSERT INTO index_columns.measurements (a, b, "a-b")
          VALUES (20, 1, 100)`)
        ).rejects.toMatchObject({
          code: '23505',
          constraint: 'measurements_a-b_unique_index',
        });
        // Equal subtraction results must not reject distinct column values.
        await client.query(`INSERT INTO index_columns.measurements (a, b, "a-b")
        VALUES (11, 2, 200)`);

        await runner({ ...options, direction: 'down' });
        expect(await catalog()).toEqual([]);
        expect(
          (await client.query('SELECT name FROM index_columns.pgmigrations'))
            .rows
        ).toEqual([]);
        expect(
          (
            await client.query(
              'SELECT a, b, "a-b" FROM index_columns.measurements ORDER BY a'
            )
          ).rows
        ).toEqual([
          { a: 10, b: 1, 'a-b': 100 },
          { a: 11, b: 2, 'a-b': 200 },
        ]);
      }
    );
  }
);
