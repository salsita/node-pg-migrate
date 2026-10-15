import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MigrationMap, RunnerOptionMigrations } from '../../src';
import { PG_MIGRATE_LOCK_ID, runner } from '../../src';
import {
  cleanupDatabase,
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'queued inserts (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'queued_inserts'
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
      await cleanupDatabase(container);
    });

    function migrate(
      migrations: MigrationMap,
      options: Partial<RunnerOptionMigrations> = {}
    ) {
      return runner({
        databaseUrl: container.getConnectionUri(),
        migrations,
        schema: 'public',
        migrationsSchema: 'public',
        migrationsTable: 'pgmigrations',
        direction: 'up',
        log: () => {},
        ...options,
      });
    }

    async function history() {
      return (
        await client.query<{ name: string }>(
          'SELECT name FROM public.pgmigrations ORDER BY id'
        )
      ).rows.map(({ name }) => name);
    }

    const baseline: MigrationMap = {
      '001_baseline': {
        up: (pgm) => {
          pgm.createTable('sentinel', {
            id: { type: 'integer', primaryKey: true },
          });
          pgm.insert('sentinel', { id: 7 });
        },
        down: (pgm) => {
          pgm.dropTable('sentinel');
        },
      },
    };

    it('creates a table, inserts escaped values, and applies an explicit down', async () => {
      const table = { schema: 'app.schema', name: 'record"表' };
      const text =
        "O'Reilly $pga$); DROP TABLE sentinel; -- $1 {value} $& $` $' $pga";
      const migrations: MigrationMap = {
        ...baseline,
        '002_insert': {
          up: (pgm) => {
            pgm.createSchema('app.schema');
            pgm.createTable(table, {
              id: { type: 'integer', primaryKey: true, default: 42 },
              'text"value': { type: 'text', default: 'default' },
              active: 'boolean',
              amount: 'integer',
              tags: 'text[]',
              optional: 'text',
              computed: 'integer',
            });
            pgm.insert(table, {
              id: 1,
              'text"value': text,
              active: false,
              amount: 0,
              tags: ['ARRAY', text],
              optional: null,
              computed: pgm.func('1 + 2'),
            });
            pgm.insert(table, {});
          },
          down: (pgm) => {
            pgm.dropTable(table);
            pgm.dropSchema('app.schema');
          },
        },
      };

      await migrate(migrations);
      expect(
        (
          await client.query(
            'SELECT * FROM "app.schema"."record""表" ORDER BY id'
          )
        ).rows
      ).toEqual([
        {
          id: 1,
          'text"value': text,
          active: false,
          amount: 0,
          tags: ['ARRAY', text],
          optional: null,
          computed: 3,
        },
        {
          id: 42,
          'text"value': 'default',
          active: null,
          amount: null,
          tags: null,
          optional: null,
          computed: null,
        },
      ]);
      expect((await client.query('SELECT id FROM sentinel')).rows).toEqual([
        { id: 7 },
      ]);
      expect(await history()).toEqual(['001_baseline', '002_insert']);

      await migrate(migrations, { direction: 'down', count: 1 });
      expect(await history()).toEqual(['001_baseline']);
      expect(
        (
          await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [
            'app.schema',
          ])
        ).rows
      ).toEqual([]);
    });

    it('uses defaults for undefined and accepts serialized JSON and typed empty arrays', async () => {
      const data = { label: "reader's $pga$ edition" };
      await migrate({
        '001_values': {
          up: (pgm) => {
            pgm.createTable('records', {
              id: { type: 'integer', default: 42 },
              data: 'jsonb',
              tags: 'text[]',
            });
            pgm.insert('records', {
              id: undefined,
              data: JSON.stringify(data),
              tags: pgm.func("'{}'::text[]"),
            });
            pgm.insert('records', { id: undefined });
          },
        },
      });
      expect(
        (await client.query('SELECT * FROM records WHERE data IS NOT NULL'))
          .rows
      ).toEqual([{ id: 42, data, tags: [] }]);
      expect(
        (await client.query('SELECT * FROM records WHERE data IS NULL')).rows
      ).toEqual([{ id: 42, data: null, tags: null }]);
    });

    it.each([false, true])(
      'rolls back table creation and inserts on failure (singleTransaction: %s)',
      async (singleTransaction) => {
        await migrate(baseline);
        await expect(
          migrate(
            {
              ...baseline,
              '002_failure': {
                up: (pgm) => {
                  pgm.createTable('records', {
                    id: { type: 'integer', primaryKey: true },
                  });
                  pgm.insert('records', { id: 1 });
                  pgm.insert('sentinel', { id: 8 });
                  pgm.insert('records', { id: 1 });
                },
              },
            },
            { singleTransaction }
          )
        ).rejects.toThrow('duplicate key value');
        expect(await history()).toEqual(['001_baseline']);
        expect((await client.query('SELECT id FROM sentinel')).rows).toEqual([
          { id: 7 },
        ]);
        expect(
          (await client.query("SELECT to_regclass('public.records') AS table"))
            .rows
        ).toEqual([{ table: null }]);
      }
    );

    it('leaves data, schema, and history unchanged in a dry run without acquiring a lock', async () => {
      await migrate(baseline);
      await client.query('SELECT pg_advisory_lock($1)', [PG_MIGRATE_LOCK_ID]);
      try {
        await migrate(
          {
            ...baseline,
            '002_dry_run': {
              up: (pgm) => {
                pgm.insert('sentinel', { id: 8 });
                pgm.createTable('records', { id: 'integer' });
                pgm.insert('records', { id: 1 });
              },
            },
          },
          { dryRun: true }
        );
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [
          PG_MIGRATE_LOCK_ID,
        ]);
      }
      expect((await client.query('SELECT id FROM sentinel')).rows).toEqual([
        { id: 7 },
      ]);
      expect(await history()).toEqual(['001_baseline']);
      expect(
        (await client.query("SELECT to_regclass('public.records') AS table"))
          .rows
      ).toEqual([{ table: null }]);
    });
  }
);
