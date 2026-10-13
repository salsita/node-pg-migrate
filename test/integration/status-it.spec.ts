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
import { getMigrationStatus, PG_MIGRATE_LOCK_ID, runner } from '../../src';
import {
  cleanupDatabase,
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

// execFile returns a ChildProcess; promisify uses its completion callback.
// oxlint-disable-next-line typescript/strict-void-return
const execute = promisify(execFile);
const logger = { info: () => {}, warn: () => {}, error: () => {} };

describe.each(PG_VERSIONS)(
  'migration status (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(`postgres:${version}-alpine`);
      client = new pg.Client({
        connectionString: container.getConnectionUri(),
      });
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await client?.end();
      await container?.stop();
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-status-'));
      await writeFile(
        join(dir, '001_first.cjs'),
        "exports.up = pgm => pgm.createTable('status_table', { id: 'integer' });\n"
      );
      await writeFile(
        join(dir, '002_next.cjs'),
        "exports.up = async pgm => { await pgm.db.query('DROP TABLE status_table'); throw new Error('status ran an action'); };\n"
      );
    });

    afterEach(async () => {
      await client.query('ROLLBACK');
      await client.query('SELECT pg_advisory_unlock_all()');
      await cleanupDatabase(container);
      await rm(dir, { recursive: true, force: true });
    });

    function options() {
      return { dbClient: client, dir, migrationsTable: 'pgmigrations', logger };
    }

    function status(...args: string[]) {
      return execute(
        process.execPath,
        [resolve('bin/node-pg-migrate.js'), 'status', '-m', dir, ...args],
        {
          env: {
            ...Object.fromEntries(
              Object.entries(process.env).filter(
                ([key]) => !key.startsWith('PG') && key !== 'DATABASE_URL'
              )
            ),
            DATABASE_URL: container.getConnectionUri(),
          },
          timeout: INTEGRATION_TIMEOUT,
        }
      );
    }

    async function snapshot() {
      const tables = await client.query(
        "SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY 1, 2"
      );
      const history = await client.query(
        'SELECT * FROM pgmigrations ORDER BY id'
      );
      const data = await client.query('SELECT * FROM status_table');
      return { tables: tables.rows, history: history.rows, data: data.rows };
    }

    it('lists pending files without creating a missing schema or history table', async () => {
      const { stdout } = await status('--migrations-schema', 'missing');
      expect(stdout).toContain('pending\t001_first');
      expect(stdout).toContain('pending\t002_next');
      const { rows } = await client.query(
        "SELECT 1 FROM pg_namespace WHERE nspname = 'missing' UNION ALL SELECT 1 FROM pg_tables WHERE schemaname = 'public'"
      );
      expect(rows).toEqual([]);
    });

    it('reports status while the migration lock is held and leaves schema, data and history unchanged', async () => {
      await runner({ ...options(), direction: 'up', count: 1 });
      await client.query('INSERT INTO status_table VALUES (42)');
      const before = await snapshot();
      await client.query('SELECT pg_advisory_lock($1)', [PG_MIGRATE_LOCK_ID]);
      const { stdout } = await status();
      expect(stdout).toContain('applied\t001_first');
      expect(stdout).toContain('pending\t002_next');
      expect(stdout).not.toContain('Migrations complete');
      expect(await snapshot()).toEqual(before);
    });

    it('reports recorded migrations whose files have been removed', async () => {
      await runner({ ...options(), direction: 'up', count: 1 });
      await rm(join(dir, '001_first.cjs'));
      const { stdout } = await status();
      expect(stdout).toContain('missing\t001_first');
      expect(stdout).toContain('pending\t002_next');
    });

    it('uses custom quoted schema/table names and preserves the history-location guard', async () => {
      await client.query('CREATE SCHEMA "meta""data"');
      await runner({
        ...options(),
        migrationsSchema: 'meta"data',
        migrationsTable: 'his"tory',
        direction: 'up',
        count: 1,
      });
      await expect(status('-t', 'his"tory')).rejects.toThrow(
        'already records migrations'
      );
      const { stdout } = await status(
        '-t',
        'his"tory',
        '--migrations-schema',
        'meta"data'
      );
      expect(stdout).toContain('applied\t001_first');
      expect(stdout).toContain('pending\t002_next');
    });

    it('can inspect using a SELECT-only role and fails clearly without SELECT permission', async () => {
      await runner({ ...options(), direction: 'up', count: 1 });
      await client.query('CREATE ROLE status_reader');
      await client.query('GRANT USAGE ON SCHEMA public TO status_reader');
      await client.query('GRANT SELECT ON pgmigrations TO status_reader');
      await client.query('SET ROLE status_reader');
      try {
        await expect(getMigrationStatus(options())).resolves.toEqual([
          { name: '001_first', status: 'applied' },
          { name: '002_next', status: 'pending' },
        ]);
      } finally {
        await client.query('RESET ROLE');
      }
      await client.query('REVOKE SELECT ON pgmigrations FROM status_reader');
      await client.query('SET ROLE status_reader');
      try {
        await expect(getMigrationStatus(options())).rejects.toThrow(
          'permission denied'
        );
      } finally {
        await client.query('RESET ROLE');
        await client.query('DROP OWNED BY status_reader');
      }
    });

    it('preserves an external transaction and its search_path', async () => {
      await runner({ ...options(), direction: 'up', count: 1 });
      await client.query('BEGIN');
      await client.query('SET LOCAL search_path TO pg_catalog');
      await client.query(
        "INSERT INTO public.pgmigrations (name, run_on) VALUES ('003_external', now())"
      );
      await expect(getMigrationStatus(options())).resolves.toContainEqual({
        name: '003_external',
        status: 'missing',
      });
      const { rows } = await client.query('SHOW search_path');
      expect(rows).toEqual([{ search_path: 'pg_catalog' }]);
      await client.query('ROLLBACK');
      const history = await client.query('SELECT name FROM pgmigrations');
      expect(history.rows).toEqual([{ name: '001_first' }]);
    });

    it('closes its own connection on success and loader failure', async () => {
      const settings = {
        databaseUrl: {
          connectionString: container.getConnectionUri(),
          application_name: 'pgm_status_test',
          options: '-c default_transaction_read_only=on',
        },
        dir,
        migrationsTable: 'pgmigrations',
        logger,
      };
      await getMigrationStatus(settings);
      await writeFile(
        join(dir, '003_broken.cjs'),
        "throw new Error('broken loader');\n"
      );
      await expect(getMigrationStatus(settings)).rejects.toThrow(
        'broken loader'
      );
      const { rows } = await client.query(
        "SELECT 1 FROM pg_stat_activity WHERE application_name = 'pgm_status_test'"
      );
      expect(rows).toEqual([]);
    });

    it('honors glob discovery and ignores without executing migration actions', async () => {
      const { stdout } = await status(
        '--use-glob',
        '-m',
        join(dir, '*.cjs'),
        '--ignore-pattern',
        join(dir, '002*')
      );
      expect(stdout).toContain('pending\t001_first');
      expect(stdout).not.toContain('002_next');
      const { rows } = await client.query(
        "SELECT 1 FROM pg_tables WHERE schemaname = 'public'"
      );
      expect(rows).toEqual([]);
    });

    it('uses grouped SQL identifiers and handles an empty source', async () => {
      await rm(join(dir, '001_first.cjs'));
      await rm(join(dir, '002_next.cjs'));
      expect((await status()).stdout).toContain('No migrations found.');
      await writeFile(
        join(dir, '001_sql.up.sql'),
        'CREATE TABLE grouped (id integer);'
      );
      await writeFile(join(dir, '001_sql.down.sql'), 'DROP TABLE grouped;');
      const settings = {
        ...options(),
        migrationLoaderStrategies: [
          { extensions: ['.sql'], loader: 'sql' as const },
        ],
      };
      await expect(getMigrationStatus(settings)).resolves.toEqual([
        { name: '001_sql', status: 'pending' },
      ]);
      await runner({ ...settings, direction: 'up' });
      await expect(getMigrationStatus(settings)).resolves.toEqual([
        { name: '001_sql', status: 'applied' },
      ]);
    });
  }
);
