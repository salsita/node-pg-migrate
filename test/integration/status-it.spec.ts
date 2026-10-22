import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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

    function statusWithEnv(env: NodeJS.ProcessEnv, ...args: string[]) {
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
            ...env,
          },
          timeout: INTEGRATION_TIMEOUT,
        }
      );
    }

    function status(...args: string[]) {
      return statusWithEnv({}, ...args);
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
      expect(stdout).toContain('pending  001_first');
      expect(stdout).toContain('pending  002_next');
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
      expect(stdout).toContain('applied  001_first');
      expect(stdout).toContain('pending  002_next');
      expect(stdout).not.toContain('Migrations complete');
      expect(await snapshot()).toEqual(before);
    });

    it('reports recorded migrations whose files have been removed', async () => {
      await runner({ ...options(), direction: 'up', count: 1 });
      await rm(join(dir, '001_first.cjs'));
      const { stdout } = await status();
      expect(stdout).toContain('missing  001_first');
      expect(stdout).toContain('pending  002_next');
    });

    it('returns recorded dates in JSON for missing migrations and omits dates for pending ones', async () => {
      await runner({ ...options(), direction: 'up', count: 1 });
      const {
        rows: [{ epoch }],
      } = await client.query<{ epoch: string }>(
        "SELECT extract(epoch FROM run_on AT TIME ZONE current_setting('TimeZone')) AS epoch FROM pgmigrations"
      );
      const runOn = new Date(Number(epoch) * 1000);
      await rm(join(dir, '001_first.cjs'));
      const { stdout } = await status('--json');
      expect(JSON.parse(stdout)).toEqual([
        { name: '001_first', status: 'missing', runOn: runOn.toISOString() },
        { name: '002_next', status: 'pending' },
      ]);
      await expect(getMigrationStatus(options())).resolves.toEqual([
        { name: '001_first', status: 'missing', runOn },
        { name: '002_next', status: 'pending' },
      ]);
    });

    it.each([
      { oids: [1184] },
      { oids: [1184, 1114, 1700, 701, 20, 25, 1043] },
    ])(
      'returns Dates independently of global parsers $oids',
      async ({ oids }) => {
        await runner({ ...options(), direction: 'up', fake: true });
        await client.query('BEGIN');
        await client.query("SET LOCAL TIME ZONE 'UTC'");
        await client.query(
          "UPDATE pgmigrations SET run_on = TIMESTAMP '2026-10-22 12:34:56.789999'"
        );
        await rm(join(dir, '002_next.cjs'));
        const parsers = oids.map((oid) => ({
          oid,
          parser: pg.types.getTypeParser(oid),
        }));
        try {
          for (const { oid } of parsers) {
            pg.types.setTypeParser(oid, (value) =>
              oid === 1184 ? value : 'overridden'
            );
          }
          const migrations = await getMigrationStatus(options());
          expect(migrations).toEqual([
            {
              name: '001_first',
              status: 'applied',
              runOn: new Date('2026-10-22T12:34:56.789Z'),
            },
            {
              name: '002_next',
              status: 'missing',
              runOn: new Date('2026-10-22T12:34:56.789Z'),
            },
          ]);
          expect(migrations[0].runOn).toBeInstanceOf(Date);
        } finally {
          for (const { oid, parser } of parsers) {
            pg.types.setTypeParser(oid, parser);
          }
          await client.query('ROLLBACK');
        }
      }
    );

    it.each([false, true])(
      'prints status despite global parsers registered before the CLI starts (JSON: %s)',
      async (json) => {
        await runner({ ...options(), direction: 'up', count: 1 });
        await client.query(
          "UPDATE pgmigrations SET run_on = TIMESTAMP '2026-10-22 12:34:56.789999'"
        );
        const preloadDir = await mkdtemp(join(tmpdir(), 'pgm-status-parser-'));
        const preload = join(preloadDir, 'parser.mjs');
        const pgPath = createRequire(import.meta.url).resolve('pg');
        await writeFile(
          preload,
          `import pg from ${JSON.stringify(pathToFileURL(pgPath).href)};
const oids = [1184, 1114, 1700, 701, 20, 25, 1043];
const parsers = oids.map(oid => [oid, pg.types.getTypeParser(oid)]);
for (const oid of oids) pg.types.setTypeParser(oid, value => oid === 1184 ? value : 'overridden');
process.on('exit', () => { for (const [oid, parser] of parsers) pg.types.setTypeParser(oid, parser); });
`
        );
        try {
          const { stdout } = await statusWithEnv(
            {
              NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
              PGOPTIONS: '-c TimeZone=UTC',
            },
            ...(json ? ['--json'] : [])
          );
          expect(stdout).toBe(
            json
              ? `${JSON.stringify([
                  {
                    name: '001_first',
                    status: 'applied',
                    runOn: '2026-10-22T12:34:56.789Z',
                  },
                  { name: '002_next', status: 'pending' },
                ])}\n`
              : 'Status   Migration  Run on\napplied  001_first  2026-10-22T12:34:56.789Z\npending  002_next\n'
          );
        } finally {
          await rm(preloadDir, { recursive: true, force: true });
        }
      }
    );

    it.each(['pending', 'missing'] as const)(
      'returns exit code 2 only when requested for %s migrations',
      async (state) => {
        if (state === 'missing') {
          await runner({ ...options(), direction: 'up', count: 1 });
          await rm(join(dir, '001_first.cjs'));
          await rm(join(dir, '002_next.cjs'));
        }
        expect((await status()).stdout).toContain(`${state}  `);
        await expect(status('--exit-code')).rejects.toMatchObject({
          code: 2,
          stdout: expect.stringContaining(`${state}  `),
        });
      }
    );

    it('keeps JSON parseable and the status exit code with --force-exit', async () => {
      await expect(
        status('--json', '--exit-code', '--force-exit')
      ).rejects.toMatchObject({
        code: 2,
        stdout: `${JSON.stringify([
          { name: '001_first', status: 'pending' },
          { name: '002_next', status: 'pending' },
        ])}\n`,
      });
    });

    it.each(['extra', '--unknown-option'])(
      'returns exit code 1 without stdout for a usage error: %s',
      async (argument) => {
        await expect(
          status('--json', '--exit-code', argument)
        ).rejects.toMatchObject({
          code: 1,
          stdout: '',
          stderr: expect.stringContaining('error:'),
        });
      }
    );

    it('returns exit code 1 without stdout for a connection failure', async () => {
      const databaseUrl = new URL(container.getConnectionUri());
      databaseUrl.password = 'wrong-password';
      await expect(
        statusWithEnv(
          { DATABASE_URL: databaseUrl.href },
          '--json',
          '--exit-code'
        )
      ).rejects.toMatchObject({
        code: 1,
        stdout: '',
        stderr: expect.stringContaining('password authentication failed'),
      });
    });

    it('returns exit code 1 without stdout for a loader failure', async () => {
      await writeFile(
        join(dir, '003_broken.cjs'),
        "throw new Error('broken loader');\n"
      );
      await expect(status('--json', '--exit-code')).rejects.toMatchObject({
        code: 1,
        stdout: '',
        stderr: expect.stringContaining('broken loader'),
      });
    });

    it('succeeds with --exit-code when all migrations are applied and includes their dates', async () => {
      await runner({ ...options(), direction: 'up', fake: true });
      const { rows } = await client.query<{ name: string; epoch: string }>(
        "SELECT name, extract(epoch FROM run_on AT TIME ZONE current_setting('TimeZone')) AS epoch FROM pgmigrations ORDER BY run_on, id"
      );
      const { stdout } = await status('--json', '--exit-code');
      expect(JSON.parse(stdout)).toEqual(
        rows.map(({ name, epoch }) => ({
          name,
          status: 'applied',
          runOn: new Date(Number(epoch) * 1000).toISOString(),
        }))
      );
      const table = await status('--exit-code');
      expect(table.stdout).toContain(
        `applied  001_first  ${new Date(Number(rows[0].epoch) * 1000).toISOString()}`
      );
    });

    it.each([
      ['UTC', '2026-07-14 12:34:56.789'],
      ['Asia/Kolkata', '2026-07-14 18:04:56.789'],
    ])(
      'preserves the recorded instant across Node time zones with database TimeZone %s',
      async (databaseTimeZone, wallTime) => {
        await runner({ ...options(), direction: 'up', fake: true });
        await client.query('UPDATE pgmigrations SET run_on = $1::timestamp', [
          wallTime,
        ]);
        await rm(join(dir, '002_next.cjs'));
        await writeFile(
          join(dir, '003_pending.cjs'),
          'exports.up = () => {};\n'
        );

        // Fixed wall times above represent this instant, independent of pg's parser.
        const iso = '2026-07-14T12:34:56.789Z';
        const expected = [
          { name: '001_first', status: 'applied', runOn: iso },
          { name: '002_next', status: 'missing', runOn: iso },
          { name: '003_pending', status: 'pending' },
        ];
        const { rows: original } = await client.query<{ TimeZone: string }>(
          'SHOW TimeZone'
        );
        await client.query("SELECT set_config('TimeZone', $1, false)", [
          databaseTimeZone,
        ]);
        try {
          await expect(getMigrationStatus(options())).resolves.toEqual([
            { name: '001_first', status: 'applied', runOn: new Date(iso) },
            { name: '002_next', status: 'missing', runOn: new Date(iso) },
            { name: '003_pending', status: 'pending' },
          ]);
          const { rows } = await client.query('SHOW TimeZone');
          expect(rows).toEqual([{ TimeZone: databaseTimeZone }]);
        } finally {
          await client.query("SELECT set_config('TimeZone', $1, false)", [
            original[0].TimeZone,
          ]);
        }

        for (const TZ of ['Europe/Berlin', 'America/Sao_Paulo']) {
          const env = { TZ, PGOPTIONS: `-c TimeZone=${databaseTimeZone}` };
          const json = await statusWithEnv(env, '--json');
          expect(JSON.parse(json.stdout)).toEqual(expected);
          const table = await statusWithEnv(env);
          expect(table.stdout).toContain(`applied  001_first    ${iso}`);
          expect(table.stdout).toContain(`missing  002_next     ${iso}`);
          expect(table.stdout).toContain('pending  003_pending\n');
        }
      }
    );

    it('uses custom quoted schema/table names and preserves the history-location guard', async () => {
      await client.query('CREATE SCHEMA "meta""data"');
      await runner({
        ...options(),
        migrationsSchema: 'meta"data',
        migrationsTable: 'his"tory',
        direction: 'up',
        count: 1,
      });
      await expect(
        status('-t', 'his"tory', '--json', '--exit-code')
      ).rejects.toMatchObject({
        code: 1,
        stdout: '',
        stderr: expect.stringContaining('Cannot determine status:'),
      });
      const { stdout } = await status(
        '-t',
        'his"tory',
        '--migrations-schema',
        'meta"data'
      );
      expect(stdout).toContain('applied  001_first');
      expect(stdout).toContain('pending  002_next');
    });

    it('can inspect using a SELECT-only role and fails clearly without SELECT permission', async () => {
      await runner({ ...options(), direction: 'up', count: 1 });
      await client.query('CREATE ROLE status_reader');
      await client.query('GRANT USAGE ON SCHEMA public TO status_reader');
      await client.query('GRANT SELECT ON pgmigrations TO status_reader');
      await client.query('SET ROLE status_reader');
      try {
        await expect(getMigrationStatus(options())).resolves.toEqual([
          { name: '001_first', status: 'applied', runOn: expect.any(Date) },
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
        runOn: expect.any(Date),
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
      expect(stdout).toContain('pending  001_first');
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
      expect((await status('--json', '--exit-code')).stdout).toBe('[]\n');
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
        { name: '001_sql', status: 'applied', runOn: expect.any(Date) },
      ]);
    });
  }
);
