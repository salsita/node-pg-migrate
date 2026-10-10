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
import type {
  MigrationBuilderActions,
  MigrationMap,
  RunnerOption,
} from '../../src';
import { PG_MIGRATE_LOCK_ID, runner } from '../../src';
import type { RunnerOptionMigrations } from '../../src/runner';
import {
  cleanupDatabase,
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'in-memory migrations (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'memory_migrations'
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

    afterEach(async () => {
      vi.restoreAllMocks();
      await cleanupDatabase(container);
    });

    function migrate(
      migrations: MigrationMap,
      options: Partial<RunnerOptionMigrations> = {}
    ): Promise<Awaited<ReturnType<typeof runner>>> {
      return runner({
        databaseUrl: container.getConnectionUri(),
        migrations,
        migrationsSchema: 'public',
        migrationsTable: 'pgmigrations',
        direction: 'up',
        log: () => {},
        ...options,
      });
    }

    async function history(): Promise<string[]> {
      return (
        await client.query<{ name: string }>(
          'SELECT name FROM public.pgmigrations ORDER BY id'
        )
      ).rows.map(({ name }) => name);
    }

    async function tables(): Promise<string[]> {
      return (
        await client.query<{ tablename: string }>(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )
      ).rows.map(({ tablename }) => tablename);
    }

    function tableMigrations(): MigrationMap {
      return {
        'bundled/002_items.js': () => ({
          up: (pgm) => {
            pgm.createTable('items', { id: 'record_id' });
          },
        }),
        'bundled/001_users.js': {
          shorthands: { record_id: { type: 'integer', notNull: true } },
          up: (pgm) => {
            pgm.createTable('users', { id: 'record_id' });
          },
        },
      };
    }

    async function expectLockReleased(): Promise<void> {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [PG_MIGRATE_LOCK_ID]
      );
      try {
        expect(result.rows).toEqual([{ acquired: true }]);
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [
          PG_MIGRATE_LOCK_ID,
        ]);
      }
    }

    it('applies sorted maps with cumulative shorthands and inferred down actions', async () => {
      const migrations = tableMigrations();

      const applied = await migrate(migrations);
      expect(applied.map(({ name }) => name)).toEqual([
        '001_users',
        '002_items',
      ]);
      expect(await history()).toEqual(['001_users', '002_items']);
      expect(await tables()).toEqual(['items', 'pgmigrations', 'users']);
      expect(await migrate(migrations)).toEqual([]);

      const reverted = await migrate(migrations, {
        direction: 'down',
        count: Number.POSITIVE_INFINITY,
      });
      expect(reverted.map(({ name }) => name)).toEqual([
        '002_items',
        '001_users',
      ]);
      expect(await history()).toEqual([]);
      expect(await tables()).toEqual(['pgmigrations']);
    });

    it('uses the existing count, timestamp and file filters', async () => {
      const migrations = tableMigrations();
      await migrate(migrations, { count: 1 });
      expect(await history()).toEqual(['001_users']);
      await migrate(migrations, { file: '002_items' });
      expect(await history()).toEqual(['001_users', '002_items']);
      await migrate(migrations, {
        direction: 'down',
        timestamp: true,
        count: 2,
      });
      expect(await history()).toEqual(['001_users']);
      expect(await tables()).toEqual(['pgmigrations', 'users']);
    });

    it('checks ordering against the same history names as file migrations', async () => {
      const migrations = tableMigrations();
      await migrate(migrations, { file: '002_items' });

      await expect(migrate(migrations)).rejects.toThrow(
        'Not run migration 001_users is preceding already run migration 002_items'
      );
      expect(await history()).toEqual(['002_items']);
      expect(await tables()).toEqual(['items', 'pgmigrations']);
      await expectLockReleased();
    });

    it('reloads factories for both redo phases and reuses an external client', async () => {
      const actions: MigrationBuilderActions = {
        up: (pgm) => {
          pgm.createTable('items', { id: 'integer' });
        },
      };
      const factory = vi.fn(() => Promise.resolve(actions));
      const migrations = { '001_items': factory };
      await migrate(migrations);
      const end = vi.spyOn(client, 'end');
      const options: RunnerOption = {
        dbClient: client,
        migrations,
        migrationsSchema: 'public',
        migrationsTable: 'pgmigrations',
        direction: 'redo',
        singleTransaction: true,
        log: () => {},
      };

      const result = await runner(options);

      expect(result.map(({ name }) => name)).toEqual([
        '001_items',
        '001_items',
      ]);
      expect(factory).toHaveBeenCalledTimes(3);
      expect(end).not.toHaveBeenCalled();
      expect(await history()).toEqual(['001_items']);
      expect(await tables()).toEqual(['items', 'pgmigrations']);
    });

    it('accepts an empty bundled map as an empty migration set', async () => {
      expect(await migrate({})).toEqual([]);
      expect(await history()).toEqual([]);
      expect(await tables()).toEqual(['pgmigrations']);
    });

    it('fakes both directions without executing the supplied actions', async () => {
      const action = vi.fn(() => {
        throw new Error('must not execute');
      });
      const migrations: MigrationMap = {
        '001_fake': { up: action, down: action },
      };

      await migrate(migrations, { fake: true });
      expect(await history()).toEqual(['001_fake']);
      await migrate(migrations, { fake: true, direction: 'down' });
      expect(await history()).toEqual([]);
      expect(await tables()).toEqual(['pgmigrations']);
      expect(action).not.toHaveBeenCalled();
    });

    it('cleans up a rejecting factory without creating history or applying earlier actions', async () => {
      const action = vi.fn(() => {});
      const failure = new Error('factory failed');
      const migrations: MigrationMap = {
        '001_loaded': { up: action },
        '002_failed': () => Promise.reject(failure),
      };

      await expect(migrate(migrations)).rejects.toMatchObject({
        message: 'Error loading migrations: factory failed',
        cause: failure,
      });
      expect(action).not.toHaveBeenCalled();
      expect(await tables()).toEqual([]);
      await expectLockReleased();
      await migrate(tableMigrations());
      expect(await history()).toEqual(['001_users', '002_items']);
    });

    it('rolls back shared redo when a factory fails during reapplication', async () => {
      const migrations = tableMigrations();
      await migrate(migrations);
      await client.query('INSERT INTO items (id) VALUES (42)');
      const before = (
        await client.query('SELECT * FROM pgmigrations ORDER BY id')
      ).rows;
      let loads = 0;
      const factory: MigrationMap = {
        ...migrations,
        'bundled/002_items.js': () => {
          loads += 1;
          if (loads === 2) {
            throw new Error('reload failed');
          }
          return {
            up: (pgm) => {
              pgm.createTable('items', { id: 'integer' });
            },
          };
        },
      };

      await expect(
        migrate(factory, { direction: 'redo', singleTransaction: true })
      ).rejects.toThrow('Error loading migrations: reload failed');

      expect((await client.query('SELECT id FROM items')).rows).toEqual([
        { id: 42 },
      ]);
      expect(
        (await client.query('SELECT * FROM pgmigrations ORDER BY id')).rows
      ).toEqual(before);
      await expectLockReleased();
    });

    it.each([false, true])(
      'leaves a fresh database unchanged on dry run with fake: %s',
      async (fake) => {
        const query = vi.spyOn(client, 'query');
        const options: RunnerOption = {
          dbClient: client,
          migrations: tableMigrations(),
          migrationsTable: 'pgmigrations',
          direction: 'up',
          createMigrationsSchema: true,
          migrationsSchema: 'preview',
          dryRun: true,
          fake,
          log: () => {},
        };

        await runner(options);

        const statements = query.mock.calls.map(([statement]) => statement);
        expect(statements).toContain('SET TRANSACTION READ ONLY');
        expect(statements).toContain('ROLLBACK');
        expect(statements.some((sql) => sql.includes('advisory'))).toBe(false);
        expect(await tables()).toEqual([]);
        expect(
          (
            await client.query(
              "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'preview'"
            )
          ).rows
        ).toEqual([]);
      }
    );

    it('preserves existing data and history during dry redo', async () => {
      const migrations = tableMigrations();
      await migrate(migrations);
      await client.query('INSERT INTO items (id) VALUES (42)');
      const before = (
        await client.query('SELECT * FROM pgmigrations ORDER BY id')
      ).rows;

      const result = await migrate(migrations, {
        direction: 'redo',
        dryRun: true,
      });

      expect(result.map(({ name }) => name)).toEqual([
        '002_items',
        '002_items',
      ]);
      expect((await client.query('SELECT id FROM items')).rows).toEqual([
        { id: 42 },
      ]);
      expect(
        (await client.query('SELECT * FROM pgmigrations ORDER BY id')).rows
      ).toEqual(before);
    });

    it('rejects direct database writes inside a dry-run action', async () => {
      const migrations: MigrationMap = {
        '001_write': {
          up: async (pgm) => {
            await pgm.db.query('CREATE TABLE escaped (id integer)');
          },
        },
      };

      await expect(migrate(migrations, { dryRun: true })).rejects.toThrow(
        'This migration writes to the database directly'
      );
      expect(await tables()).toEqual([]);
    });
  }
);
