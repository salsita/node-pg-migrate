import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'nullability options (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'nullability_options'
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

    afterEach(async () => {
      await client.query(`
        DROP TABLE IF EXISTS sample, pgmigrations;
        DROP DOMAIN IF EXISTS sample_domain;
      `);
    });

    it.each([
      [false, { allowNull: false }, false, 2],
      [true, { allowNull: false }, true, 2],
      [false, { notNull: true, allowNull: true }, true, 2],
      [true, { notNull: false, allowNull: false }, false, 2],
      [true, { allowNull: true }, false, 0],
      [false, { notNull: true, allowNull: false }, true, 0],
    ] as const)(
      'preserves constraints and other alterations (initial NOT NULL: %s, options: %j)',
      async (initialNotNull, options, expectedNotNull, warningCount) => {
        const constraint = initialNotNull ? 'NOT NULL' : '';
        await client.query(`
          CREATE TABLE sample (value integer ${constraint});
          CREATE DOMAIN sample_domain AS integer ${constraint};
        `);
        const warn = vi.fn<(message: string) => void>();

        await runner({
          databaseUrl: container.getConnectionUri(),
          migrations: {
            '001_alter': {
              up: (pgm) => {
                pgm.alterColumn('sample', 'value', { ...options, default: 7 });
                pgm.alterDomain('sample_domain', { ...options, default: 8 });
              },
            },
          },
          migrationsSchema: 'public',
          migrationsTable: 'pgmigrations',
          direction: 'up',
          logger: { info: () => {}, warn, error: () => {} },
        });

        expect(warn).toHaveBeenCalledTimes(warningCount);
        expect(
          (
            await client.query(
              "SELECT attnotnull FROM pg_attribute WHERE attrelid = 'sample'::regclass AND attname = 'value'"
            )
          ).rows
        ).toEqual([{ attnotnull: expectedNotNull }]);
        expect(
          (
            await client.query(
              "SELECT typnotnull, typdefault FROM pg_type WHERE oid = 'sample_domain'::regtype"
            )
          ).rows
        ).toEqual([{ typnotnull: expectedNotNull, typdefault: '8' }]);
        expect(
          (
            await client.query(
              'INSERT INTO sample DEFAULT VALUES RETURNING value'
            )
          ).rows
        ).toEqual([{ value: 7 }]);

        for (const sql of [
          'INSERT INTO sample VALUES (NULL)',
          'SELECT NULL::sample_domain',
        ]) {
          const result = await client.query(sql).then(
            () => 'accepted',
            (error: unknown) => (error as pg.DatabaseError).code
          );
          expect(result).toBe(expectedNotNull ? '23502' : 'accepted');
        }
      }
    );
  }
);
