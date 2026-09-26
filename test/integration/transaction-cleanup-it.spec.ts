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
  vi,
} from 'vitest';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const first = '1000000000000_first';
const second = '1000000000001_second';

describe.each(PG_VERSIONS)(
  'transaction cleanup (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let observer: pg.Client;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'transaction_cleanup'
      );
      observer = new pg.Client(container.getConnectionUri());
      await observer.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (observer) {
        await observer.end();
      }
      if (container) {
        await container.stop();
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-transaction-cleanup-'));
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
      await observer.query('CREATE SCHEMA cleanup');
    });

    afterEach(async () => {
      // Close even an aborted session before removing objects, including when a regression fails.
      await client.end();
      await observer.query('DROP SCHEMA cleanup CASCADE');
      await rm(dir, { recursive: true, force: true });
    });

    function options() {
      return {
        dir,
        schema: 'cleanup',
        migrationsSchema: 'cleanup',
        migrationsTable: 'pgmigrations',
        log: () => {},
      };
    }

    async function migration(name: string, up: string, down?: string) {
      await writeFile(
        join(dir, `${name}.cjs`),
        `exports.up = async (pgm) => { ${up} };\n${down === undefined ? '' : `exports.down = async (pgm) => { ${down} };`}`
      );
    }

    async function history() {
      return (
        await observer.query<{ name: string }>(
          'SELECT name FROM cleanup.pgmigrations ORDER BY name'
        )
      ).rows.map(({ name }) => name);
    }

    async function tables() {
      return (
        await observer.query<{ tablename: string }>(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'cleanup' ORDER BY tablename"
        )
      ).rows.map(({ tablename }) => tablename);
    }

    async function expectReusable(connection: pg.ClientBase = client) {
      const {
        rows: [{ pid }],
      } = await connection.query<{ pid: number }>(
        'SELECT pg_backend_pid() AS pid'
      );
      expect((await connection.query('SELECT 1 AS value')).rows).toEqual([
        { value: 1 },
      ]);
      expect(
        (
          await observer.query(
            `SELECT state, (SELECT count(*)::int FROM pg_locks WHERE pid = $1 AND locktype = 'advisory') AS locks
       FROM pg_stat_activity WHERE pid = $1`,
            [pid]
          )
        ).rows
      ).toEqual([{ state: 'idle', locks: 0 }]);

      // A separate runner must acquire the lock while the failed runner's client stays connected.
      await expect(
        runner({
          ...options(),
          databaseUrl: container.getConnectionUri(),
          direction: 'up',
          count: 0,
        })
      ).resolves.toEqual([]);
    }

    describe.each([
      { label: 'separate transactions', config: { singleTransaction: false } },
      { label: 'omitted singleTransaction', config: {} },
      { label: 'global transaction', config: { singleTransaction: true } },
    ])('$label', ({ config }) => {
      it('rolls back failed up SQL and history, preserving earlier commits', async () => {
        await migration(first, `pgm.createTable('first', { id: 'integer' });`);
        await migration(
          second,
          `pgm.createTable('second', { id: 'integer' }); pgm.sql('SELECT 1 / 0');`
        );

        await expect(
          runner({ ...options(), ...config, dbClient: client, direction: 'up' })
        ).rejects.toMatchObject({ code: '22012' });
        await expectReusable();
        expect(await history()).toEqual(
          config.singleTransaction ? [] : [first]
        );
        expect(await tables()).toEqual(
          config.singleTransaction
            ? ['pgmigrations']
            : ['first', 'pgmigrations']
        );
      });

      it('rolls back failed down SQL and history, preserving earlier commits', async () => {
        await migration(
          first,
          `pgm.createTable('first', { id: 'integer' });`,
          `pgm.dropTable('first'); pgm.sql('SELECT 1 / 0');`
        );
        await migration(
          second,
          `pgm.createTable('second', { id: 'integer' });`,
          `pgm.dropTable('second');`
        );
        await runner({ ...options(), dbClient: client, direction: 'up' });

        await expect(
          runner({
            ...options(),
            ...config,
            dbClient: client,
            direction: 'down',
            count: 2,
          })
        ).rejects.toMatchObject({ code: '22012' });
        await expectReusable();
        expect(await history()).toEqual(
          config.singleTransaction ? [first, second] : [first]
        );
        expect(await tables()).toEqual(
          config.singleTransaction
            ? ['first', 'pgmigrations', 'second']
            : ['first', 'pgmigrations']
        );
      });
    });

    it('recovers without a lock when noLock is enabled', async () => {
      await migration(first, `pgm.sql('SELECT 1 / 0');`);
      await expect(
        runner({
          ...options(),
          dbClient: client,
          direction: 'up',
          noLock: true,
        })
      ).rejects.toMatchObject({ code: '22012' });
      await expectReusable();
      expect(await history()).toEqual([]);
    });

    it('leaves a pool client checked out and reusable after failure', async () => {
      await migration(first, `pgm.sql('SELECT 1 / 0');`);
      const pool = new pg.Pool({
        connectionString: container.getConnectionUri(),
        max: 1,
      });
      const pooled = await pool.connect();
      const release = vi.spyOn(pooled, 'release');
      try {
        await expect(
          runner({ ...options(), dbClient: pooled, direction: 'up' })
        ).rejects.toMatchObject({ code: '22012' });
        expect(release).not.toHaveBeenCalled();
        expect(pool.idleCount).toBe(0);
        await expectReusable(pooled);
      } finally {
        release.mockRestore();
        // Destroy a regressed client too, so cleanup cannot retain an aborted session.
        pooled.release(true);
        await pool.end();
      }
    });

    it('rolls back SQL when history insertion fails', async () => {
      await migration(first, `pgm.createTable('first', { id: 'integer' });`);
      await runner({
        ...options(),
        dbClient: client,
        direction: 'up',
        count: 0,
      });
      await observer.query(
        `ALTER TABLE cleanup.pgmigrations ADD CONSTRAINT reject_history CHECK (name <> '${first}')`
      );

      await expect(
        runner({ ...options(), dbClient: client, direction: 'up' })
      ).rejects.toMatchObject({ code: '23514' });
      await expectReusable();
      expect(await history()).toEqual([]);
      expect(await tables()).toEqual(['pgmigrations']);
    });

    it('preserves a deferred constraint error at COMMIT and releases the lock', async () => {
      await observer.query(
        'CREATE TABLE cleanup.parent (id integer PRIMARY KEY)'
      );
      await observer.query(
        'CREATE TABLE cleanup.child (id integer REFERENCES cleanup.parent DEFERRABLE INITIALLY DEFERRED)'
      );
      await migration(
        first,
        `pgm.sql('INSERT INTO cleanup.child VALUES (1)');`
      );

      await expect(
        runner({ ...options(), dbClient: client, direction: 'up' })
      ).rejects.toMatchObject({ code: '23503' });
      await expectReusable();
      expect(await history()).toEqual([]);
      expect(
        (await observer.query('SELECT * FROM cleanup.child')).rows
      ).toEqual([]);
    });

    it('recovers after failure of an automatically reversed migration', async () => {
      await migration(first, `pgm.createTable('first', { id: 'integer' });`);
      await runner({ ...options(), dbClient: client, direction: 'up' });
      await observer.query(
        'CREATE VIEW cleanup.dependent AS SELECT * FROM cleanup.first'
      );

      await expect(
        runner({ ...options(), dbClient: client, direction: 'down' })
      ).rejects.toMatchObject({ code: '2BP01' });
      await expectReusable();
      expect(await history()).toEqual([first]);
      expect(await tables()).toEqual(['first', 'pgmigrations']);
    });

    it('preserves committed nontransactional SQL and still releases the lock', async () => {
      await migration(
        first,
        `pgm.noTransaction(); pgm.createTable('first', { id: 'integer' }); pgm.sql('SELECT 1 / 0');`
      );

      await expect(
        runner({ ...options(), dbClient: client, direction: 'up' })
      ).rejects.toMatchObject({ code: '22012' });
      await expectReusable();
      expect(await history()).toEqual([]);
      expect(await tables()).toEqual(['first', 'pgmigrations']);
    });

    it('recovers a dry-run client after a rejected direct write without creating objects', async () => {
      await migration(
        first,
        `await pgm.db.query('CREATE TABLE cleanup.first (id integer)');`
      );

      await expect(
        runner({
          ...options(),
          dbClient: client,
          direction: 'up',
          dryRun: true,
        })
      ).rejects.toMatchObject({ cause: { code: '25006' } });
      expect(await tables()).toEqual([]);
      await expectReusable();
    });
  }
);
