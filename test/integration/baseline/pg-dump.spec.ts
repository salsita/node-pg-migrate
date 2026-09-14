import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseline, BaselineError } from '../../../src';
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
  migrateUp,
  pgDumpShimForTest,
  queryRows,
  recordingLogger,
  rejectionOf,
  serverVersion,
  workDir,
} from './helpers';

/**
 * A table to dump, so that every database has something in its baseline.
 */
const WIDGETS =
  'CREATE TABLE public.widgets (id integer PRIMARY KEY, name text NOT NULL);';

/**
 * The login role of the credentials test.
 */
const DUMP_USER = 'baseline_dumper';

/**
 * Its password, with characters that URLs percent-encode and shells split
 * at. `w0rd` appears nowhere else.
 */
const DUMP_PASSWORD = 'S3cret w0rd:/?#@%&=+';

/**
 * One call of a {@link recordingShim}.
 */
interface RecordedCall {
  /**
   * The arguments.
   */
  readonly argv: string[];

  /**
   * `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE`, in this
   * order (empty when unset).
   */
  readonly env: string[];
}

/**
 * A pg_dump shim that records its calls.
 */
interface RecordingShim {
  /**
   * The path of the shim.
   */
  readonly bin: string;

  /**
   * Reads the calls made so far, in no particular order.
   */
  readonly calls: () => Promise<RecordedCall[]>;
}

