import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';
import { generateDumpLike } from '../fixtures/generate';
import type { CliResult } from './utils';
import {
  createDatabase,
  databaseUrl,
  PG_VERSIONS,
  pgDumpShim,
  runCli,
  setupPostgresDatabase,
} from './utils';

// `baseline` runs that the adoption stories don't make: a dump file without
// a connection, and pg_dumps that fail.

/**
 * A real pg_dump output of the Chinook fixture.
 */
const CHINOOK_DUMP = resolve(
  import.meta.dirname,
  '../baseline/fixtures/dumps/pg18/chinook.sql'
);

/**
 * Environment of a CLI run without any database connection.
 */
const NO_CONNECTION: NodeJS.ProcessEnv = {
  DATABASE_URL: undefined,
  PGHOST: undefined,
  PGPORT: undefined,
  PGUSER: undefined,
  PGPASSWORD: undefined,
  PGDATABASE: undefined,
};

/**
 * A frame of a stack trace, as Node.js prints it.
 */
const STACK_FRAME = /^ {4}at /m;

/**
 * Creates a temporary directory that is removed when the current test
 * finishes.
 *
 * @returns The path of the directory.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-e2e-baseline-cli-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * The files of a directory.
 *
 * @param dir The directory.
 *
 * @returns The file names, or none when the directory is missing.
 */
async function filesOf(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

/**
 * Checks that a run was refused with a message for the user: exit code 1 and
 * a message on stderr, without a stack trace.
 *
 * @param result The run.
 * @param fragments What the message must contain.
 */
function expectRefusal(
  result: CliResult,
  fragments: ReadonlyArray<string>
): void {
  expect(result.code, result.stderr).toBe(1);
  for (const fragment of fragments) {
    expect(result.stderr).toContain(fragment);
  }

  expect(result.stderr).not.toMatch(STACK_FRAME);
  expect(result.stderr).not.toContain('BaselineError');
}

describe('baseline without a database', () => {
  it('writes to the migrations directory of the current directory by default', async () => {
    const cwd = await tempDir();

    const result = await runCli(['baseline', '--from-file', CHINOOK_DUMP], {
      cwd,
      env: NO_CONNECTION,
    });

    expect(result.code, result.stderr).toBe(0);
    const files = await filesOf(join(cwd, 'migrations'));
    expect(files).toEqual([expect.stringMatching(/^\d+_baseline\.sql$/)]);
    const name = files[0].slice(0, -'.sql'.length);
    // The same command as with `-m migrations`: no absolute path of this
    // machine, in the output or in the migration.
    const fake = `node-pg-migrate up ${name} --fake`;
    expect(result.stdout).toContain(
      [
        `> Wrote ${join('migrations', files[0])}`,
        '> On databases that already have this schema, record it without running it:',
        `>   ${fake}`,
      ].join('\n')
    );
    const migration = await readFile(join(cwd, 'migrations', files[0]), 'utf8');
    expect(migration).toContain(`--   ${fake}\n`);
    expect(migration).not.toContain(cwd);
  });

  it('warns on stderr when blank databases need more locks than the default', async () => {
    const cwd = await tempDir();
    await writeFile(join(cwd, 'schema.sql'), generateDumpLike(700));

    const result = await runCli(
      ['baseline', '--from-file', 'schema.sql', '-m', 'migrations'],
      { cwd, env: NO_CONNECTION }
    );

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('Warning');
    expect(
      result.stderr.split('\n').filter((line) => line.startsWith('> Warning: '))
    ).toEqual([
      expect.stringContaining('max_locks_per_transaction = 128 or more'),
    ]);
  });

  it('prints an error that is not a refusal as it is', async () => {
    const cwd = await tempDir();

    const result = await runCli(['baseline', '--from-file', 'missing.sql'], {
      cwd,
      env: NO_CONNECTION,
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ENOENT');
    expect(result.stderr).toContain("'missing.sql'");
    expect(await filesOf(join(cwd, 'migrations'))).toEqual([]);
  });

  it('refuses schemas to dump with a dump file', async () => {
    const cwd = await tempDir();

    const result = await runCli(
      ['baseline', '--from-file', CHINOOK_DUMP, '--include-schema', 'public'],
      { cwd, env: NO_CONNECTION }
    );

    expectRefusal(result, ['--include-schema', '--from-file']);
    expect(await filesOf(join(cwd, 'migrations'))).toEqual([]);
  });
});

describe.each(PG_VERSIONS)(
  'baseline with a pg_dump that fails (PG %s)',
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;
    let pgDump: string;
    let databaseCount = 0;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
      pgDump = await pgDumpShim(container);
    });

    afterAll(async () => {
      await container?.stop();
      if (pgDump) {
        await rm(dirname(pgDump), { recursive: true, force: true });
      }
    });

    /**
     * Runs `baseline` against a new database with a pg_dump that reports the
     * version of the real one, then does `lines` instead of dumping.
     *
     * @param lines The shell lines that replace the dump.
     * @param mode The file mode of the pg_dump.
     *
     * @returns The run, its directory and the path of the pg_dump.
     */
    async function baselineWith(
      lines: ReadonlyArray<string>,
      mode = 0o755
    ): Promise<{
      readonly result: CliResult;
      readonly cwd: string;
      readonly bin: string;
    }> {
      databaseCount += 1;
      const database = `failing_${databaseCount}`;
      await createDatabase(container, database);
      const cwd = await tempDir();
      const bin = join(cwd, 'pg_dump');
      await writeFile(
        bin,
        [
          '#!/bin/sh',
          'if [ "$1" = "--version" ]; then',
          `  exec '${pgDump}' --version`,
          'fi',
          ...lines,
          '',
        ].join('\n'),
        { mode }
      );

      const result = await runCli(
        ['baseline', '--pg-dump', bin, '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: databaseUrl(container, database) } }
      );

      return { result, cwd, bin };
    }

    it('prints the first lines pg_dump wrote when it fails', async () => {
      const { result, cwd } = await baselineWith([
        `echo 'pg_dump: error: query failed: ERROR:  permission denied for table widgets' >&2`,
        `echo 'pg_dump: detail: Query was: LOCK TABLE public.widgets IN ACCESS SHARE MODE' >&2`,
        'exit 1',
      ]);

      expectRefusal(result, [
        'pg_dump exited with code 1.',
        'permission denied for table widgets',
      ]);
      expect(result.stderr).not.toContain('--lock-wait-timeout');
      expect(await filesOf(join(cwd, 'migrations'))).toEqual([]);
    });

    it('says which signal stopped pg_dump', async () => {
      const { result, cwd } = await baselineWith(['kill -TERM $$']);

      expectRefusal(result, ['pg_dump was stopped by SIGTERM.']);
      expect(await filesOf(join(cwd, 'migrations'))).toEqual([]);
    });

    it('says when pg_dump cannot be run', async () => {
      const { result, cwd, bin } = await baselineWith([], 0o644);

      expectRefusal(result, [`Could not run ${bin}: `]);
      expect(await filesOf(join(cwd, 'migrations'))).toEqual([]);
    });
  }
);
