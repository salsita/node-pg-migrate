import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';
import { baseline, BaselineError } from '../../../src';
import { adversarialPath, messageOf } from '../../baseline/helpers';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import {
  listFiles,
  pgDumpShimForTest,
  recordingLogger,
  rejectionOf,
  workDir,
} from './helpers';

// baseline only reads the migration history from an ordinary or partitioned
// table. A relation of any other kind with the name of the migrations table is
// refused, without reading it: reading a view runs the code of its definition,
// with the privileges of whoever runs baseline.

/**
 * What {@link TRAP_FUNCTION} says when it runs.
 */
const TRAP_NOTICE = 'baseline_trap executed';

/**
 * A function that announces it ran with a `WARNING` (so it runs no DML, which
 * a read-only transaction would block on its own): if baseline evaluates a
 * relation whose definition calls it, the warning reaches the client as a
 * notice. It stands in for the real exploit (a function that does `COPY TO` a
 * server file), but is safe to run and easy to observe in a test.
 */
const TRAP_FUNCTION = `CREATE FUNCTION public.baseline_trap() RETURNS boolean
  LANGUAGE plpgsql AS $trap$
BEGIN
  RAISE WARNING '${TRAP_NOTICE}';
  RETURN true;
END
$trap$;`;

/**
 * A `public.pgmigrations` view that looks like a migration history with one
 * recorded migration, and runs {@link TRAP_FUNCTION} when it is read.
 */
const TRAP_VIEW = [
  TRAP_FUNCTION,
  `CREATE VIEW public.pgmigrations AS
     SELECT 1 AS id, '1_first'::text AS name, now() AS run_on
     WHERE public.baseline_trap();`,
].join('\n');

/**
 * A valid baseline dump (no migrations table, no data), so the only thing
 * that can refuse it is the database.
 */
const DUMP = adversarialPath('comment-on-extension.sql');

describe.each(PG_VERSIONS)(
  'a migrations relation that is not an ordinary table (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    /**
     * Creates a database and runs a script in it.
     *
     * @param database The name of the database.
     * @param sql The script.
     *
     * @returns The URL of the database.
     */
    async function databaseWith(
      database: string,
      sql: string
    ): Promise<string> {
      await createDatabase(container, database);
      await loadSql(container, database, sql);

      return databaseUrl(container, database);
    }

    /**
     * Connects a client that keeps every notice the server sends it, and
     * closes it when the current test finishes. Call it from inside a test.
     *
     * @param url The database.
     *
     * @returns The client, and the notice messages it got so far.
     */
    async function clientWithNotices(
      url: string
    ): Promise<{ readonly client: pg.Client; readonly notices: string[] }> {
      const client = new pg.Client(url);
      const notices: string[] = [];
      client.on('notice', (notice) => {
        if (notice.message !== undefined) {
          notices.push(notice.message);
        }
      });
      await client.connect();
      onTestFinished(async () => {
        await client.end();
      });

      return { client, notices };
    }

    it('refuses a pgmigrations view with --format ts without running its definition', async () => {
      const url = await databaseWith('view_ts', TRAP_VIEW);
      const { client, notices } = await clientWithNotices(url);
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          dbClient: client,
          format: 'ts',
          dir,
          logger: recordingLogger(),
        })
      );

      // The view's function never ran: baseline did not read the relation.
      expect(notices).not.toContain(TRAP_NOTICE);
      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_MIGRATIONS_TABLE' });
      expect(messageOf(error)).toContain('pgmigrations');
      expect(messageOf(error)).toMatch(/view/i);
      expect(await listFiles(dir)).toEqual([]);
    });

    it('refuses a pgmigrations view with a dump file and a connection without running its definition', async () => {
      const url = await databaseWith('view_from_file', TRAP_VIEW);
      const { client, notices } = await clientWithNotices(url);
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          dbClient: client,
          fromFile: DUMP,
          dir,
          logger: recordingLogger(),
        })
      );

      expect(notices).not.toContain(TRAP_NOTICE);
      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_MIGRATIONS_TABLE' });
      expect(messageOf(error)).toContain('pgmigrations');
      expect(messageOf(error)).toMatch(/view/i);
      expect(await listFiles(dir)).toEqual([]);
    });

    it('refuses a pgmigrations view when it would run pg_dump', async () => {
      const url = await databaseWith('view_pg_dump', TRAP_VIEW);
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: url,
          pgDump: await pgDumpShimForTest(container),
          dir,
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_MIGRATIONS_TABLE' });
      expect(messageOf(error)).toContain('pgmigrations');
      expect(messageOf(error)).toMatch(/view/i);
      expect(await listFiles(dir)).toEqual([]);
    });

    it('refuses a materialized view in the configured migrations schema and table', async () => {
      const url = await databaseWith(
        'matview',
        [
          'CREATE SCHEMA audit;',
          `CREATE MATERIALIZED VIEW audit.applied_steps AS
             SELECT 1 AS id, '1_first'::text AS name, now() AS run_on;`,
        ].join('\n')
      );
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: url,
          format: 'ts',
          migrationsSchema: 'audit',
          migrationsTable: 'applied_steps',
          dir,
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_MIGRATIONS_TABLE' });
      expect(messageOf(error)).toContain('applied_steps');
      expect(messageOf(error)).toMatch(/materialized/i);
      expect(await listFiles(dir)).toEqual([]);
    });

    it('refuses a pgmigrations foreign table instead of reading it', async () => {
      // Reading this foreign table would run a program on the server.
      const url = await databaseWith(
        'foreign_table',
        [
          'CREATE EXTENSION file_fdw;',
          'CREATE SERVER baseline_files FOREIGN DATA WRAPPER file_fdw;',
          `CREATE FOREIGN TABLE public.pgmigrations (
             id integer, name text, run_on timestamp
           ) SERVER baseline_files OPTIONS (program 'true', format 'csv');`,
        ].join('\n')
      );
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: url,
          format: 'ts',
          dir,
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_MIGRATIONS_TABLE' });
      expect(messageOf(error)).toContain('pgmigrations');
      expect(messageOf(error)).toMatch(/foreign/i);
      expect(await listFiles(dir)).toEqual([]);
    });

    it('reads the history of a partitioned pgmigrations table like an ordinary one', async () => {
      const url = await databaseWith(
        'partitioned',
        [
          `CREATE TABLE public.pgmigrations (
             id serial, name varchar(255) NOT NULL, run_on timestamp NOT NULL
           ) PARTITION BY RANGE (run_on);`,
          'CREATE TABLE public.pgmigrations_all PARTITION OF public.pgmigrations DEFAULT;',
          "INSERT INTO public.pgmigrations (name, run_on) VALUES ('1_first', now());",
        ].join('\n')
      );
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: url,
          format: 'ts',
          dir,
          logger: recordingLogger(),
        })
      );

      // Not INVALID_MIGRATIONS_TABLE: the recorded migration was counted.
      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'HISTORY_EXISTS' });
      expect(await listFiles(dir)).toEqual([]);
    });
  }
);
