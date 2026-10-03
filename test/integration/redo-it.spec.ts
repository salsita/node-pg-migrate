import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
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

// execFile returns a ChildProcess rather than the void callback signature.
// oxlint-disable-next-line typescript/strict-void-return
const execCli = promisify(execFile);
const first = '1000000000000_first';
const second = '1000000000001_second';
const third = '1000000000002_third';
const fourth = '1000000000003_fourth';
const lockValue = 912_912;

describe.each(PG_VERSIONS)(
  'redo migrations (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let observer: pg.Client;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'redo_migrations'
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
      dir = await mkdtemp(join(tmpdir(), 'pgm-redo-'));
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
      await observer.query('CREATE SCHEMA redo');
      await observer.query(
        'CREATE TABLE redo.control (fail_up boolean, fail_down boolean)'
      );
      await observer.query('INSERT INTO redo.control VALUES (false, false)');
      await observer.query(
        'CREATE TABLE redo.events (id serial PRIMARY KEY, event text NOT NULL)'
      );
    });

    afterEach(async () => {
      // Close a regressed session before dropping its objects, even after a failed assertion.
      await client.end();
      await observer.query('DROP SCHEMA IF EXISTS redo_decoy CASCADE');
      await observer.query('DROP SCHEMA IF EXISTS redo_app CASCADE');
      await observer.query('DROP SCHEMA redo CASCADE');
      await rm(dir, { recursive: true, force: true });
    });

    function options() {
      return {
        dir,
        schema: 'redo',
        migrationsSchema: 'redo',
        migrationsTable: 'pgmigrations',
        lockValue,
        log: () => {},
      };
    }

    async function cli(direction: 'up' | 'redo', args: string[] = []) {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([name]) => name !== 'DATABASE_URL' && !name.startsWith('PG')
        )
      );
      env.DATABASE_URL = container.getConnectionUri();

      return execCli(
        process.execPath,
        [
          resolve('bin/node-pg-migrate.js'),
          direction,
          ...args,
          '--migrations-dir',
          dir,
          '--schema',
          'redo',
          '--migrations-schema',
          'redo',
          '--lock-value',
          String(lockValue),
        ],
        // An isolated cwd also prevents a local .env from changing the connection.
        { cwd: dir, env }
      );
    }

    async function migration(
      name: string,
      up: string,
      down: string,
      noTransaction = false
    ) {
      const prefix = noTransaction ? 'pgm.noTransaction();' : '';
      await writeFile(
        join(dir, `${name}.cjs`),
        `exports.up = (pgm) => { ${prefix} ${up} };\nexports.down = (pgm) => { ${prefix} ${down} };`
      );
    }

    async function standardMigrations(noTransaction = false) {
      await migration(
        first,
        `pgm.createTable('earlier', { id: 'integer', value: 'text' });`,
        `pgm.dropTable('earlier');`
      );
      await migration(
        second,
        `pgm.createTable('replayed', { id: 'integer', value: 'text' });
         pgm.sql("INSERT INTO redo.events (event) VALUES ('second:up')");
         pgm.sql('SELECT 1 / CASE WHEN fail_up THEN 0 ELSE 1 END FROM redo.control');`,
        `pgm.dropTable('replayed');
         pgm.sql("INSERT INTO redo.events (event) VALUES ('second:down')");
         pgm.sql('SELECT 1 / CASE WHEN fail_down THEN 0 ELSE 1 END FROM redo.control');`,
        noTransaction
      );
    }

    async function additionalMigration(name: string, table: string) {
      await migration(
        name,
        `pgm.createTable('${table}', { id: 'integer' });
         pgm.sql("INSERT INTO redo.events (event) VALUES ('${table}:up')");`,
        `pgm.dropTable('${table}');
         pgm.sql("INSERT INTO redo.events (event) VALUES ('${table}:down')");`
      );
    }

    async function history() {
      return (
        await observer.query<{ id: number; name: string; run_on: Date }>(
          'SELECT id, name, run_on FROM redo.pgmigrations ORDER BY id'
        )
      ).rows;
    }

    async function events() {
      return (
        await observer.query<{ event: string }>(
          'SELECT event FROM redo.events ORDER BY id'
        )
      ).rows.map(({ event }) => event);
    }

    async function seedData() {
      await observer.query("INSERT INTO redo.earlier VALUES (1, 'keep')");
      await observer.query("INSERT INTO redo.replayed VALUES (2, 'keep too')");
      await observer.query('TRUNCATE redo.events');
    }

    async function expectDataPreserved() {
      expect((await observer.query('SELECT * FROM redo.earlier')).rows).toEqual(
        [{ id: 1, value: 'keep' }]
      );
      expect(
        (await observer.query('SELECT * FROM redo.replayed')).rows
      ).toEqual([{ id: 2, value: 'keep too' }]);
    }

    async function expectReusable() {
      const {
        rows: [{ pid }],
      } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      expect((await client.query('SELECT 1 AS value')).rows).toEqual([
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
      await expect(
        runner({
          ...options(),
          databaseUrl: container.getConnectionUri(),
          direction: 'up',
          count: 0,
        })
      ).resolves.toEqual([]);
    }

    it('rolls back CLI down changes when up fails, including repeated attempts', async () => {
      await standardMigrations();
      await cli('up');
      await seedData();
      const before = await history();
      await observer.query('UPDATE redo.control SET fail_up = true');

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await expect(cli('redo')).rejects.toMatchObject({
          stderr: expect.stringContaining('division by zero'),
        });
        expect(await history()).toEqual(before);
        await expectDataPreserved();
        expect(await events()).toEqual([]);
      }
    });

    it('rolls back both phases and releases the lock on a supplied client', async () => {
      await standardMigrations();
      await runner({ ...options(), dbClient: client, direction: 'up' });
      await seedData();
      const before = await history();
      await observer.query('UPDATE redo.control SET fail_up = true');

      await expect(
        runner({
          ...options(),
          dbClient: client,
          direction: 'redo',
          singleTransaction: true,
        })
      ).rejects.toMatchObject({ code: '22012' });
      await expectReusable();
      expect(await history()).toEqual(before);
      await expectDataPreserved();
    });

    it('reverses the requested count, reapplies in order and runs pending migrations', async () => {
      await standardMigrations();
      await additionalMigration(third, 'third');
      await cli('up');
      await seedData();
      const [earlierHistory] = await history();
      await additionalMigration(fourth, 'fourth');

      await cli('redo', ['2']);

      expect(await events()).toEqual([
        'third:down',
        'second:down',
        'second:up',
        'third:up',
        'fourth:up',
      ]);
      const after = await history();
      expect(after.map(({ name }) => name)).toEqual([
        first,
        second,
        third,
        fourth,
      ]);
      expect(after[0]).toEqual(earlierHistory);
      expect((await observer.query('SELECT * FROM redo.earlier')).rows).toEqual(
        [{ id: 1, value: 'keep' }]
      );
    });

    it('does not start up after a failing down phase', async () => {
      await standardMigrations();
      await runner({ ...options(), dbClient: client, direction: 'up' });
      await seedData();
      const before = await history();
      await observer.query('UPDATE redo.control SET fail_down = true');

      await expect(
        runner({
          ...options(),
          dbClient: client,
          direction: 'redo',
          singleTransaction: true,
        })
      ).rejects.toMatchObject({ code: '22012' });
      expect(await events()).toEqual([]);
      expect(await history()).toEqual(before);
      await expectDataPreserved();
      await expectReusable();
    });

    it('preserves committed down changes with --no-single-transaction', async () => {
      await standardMigrations();
      await cli('up');
      await seedData();
      const [earlierHistory] = await history();
      await observer.query('UPDATE redo.control SET fail_up = true');

      await expect(
        cli('redo', ['--no-single-transaction'])
      ).rejects.toMatchObject({
        stderr: expect.stringContaining('division by zero'),
      });
      expect(await history()).toEqual([earlierHistory]);
      expect(await events()).toEqual(['second:down']);
      expect(
        (await observer.query("SELECT to_regclass('redo.replayed') AS table"))
          .rows
      ).toEqual([{ table: null }]);
    });

    it('keeps per-migration transactions when singleTransaction is omitted', async () => {
      await standardMigrations();
      await runner({ ...options(), dbClient: client, direction: 'up' });
      const [earlierHistory] = await history();
      await observer.query('TRUNCATE redo.events');
      await observer.query('UPDATE redo.control SET fail_up = true');

      await expect(
        runner({ ...options(), dbClient: client, direction: 'redo' })
      ).rejects.toMatchObject({ code: '22012' });
      expect(await history()).toEqual([earlierHistory]);
      expect(await events()).toEqual(['second:down']);
      await expectReusable();
    });

    it('honors noTransaction in a migration when redo uses a global transaction', async () => {
      await standardMigrations(true);
      await runner({ ...options(), dbClient: client, direction: 'up' });
      const [earlierHistory] = await history();
      await observer.query('TRUNCATE redo.events');
      await observer.query('UPDATE redo.control SET fail_up = true');

      await expect(
        runner({
          ...options(),
          dbClient: client,
          direction: 'redo',
          singleTransaction: true,
        })
      ).rejects.toMatchObject({ code: '22012' });
      expect(await history()).toEqual([earlierHistory]);
      expect(await events()).toEqual(['second:down', 'second:up']);
      expect(
        (await observer.query("SELECT to_regclass('redo.replayed') AS table"))
          .rows
      ).toEqual([{ table: 'redo.replayed' }]);
      await expectReusable();
    });

    it('prints both dry-run phases in order without changing history, data or acquiring a lock', async () => {
      await standardMigrations();
      await runner({ ...options(), dbClient: client, direction: 'up' });
      await seedData();
      const before = await history();
      const logs: string[] = [];
      async function expectPreview(output: string) {
        const down = `MIGRATION ${second} (DOWN)`;
        const up = `MIGRATION ${second} (UP)`;
        expect(output).toContain(down);
        expect(output).toContain(up);
        expect(output.indexOf(down)).toBeLessThan(output.indexOf(up));
        expect(output).toContain('DROP TABLE');
        expect(output).toContain('CREATE TABLE');
        expect(output.indexOf('DROP TABLE')).toBeLessThan(
          output.indexOf('CREATE TABLE')
        );
        expect(await history()).toEqual(before);
        await expectDataPreserved();
        expect(await events()).toEqual([]);
      }
      await observer.query('SELECT pg_advisory_lock($1)', [lockValue]);
      try {
        const { stdout } = await cli('redo', ['--dry-run']);
        await expectPreview(stdout);
        await runner({
          ...options(),
          dbClient: client,
          direction: 'redo',
          singleTransaction: true,
          dryRun: true,
          log: (message: string) => {
            logs.push(message);
          },
        });
        await expectPreview(logs.join('\n'));
      } finally {
        await observer.query('SELECT pg_advisory_unlock($1)', [lockValue]);
      }
      await expectReusable();
    });

    it('rolls back fake redo history on failure and never runs migration SQL', async () => {
      await standardMigrations();
      await runner({ ...options(), dbClient: client, direction: 'up' });
      await seedData();
      const before = await history();
      await observer.query(
        'UPDATE redo.control SET fail_up = true, fail_down = true'
      );
      await observer.query(
        `ALTER TABLE redo.pgmigrations ADD CONSTRAINT reject_reinsert CHECK (name <> '${second}') NOT VALID`
      );

      await expect(
        runner({
          ...options(),
          dbClient: client,
          direction: 'redo',
          singleTransaction: true,
          fake: true,
        })
      ).rejects.toMatchObject({ code: '23514' });
      expect(await history()).toEqual(before);
      await expectReusable();
      await observer.query(
        'ALTER TABLE redo.pgmigrations DROP CONSTRAINT reject_reinsert'
      );
      await additionalMigration(third, 'third');
      await runner({
        ...options(),
        dbClient: client,
        direction: 'redo',
        singleTransaction: true,
        fake: true,
      });

      expect((await history()).map(({ name }) => name)).toEqual([
        first,
        second,
        third,
      ]);
      await expectDataPreserved();
      expect(await events()).toEqual([]);
      expect(
        (await observer.query("SELECT to_regclass('redo.third') AS table")).rows
      ).toEqual([{ table: null }]);
    });

    it('runs pending migrations when there is nothing to roll back', async () => {
      await standardMigrations();

      await cli('redo');

      expect((await history()).map(({ name }) => name)).toEqual([
        first,
        second,
      ]);
      expect(await events()).toEqual(['second:up']);
    });

    it('reapplies an up-only migration after its inferred down migration', async () => {
      await standardMigrations();
      await writeFile(
        join(dir, `${third}.cjs`),
        "exports.up = (pgm) => { pgm.createTable('inferred', { id: 'integer' }); };"
      );
      await runner({ ...options(), dbClient: client, direction: 'up' });
      const before = await history();
      await observer.query('INSERT INTO redo.inferred VALUES (1)');

      await runner({
        ...options(),
        dbClient: client,
        direction: 'redo',
        singleTransaction: true,
      });

      const after = await history();
      expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
      expect(after[2].name).toBe(third);
      expect(after[2].id).toBeGreaterThan(before[2].id);
      expect(
        (await observer.query('SELECT * FROM redo.inferred')).rows
      ).toEqual([]);
    });

    it('restores the configured search path before reapplying migrations', async () => {
      await observer.query('CREATE SCHEMA redo_decoy');
      await migration(
        first,
        "pgm.createTable('restored', { id: 'integer' });",
        "pgm.dropTable('restored'); pgm.sql('SET search_path TO redo_decoy');"
      );
      await runner({ ...options(), dbClient: client, direction: 'up' });
      const [before] = await history();
      await observer.query('INSERT INTO redo.restored VALUES (1)');

      await runner({
        ...options(),
        dbClient: client,
        direction: 'redo',
        singleTransaction: true,
      });

      expect(
        (
          await observer.query(
            "SELECT to_regclass('redo.restored') IS NOT NULL AS restored, to_regclass('redo_decoy.restored') IS NULL AS decoy_empty"
          )
        ).rows
      ).toEqual([{ restored: true, decoy_empty: true }]);
      expect(
        (await observer.query('SELECT * FROM redo.restored')).rows
      ).toEqual([]);
      const after = await history();
      expect(after.map(({ name }) => name)).toEqual([first]);
      expect(after[0].id).toBeGreaterThan(before.id);
    });

    it('recreates a configured application schema removed by down', async () => {
      await migration(
        first,
        "pgm.createTable('restored', { id: 'integer' });",
        "pgm.dropTable('restored'); pgm.dropSchema('redo_app');"
      );
      const config = {
        ...options(),
        dbClient: client,
        schema: 'redo_app',
        createSchema: true,
        singleTransaction: true,
      };
      await runner({ ...config, direction: 'up' });
      const [before] = await history();
      await observer.query('INSERT INTO redo_app.restored VALUES (1)');

      await runner({ ...config, direction: 'redo' });

      expect(
        (await observer.query('SELECT * FROM redo_app.restored')).rows
      ).toEqual([]);
      const after = await history();
      expect(after.map(({ name }) => name)).toEqual([first]);
      expect(after[0].id).toBeGreaterThan(before.id);
    });
  }
);
