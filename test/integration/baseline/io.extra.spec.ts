import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
import type { ClientBase } from 'pg';
import { describe, expect, it, onTestFinished } from 'vitest';
import { baseline, BaselineError } from '../../../src';
import { getPgDumpVersion, runPgDump } from '../../../src/baseline/io/pgDump';
import { readDumpFile } from '../../../src/baseline/io/readDump';
import { planBaselineFile } from '../../../src/baseline/io/writeBaseline';
import { listFiles, recordingLogger, rejectionOf, workDir } from './helpers';

// The I/O paths of baseline that a real server and pg_dump don't take: they
// run pg_dump stand-ins, streams and a CockroachDB client instead.

/**
 * What pg_dump 18 prints when `--lock-wait-timeout` expired.
 */
const LOCK_WAIT_TIMEOUT_STDERR = [
  'pg_dump: error: query failed: ERROR:  canceling statement due to statement timeout',
  'pg_dump: detail: Query was: LOCK TABLE public.widgets IN ACCESS SHARE MODE',
];

/**
 * The start of a dump that pg_dump wrote in LATIN1: `é` is the byte 0xE9,
 * which is not UTF-8.
 */
const LATIN1_DUMP = Buffer.from(
  "SET client_encoding = 'LATIN1';\nCOMMENT ON SCHEMA public IS 'café';\n",
  'latin1'
);

/**
 * A small plain-text dump.
 */
const SMALL_DUMP = 'CREATE TABLE public.t (id integer);\n';

/**
 * Whether the tests run as root, who can read a file whatever its mode.
 */
const RUNS_AS_ROOT = process.getuid?.() === 0;

/**
 * Writes an executable shell script.
 *
 * @param dir The directory to write it to.
 * @param name Its file name.
 * @param lines Its lines after `#!/bin/sh`.
 *
 * @returns Its path.
 */
async function script(
  dir: string,
  name: string,
  lines: ReadonlyArray<string>
): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, ['#!/bin/sh', ...lines, ''].join('\n'), {
    mode: 0o755,
  });

  return path;
}

/**
 * Writes a pg_dump stand-in that prints `lines` to its standard error and
 * exits with `code`.
 *
 * @param dir The directory to write it to.
 * @param lines What it prints to its standard error.
 * @param code Its exit code.
 *
 * @returns Its path.
 */
function failingPgDump(
  dir: string,
  lines: ReadonlyArray<string>,
  code = 1
): Promise<string> {
  return script(dir, 'pg_dump', [
    ...lines.map(
      (line) => `printf '%s\\n' '${line.replaceAll("'", String.raw`'\''`)}' >&2`
    ),
    `exit ${code}`,
  ]);
}