/**
 * Quotes a value for a POSIX shell.
 *
 * @param value The value.
 *
 * @returns The value in single quotes.
 */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`;
}

/**
 * Splits a text into its lines.
 *
 * @param text The text, with a newline at the end of every line.
 *
 * @returns The lines, without their newlines.
 */
function linesOf(text: string): string[] {
  return text.endsWith('\n') ? text.slice(0, -1).split('\n') : [];
}

/**
 * Writes a pg_dump shim that records each call, then runs `target` with the
 * same arguments.
 *
 * @param dir Where to write the shim and the records.
 * @param target The pg_dump to run, e.g. from `pgDumpShimForTest()`.
 *
 * @returns The shim.
 */
async function recordingShim(
  dir: string,
  target: string
): Promise<RecordingShim> {
  const logDir = join(dir, 'calls');
  await mkdir(logDir);
  const bin = join(dir, 'pg_dump');
  await writeFile(
    bin,
    [
      '#!/bin/sh',
      `log="$(mktemp ${shellQuote(join(logDir, 'call.XXXXXX'))})"`,
      `printf '%s\\n' "$@" > "$log"`,
      `printf '%s\\n' "$PGHOST" "$PGPORT" "$PGUSER" "$PGPASSWORD" "$PGDATABASE" > "$log.env"`,
      `exec ${shellQuote(target)} "$@"`,
      '',
    ].join('\n'),
    { mode: 0o755 }
  );

  return {
    bin,
    calls: async () => {
      const files = (await readdir(logDir)).filter(
        (file) => !file.endsWith('.env')
      );

      return Promise.all(
        files.map(async (file) => ({
          argv: linesOf(await readFile(join(logDir, file), 'utf8')),
          env: linesOf(await readFile(join(logDir, `${file}.env`), 'utf8')),
        }))
      );
    },
  };
}

describe.each(PG_VERSIONS)(
  'baseline() running pg_dump (PG %s)',
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
     * Creates a database with the widgets table.
     *
     * @param name The name of the new database.
     *
     * @returns Its connection URL.
     */
    async function widgetsDatabase(name: string): Promise<string> {
      await createDatabase(container, name);
      await loadSql(container, name, WIDGETS);

      return databaseUrl(container, name);
    }

    it('gives pg_dump the credentials in its environment, never in its arguments', async () => {
      await widgetsDatabase('credentials');
      await loadSql(
        container,
        container.getDatabase(),
        `CREATE ROLE ${DUMP_USER} LOGIN SUPERUSER PASSWORD '${DUMP_PASSWORD}';`
      );
      const work = await workDir();
      const shim = await recordingShim(
        work,
        await pgDumpShimForTest(container)
      );
      const dir = join(work, 'migrations');

      const result = await baseline({
        databaseUrl: `postgres://${DUMP_USER}:${encodeURIComponent(DUMP_PASSWORD)}@${container.getHost()}:${container.getPort()}/credentials`,
        dir,
        pgDump: shim.bin,
        logger: recordingLogger(),
      });

      expect(await readFile(result.path, 'utf8')).toContain(
        'CREATE TABLE public.widgets'
      );
      const calls = await shim.calls();
      expect(calls.map(({ argv }) => argv)).toContainEqual(['--version']);
      const dumps = calls.filter(({ argv }) => argv.includes('--schema-only'));
      expect(dumps).toHaveLength(1);
      expect(dumps[0].argv).toEqual(
        expect.arrayContaining([
          '--lock-wait-timeout=10s',
          '--exclude-table="public"."pgmigrations"',
          '--exclude-table="public"."pgmigrations_id_seq"',
        ])
      );
      expect(dumps[0].env).toEqual([
        container.getHost(),
        String(container.getPort()),
        DUMP_USER,
        DUMP_PASSWORD,
        'credentials',
      ]);
      expect(
        calls.flatMap(({ argv }) => argv).filter((arg) => arg.includes('w0rd'))
      ).toEqual([]);
    });

    it('leaves the migrations table and the sequence it really uses out of the dump', async () => {
      const url = await widgetsDatabase('renamed_history');
      // A renamed table keeps the name of its serial sequence.
      await loadSql(
        container,
        'renamed_history',
        [
          'CREATE TABLE public.old_history (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL);',
          'ALTER TABLE public.old_history RENAME TO "Schema History";',
        ].join('\n')
      );
      const dir = join(await workDir(), 'migrations');

      const result = await baseline({
        databaseUrl: url,
        dir,
        pgDump: await pgDumpShimForTest(container),
        migrationsTable: 'Schema History',
        logger: recordingLogger(),
      });

      const sql = await readFile(result.path, 'utf8');
      // The header's `--fake` command names the table; the dump after it must not.
      const header = sql.slice(0, sql.indexOf('\n\n'));
      const dump = sql.slice(header.length);
      expect(header).toContain("-t 'Schema History'");
      expect(dump).toContain('CREATE TABLE public.widgets');
      expect(dump).not.toContain('Schema History');
      expect(dump).not.toContain('old_history');

      await createDatabase(container, 'renamed_history_rebuilt');
      const ran = await migrateUp(
        databaseUrl(container, 'renamed_history_rebuilt'),
        dir,
        { migrationsTable: 'Schema History' }
      );
      expect(ran.map(({ name }) => name)).toEqual([result.migrationName]);
      expect(
        await queryRows(
          container,
          'renamed_history_rebuilt',
          "SELECT to_regclass('public.widgets') IS NOT NULL"
        )
      ).toEqual(['t']);
    });

    it('refuses a pg_dump older than the server (PG_DUMP_TOO_OLD)', async () => {
      const url = await widgetsDatabase('too_old');
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: url,
          dir,
          pgDump: await pgDumpShimForTest(container, { reportVersion: '13.0' }),
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      const { code, message } = error as BaselineError;
      expect(code).toBe('PG_DUMP_TOO_OLD');
      expect(message).toContain('13.0');
      expect(message).toContain(await serverVersion(container));
      expect(await listFiles(dir)).toEqual([]);
    });

    it('refuses a pg_dump that does not exist (PG_DUMP_NOT_FOUND)', async () => {
      const url = await widgetsDatabase('not_found');
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: url,
          dir,
          pgDump: '/does/not/exist',
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      const { code, message } = error as BaselineError;
      expect(code).toBe('PG_DUMP_NOT_FOUND');
      expect(message).toContain('/does/not/exist');
      expect(message).toContain('--pg-dump');
      expect(message).toContain('--from-file');
      expect(await listFiles(dir)).toEqual([]);
    });

    it('fails after lockWaitTimeout when another session holds a lock pg_dump needs (PG_DUMP_FAILED)', async () => {
      const url = await widgetsDatabase('locked');
      const work = await workDir();
      const shim = await recordingShim(
        work,
        await pgDumpShimForTest(container)
      );
      const dir = join(work, 'migrations');
      const holder = new pg.Client(url);
      await holder.connect();
      try {
        await holder.query('BEGIN');
        await holder.query(
          'LOCK TABLE public.widgets IN ACCESS EXCLUSIVE MODE'
        );

        const error = await rejectionOf(
          baseline({
            databaseUrl: url,
            dir,
            pgDump: shim.bin,
            lockWaitTimeout: '1s',
            logger: recordingLogger(),
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        const { code, message } = error as BaselineError;
        expect(code).toBe('PG_DUMP_FAILED');
        expect(message).toMatch(/lock/i);
        expect(message).toContain('--lock-wait-timeout');
        // pg_dump waited for the 1 s lockWaitTimeout, not the default of 10 s.
        const dumps = (await shim.calls()).filter(({ argv }) =>
          argv.includes('--schema-only')
        );
        expect(dumps).toHaveLength(1);
        expect(
          dumps[0].argv.filter((arg) => arg.startsWith('--lock-wait-timeout'))
        ).toEqual(['--lock-wait-timeout=1s']);
        expect(await listFiles(dir)).toEqual([]);
      } finally {
        await holder.query('ROLLBACK');
        await holder.end();
      }
    });
  }
);
