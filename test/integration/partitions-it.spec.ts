import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MigrationMap, RunnerOptionMigrations } from '../../src';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'partitions (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'partitions'
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

    const schema = 'partition."schema';
    const name = (table: string) => ({ schema, name: table });
    const migrations: MigrationMap = {
      '001_partitions': {
        up: (pgm) => {
          pgm.createSchema(schema);
          pgm.createTable(
            name('events'),
            {
              id: { type: 'integer', notNull: true, check: 'id >= 0' },
              label: { type: 'text', default: 'ready', notNull: true },
            },
            {
              partition: { strategy: 'RANGE', columns: 'id' },
              constraints: { primaryKey: ['id', 'label'] },
            }
          );
          pgm.createPartition(
            name('range'),
            name('events'),
            { strategy: 'RANGE', from: [0], to: [10] },
            {
              partition: { strategy: 'LIST', columns: 'label' },
            }
          );
          pgm.createPartition(
            name('list"leaf'),
            name('range'),
            { strategy: 'LIST', values: ["O'Reilly", '$pga$; SELECT 1; --'] },
            { comment: "leaf's comment" }
          );
          pgm.createPartition(name('list_default'), name('range'), {
            strategy: 'DEFAULT',
          });
          pgm.createPartition(name('range_default'), name('events'), {
            strategy: 'DEFAULT',
          });
          pgm.createTable(
            name('flags'),
            { flag: 'boolean' },
            { partition: { strategy: 'LIST', columns: 'flag' } }
          );
          pgm.createPartition(name('false_or_null'), name('flags'), {
            strategy: 'LIST',
            values: [false, null],
          });
          pgm.createPartition(name('true'), name('flags'), {
            strategy: 'LIST',
            values: [true],
          });
          pgm.createTable(
            name('hashed'),
            { id: 'integer' },
            { partition: { strategy: 'HASH', columns: 'id' } }
          );
          pgm.createPartition(name('hash_0'), name('hashed'), {
            strategy: 'HASH',
            modulus: 2,
            remainder: 0,
          });
          pgm.createPartition(name('hash_1'), name('hashed'), {
            strategy: 'HASH',
            modulus: 2,
            remainder: 1,
          });
          pgm.createTable(
            name('unbounded'),
            { a: 'integer', b: 'integer' },
            { partition: { strategy: 'RANGE', columns: ['a', 'b'] } }
          );
          pgm.createPartition(name('unbounded_child'), name('unbounded'), {
            strategy: 'RANGE',
            from: [0, pgm.func('MINVALUE')],
            to: [10, pgm.func('MAXVALUE')],
          });
        },
      },
    };

    function migrate(options: Partial<RunnerOptionMigrations> = {}) {
      return runner({
        databaseUrl: container.getConnectionUri(),
        migrations,
        direction: 'up',
        migrationsSchema: 'public',
        migrationsTable: 'pgmigrations',
        log: () => {},
        ...options,
      });
    }

    it('routes rows to each partition strategy, inherits constraints, and rolls back child-first', async () => {
      await migrate({ dryRun: true });
      expect(
        (
          await client.query(
            'SELECT oid FROM pg_namespace WHERE nspname = $1',
            [schema]
          )
        ).rows
      ).toEqual([]);
      expect(
        (
          await client.query(
            "SELECT to_regclass('public.pgmigrations') AS history"
          )
        ).rows
      ).toEqual([{ history: null }]);
      await migrate();
      await client.query(
        'INSERT INTO "partition.""schema".events (id, label) VALUES (0, $1), (9, $2), (10, $1)',
        ["O'Reilly", '$pga$; SELECT 1; --']
      );
      await client.query(
        'INSERT INTO "partition.""schema".events (id) VALUES (1)'
      );
      expect(
        (
          await client.query<{ id: number; partition: string }>(
            'SELECT id, c.relname AS partition FROM "partition.""schema".events e JOIN pg_class c ON e.tableoid = c.oid ORDER BY id'
          )
        ).rows
      ).toEqual([
        { id: 0, partition: 'list"leaf' },
        { id: 1, partition: 'list_default' },
        { id: 9, partition: 'list"leaf' },
        { id: 10, partition: 'range_default' },
      ]);
      await expect(
        client.query('INSERT INTO "partition.""schema".events (id) VALUES (-1)')
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        client.query('INSERT INTO "partition.""schema".events (id) VALUES (1)')
      ).rejects.toMatchObject({ code: '23505' });
      expect(
        (
          await client.query(
            'SELECT obj_description(c.oid) AS comment FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = $1 AND c.relname = $2',
            [schema, 'list"leaf']
          )
        ).rows
      ).toEqual([{ comment: "leaf's comment" }]);

      await client.query(
        'INSERT INTO "partition.""schema".flags VALUES (false), (NULL), (true)'
      );
      expect(
        (
          await client.query(
            'SELECT flag, c.relname AS partition FROM "partition.""schema".flags f JOIN pg_class c ON f.tableoid = c.oid ORDER BY flag NULLS LAST'
          )
        ).rows
      ).toEqual([
        { flag: false, partition: 'false_or_null' },
        { flag: true, partition: 'true' },
        { flag: null, partition: 'false_or_null' },
      ]);
      await client.query(
        'INSERT INTO "partition.""schema".hashed SELECT generate_series(1, 100)'
      );
      expect(
        (
          await client.query(
            'SELECT DISTINCT c.relname AS partition FROM "partition.""schema".hashed h JOIN pg_class c ON h.tableoid = c.oid ORDER BY partition'
          )
        ).rows
      ).toEqual([{ partition: 'hash_0' }, { partition: 'hash_1' }]);
      expect(
        (
          await client.query(
            'SELECT count(*)::int AS count FROM "partition.""schema".hashed'
          )
        ).rows
      ).toEqual([{ count: 100 }]);
      await client.query(
        'INSERT INTO "partition.""schema".unbounded VALUES (0, -100), (10, 100)'
      );
      await expect(
        client.query(
          'INSERT INTO "partition.""schema".unbounded VALUES (11, 0)'
        )
      ).rejects.toMatchObject({ code: '23514' });

      await migrate({ direction: 'down', count: Infinity });
      expect(
        (
          await client.query(
            'SELECT oid FROM pg_namespace WHERE nspname = $1',
            [schema]
          )
        ).rows
      ).toEqual([]);
      expect(
        (await client.query('SELECT name FROM public.pgmigrations')).rows
      ).toEqual([]);
    });

    it('rolls back parent and children if PostgreSQL rejects overlapping bounds', async () => {
      await expect(
        migrate({
          migrations: {
            '002_overlapping': {
              up: (pgm) => {
                pgm.createTable(
                  'overlapping',
                  { id: 'integer' },
                  { partition: { strategy: 'RANGE', columns: 'id' } }
                );
                pgm.createPartition('first', 'overlapping', {
                  strategy: 'RANGE',
                  from: [0],
                  to: [10],
                });
                pgm.createPartition('second', 'overlapping', {
                  strategy: 'RANGE',
                  from: [5],
                  to: [15],
                });
              },
            },
          },
          logger: { info: () => {}, warn: () => {}, error: () => {} },
        })
      ).rejects.toMatchObject({ code: '42P17' });
      expect(
        (
          await client.query(
            "SELECT to_regclass('public.overlapping') AS parent, to_regclass('public.first') AS child"
          )
        ).rows
      ).toEqual([{ parent: null, child: null }]);
      expect(
        (await client.query('SELECT name FROM public.pgmigrations')).rows
      ).toEqual([]);
    });
  }
);