describe('baseline I/O without a server', () => {
  it('reads a dump from standard input', async () => {
    const stdin = new PassThrough();
    stdin.end('CREATE TABLE public.t (id integer);\n');

    await expect(readDumpFile('-', stdin)).resolves.toBe(
      'CREATE TABLE public.t (id integer);\n'
    );
  });

  it('leaves out a byte order mark', async () => {
    const dir = await workDir();
    const path = join(dir, 'dump.sql');
    await writeFile(path, '\uFEFFCREATE TABLE public.t (id integer);\n');
    const stdin = new PassThrough();
    stdin.end(Buffer.from('\uFEFFSELECT 1;\n', 'utf8'));

    await expect(readDumpFile(path)).resolves.toBe(
      'CREATE TABLE public.t (id integer);\n'
    );
    await expect(readDumpFile('-', stdin)).resolves.toBe('SELECT 1;\n');
  });

  it.each([
    {
      problem: 'does not exist',
      path: (dir: string): Promise<string> =>
        Promise.resolve(join(dir, 'schema.sq')),
    },
    {
      problem: 'is a directory',
      path: async (dir: string): Promise<string> => {
        await mkdir(join(dir, 'dumps'));

        return join(dir, 'dumps');
      },
    },
    // Root reads a file whatever its mode.
    ...(RUNS_AS_ROOT
      ? []
      : [
          {
            problem: 'cannot be read',
            path: async (dir: string): Promise<string> => {
              const path = join(dir, 'schema.sql');
              await writeFile(path, SMALL_DUMP, { mode: 0o000 });

              return path;
            },
          },
        ]),
  ])(
    'refuses a dump file that $problem, saying which (INVALID_OPTIONS)',
    async ({ path }) => {
      const file = await path(await workDir());

      const error = await rejectionOf(readDumpFile(file));

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
      expect((error as BaselineError).message).toContain(
        `Could not read the dump ${file}`
      );
    }
  );

  it('reads a dump from a named pipe, like the /dev/fd/N path of a process substitution', async () => {
    const path = join(await workDir(), 'dump.fifo');
    execFileSync('mkfifo', [path]);

    const reading = readDumpFile(path);
    // Opening the pipe for writing waits for its reader.
    const writer = spawn(
      'sh',
      ['-c', 'printf "%s" "$1" > "$2"', 'sh', SMALL_DUMP, path],
      { stdio: 'ignore' }
    );
    onTestFinished(() => {
      writer.kill();
    });

    await expect(reading).resolves.toBe(SMALL_DUMP);
  });

  it('refuses a missing --from-file path with a BaselineError (INVALID_OPTIONS), and writes nothing', async () => {
    const work = await workDir();
    const fromFile = join(work, 'schema.sq');
    const dir = join(work, 'migrations');

    const error = await rejectionOf(
      baseline({ fromFile, dir, logger: recordingLogger() })
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    expect((error as BaselineError).message).toContain(
      `Could not read the dump ${fromFile}`
    );
    expect(await listFiles(dir)).toEqual([]);
  });

  it.each([
    { name: 'a compressed dump', bytes: gzipSync(SMALL_DUMP) },
    {
      name: 'a dump saved as UTF-16',
      bytes: Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(SMALL_DUMP, 'utf16le'),
      ]),
    },
  ])(
    'still refuses $name as binary (BINARY_DUMP), not as text that is not UTF-8',
    async ({ bytes }) => {
      const work = await workDir();
      const fromFile = join(work, 'schema.sql');
      await writeFile(fromFile, bytes);
      const dir = join(work, 'migrations');

      const error = await rejectionOf(
        baseline({ fromFile, dir, logger: recordingLogger() })
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'BINARY_DUMP' });
      expect(await listFiles(dir)).toEqual([]);
    }
  );

  it('refuses a dump file that is not UTF-8 instead of replacing its characters (NOT_UTF8)', async () => {
    const path = join(await workDir(), 'latin1.sql');
    await writeFile(path, LATIN1_DUMP);

    const error = await rejectionOf(readDumpFile(path));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'NOT_UTF8' });
    const { message } = error as BaselineError;
    expect(message).toContain('UTF-8');
    expect(message).toContain('--encoding=UTF8');
  });

  it('refuses a dump on standard input that is not UTF-8 (NOT_UTF8)', async () => {
    const stdin = new PassThrough();
    stdin.end(LATIN1_DUMP);

    const error = await rejectionOf(readDumpFile('-', stdin));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'NOT_UTF8' });
    const { message } = error as BaselineError;
    expect(message).toContain('UTF-8');
    expect(message).toContain('--encoding=UTF8');
  });

  it('prefixes the migration with a timestamp by default', async () => {
    const dir = await workDir();

    await expect(planBaselineFile({ dir, name: 'baseline' })).resolves.toEqual({
      migrationName: expect.stringMatching(/^\d{13}_baseline$/),
      path: expect.stringMatching(/\d{13}_baseline\.sql$/),
    });
  });

  it('counts a subdirectory as a file of the migrations directory', async () => {
    const dir = await workDir();
    await mkdir(join(dir, '2024'));

    const error = await rejectionOf(
      planBaselineFile({ dir, name: 'baseline' })
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'MIGRATIONS_EXIST' });
    expect((error as BaselineError).message).toContain(
      'already has 1 file(s), starting with 2024'
    );
  });

  it('reads the version of pg_dump', async () => {
    const pgDump = await script(await workDir(), 'pg_dump', [
      'if [ "$1" = "--version" ]; then',
      "  echo 'pg_dump (PostgreSQL) 17.2 (Debian 17.2-1.pgdg120+1)'",
      'fi',
    ]);

    await expect(getPgDumpVersion(pgDump, {})).resolves.toEqual({
      major: 17,
      minor: 2,
      raw: '17.2 (Debian 17.2-1.pgdg120+1)',
    });
  });

  it('says when pg_dump --version fails', async () => {
    const pgDump = await failingPgDump(
      await workDir(),
      ['pg_dump: error: something is off'],
      2
    );

    const error = await rejectionOf(getPgDumpVersion(pgDump, {}));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
    expect((error as BaselineError).message).toBe(
      `${pgDump} --version exited with code 2.\npg_dump: error: something is off`
    );
  });

  it('refuses a pg_dump that prints something else than its version', async () => {
    const pgDump = await script(await workDir(), 'pg_dump', [
      "echo 'psql (PostgreSQL) 18.6'",
    ]);

    const error = await rejectionOf(getPgDumpVersion(pgDump, {}));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
    const { message } = error as BaselineError;
    expect(message.startsWith(`${pgDump}: `)).toBe(true);
    expect(message).toContain('psql (PostgreSQL) 18.6');
  });

  it('says when pg_dump cannot be run', async () => {
    const dir = await workDir();
    const pgDump = join(dir, 'pg_dump');
    await writeFile(pgDump, '#!/bin/sh\n', { mode: 0o644 });

    const error = await rejectionOf(getPgDumpVersion(pgDump, {}));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
    expect((error as BaselineError).message).toContain(
      `Could not run ${pgDump}: `
    );
    expect((error as BaselineError).cause).toMatchObject({ code: 'EACCES' });
  });

  it('says what to do when pg_dump is missing', async () => {
    const pgDump = join(await workDir(), 'missing', 'pg_dump');

    const error = await rejectionOf(getPgDumpVersion(pgDump, {}));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_NOT_FOUND' });
    const { message } = error as BaselineError;
    expect(message).toContain(pgDump);
    expect(message).toContain('--pg-dump');
    expect(message).toContain('--from-file');
  });

  it('runs pg_dump with the arguments and the environment it is given, and returns its output', async () => {
    const dir = await workDir();
    const pgDump = await script(dir, 'pg_dump', [
      `printf '%s\\n' "$@"`,
      `printf '%s|%s|%s\\n' "$PGUSER" "$PGPASSWORD" "$PGSSLMODE"`,
      // Big enough to arrive in many chunks, with a multi-byte character
      // split across some of them.
      'i=0',
      'while [ "$i" -lt 20000 ]; do',
      `  printf '%s\\n' '-- Área 😀 padding padding padding padding'`,
      '  i=$((i + 1))',
      'done',
    ]);

    const output = await runPgDump(
      pgDump,
      ['--schema-only', '--exclude-table="public"."a b"'],
      { PGUSER: 'app', PGPASSWORD: 'S3cret w0rd', PGSSLMODE: 'require' }
    );
    const lines = output.split('\n');

    expect(lines.slice(0, 3)).toEqual([
      '--schema-only',
      '--exclude-table="public"."a b"',
      'app|S3cret w0rd|require',
    ]);
    expect(lines.slice(3, -1)).toHaveLength(20_000);
    expect(
      lines
        .slice(3, -1)
        .every((line) => line === '-- Área 😀 padding padding padding padding')
    ).toBe(true);
  });

  it('keeps the environment variables it does not set', async () => {
    const pgDump = await script(await workDir(), 'pg_dump', [
      `printf '%s' "$HOME"`,
    ]);

    await expect(runPgDump(pgDump, [], {})).resolves.toBe(process.env.HOME);
  });

  it('refuses pg_dump output that is not UTF-8 instead of replacing its characters (NOT_UTF8)', async () => {
    // What pg_dump prints for a LATIN1 database when it writes LATIN1.
    const pgDump = await script(await workDir(), 'pg_dump', [
      String.raw`printf "SET client_encoding = 'LATIN1';\nCOMMENT ON SCHEMA public IS 'caf\351';\n"`,
    ]);

    const error = await rejectionOf(runPgDump(pgDump, ['--schema-only'], {}));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'NOT_UTF8' });
    expect((error as BaselineError).message).toContain('UTF-8');
  });

  it('quotes the first lines pg_dump printed when it fails', async () => {
    const stderr = [
      'pg_dump: error: connection to server at "db" (10.0.0.1), port 5432 failed: FATAL:  password authentication failed for user "app"',
      'line 2',
      'line 3',
      'line 4',
      'line 5',
      'line 6',
    ];
    const pgDump = await failingPgDump(await workDir(), stderr);

    const error = await rejectionOf(runPgDump(pgDump, ['--schema-only'], {}));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
    expect((error as BaselineError).message).toBe(
      ['pg_dump exited with code 1.', ...stderr.slice(0, 5)].join('\n')
    );
  });

  it.each([
    { name: 'a statement timeout', lines: LOCK_WAIT_TIMEOUT_STDERR },
    {
      name: 'a lock timeout',
      lines: [
        'pg_dump: error: query failed: ERROR:  canceling statement due to lock timeout',
        'pg_dump: error: query was: LOCK TABLE public.widgets IN ACCESS SHARE MODE',
      ],
    },
  ])(
    'says that another session holds a lock when LOCK TABLE hit $name',
    async ({ lines }) => {
      const pgDump = await failingPgDump(await workDir(), lines);

      const error = await rejectionOf(runPgDump(pgDump, ['--schema-only'], {}));

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
      const { message } = error as BaselineError;
      expect(message).toContain('another session holds a lock');
      expect(message).toContain('--lock-wait-timeout');
      expect(message).toContain(lines[1]);
    }
  );

  it('does not blame a lock for a statement timeout of another query', async () => {
    const pgDump = await failingPgDump(await workDir(), [
      'pg_dump: error: query failed: ERROR:  canceling statement due to statement timeout',
      'pg_dump: detail: Query was: SELECT pg_catalog.pg_get_viewdef(16384)',
    ]);

    const error = await rejectionOf(runPgDump(pgDump, ['--schema-only'], {}));

    expect((error as BaselineError).message).not.toContain('lock');
  });

  it('says which signal stopped pg_dump', async () => {
    const pgDump = await script(await workDir(), 'pg_dump', ['kill -KILL $$']);

    const error = await rejectionOf(runPgDump(pgDump, ['--schema-only'], {}));

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'PG_DUMP_FAILED' });
    expect((error as BaselineError).message).toBe(
      'pg_dump was stopped by SIGKILL.'
    );
  });

  it('refuses CockroachDB before it reads the dump, and writes nothing', async () => {
    const queries: string[] = [];
    const dbClient = {
      query: (text: string) => {
        queries.push(text);

        return Promise.resolve({
          rows: [
            {
              version:
                'CockroachDB CCL v25.3.5 (x86_64-pc-linux-gnu, built 2025/10/20 17:49:29, go1.23.12)',
            },
          ],
        });
      },
    } as unknown as ClientBase;
    const dir = join(await workDir(), 'migrations');

    const error = await rejectionOf(
      baseline({
        dbClient,
        fromFile: join(dir, 'missing.sql'),
        dir,
        logger: recordingLogger(),
      })
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'UNSUPPORTED_SERVER' });
    expect((error as BaselineError).message).toContain(
      'CockroachDB CCL v25.3.5'
    );
    expect(queries).toEqual([expect.stringMatching(/\bversion\(\)/)]);
    // A refused baseline writes nothing, not even the directory.
    expect(existsSync(dir)).toBe(false);
  });
});
