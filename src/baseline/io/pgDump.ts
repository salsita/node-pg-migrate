import { spawn } from 'node:child_process';
import { decodeDump } from '../core/decode';
import { pgDumpEnv } from '../core/pgEnv';
import { parsePgDumpVersion } from '../core/version';
import { BaselineError } from '../errors';
import type { PgDumpVersion } from '../types';

/**
 * How many lines of pg_dump's standard error a `PG_DUMP_FAILED` message
 * quotes.
 */
const STDERR_LINES = 5;

/**
 * What to do about a pg_dump output that is not UTF-8 (see `decodeDump()`),
 * although pg_dump runs with `PGCLIENTENCODING=UTF8` (see `pgDumpEnv()`).
 */
const NOT_UTF8_REMEDY =
  'baseline runs pg_dump with PGCLIENTENCODING=UTF8: make sure the pg_dump of --pg-dump gets that variable, or passes --encoding=UTF8 to pg_dump.';

/**
 * pg_dump 14–18 report an expired `--lock-wait-timeout` as a statement
 * timeout (or a lock timeout, when the database sets `lock_timeout`) of the
 * `LOCK TABLE` query that takes the locks of the dumped tables:
 *
 * ```text
 * pg_dump: error: query failed: ERROR:  canceling statement due to statement timeout
 * pg_dump: detail: Query was: LOCK TABLE public.widgets IN ACCESS SHARE MODE
 * ```
 */
const TIMEOUT = /canceling statement due to (?:statement|lock) timeout/i;
const LOCK_TABLE = /\bLOCK TABLE\b/i;

/**
 * The error for a pg_dump that could not be started.
 *
 * @param bin The pg_dump executable.
 * @param error Why it could not be started.
 */
function spawnFailure(
  bin: string,
  error: NodeJS.ErrnoException
): BaselineError {
  return error.code === 'ENOENT'
    ? new BaselineError(
        'PG_DUMP_NOT_FOUND',
        `Could not run ${bin}: it was not found. Install the PostgreSQL client tools (a pg_dump of the server's major version or newer), or pass the pg_dump to run with --pg-dump <path>. You can also run pg_dump --schema-only yourself and pass its output with --from-file <path>.`,
        { cause: error }
      )
    : new BaselineError(
        'PG_DUMP_FAILED',
        `Could not run ${bin}: ${error.message}`,
        { cause: error }
      );
}

/**
 * The error for a pg_dump that did not exit with code 0, with the first lines
 * it wrote to its standard error.
 *
 * @param command What failed, e.g. `pg_dump --version`.
 * @param code The exit code, or `null` when a signal ended pg_dump.
 * @param signal The signal that ended pg_dump, if any.
 * @param stderr What pg_dump wrote to its standard error.
 */
function exitFailure(
  command: string,
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string
): BaselineError {
  const ended =
    code === null
      ? `was stopped by ${String(signal)}`
      : `exited with code ${code}`;
  const explanation =
    TIMEOUT.test(stderr) && LOCK_TABLE.test(stderr)
      ? ': it could not lock the tables to dump in time, because another session holds a lock on one of them (e.g. a long transaction or a running migration). Retry once that session is done, or give pg_dump more time with --lock-wait-timeout <duration>.'
      : '.';
  const lines = stderr
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, STDERR_LINES);

  return new BaselineError(
    'PG_DUMP_FAILED',
    [`${command} ${ended}${explanation}`, ...lines].join('\n')
  );
}

/**
 * Runs pg_dump to its end, with the environment of `pgDumpEnv()`, and
 * returns what it writes to its standard output.
 *
 * @param bin The pg_dump executable.
 * @param args The arguments.
 * @param env Environment variables to add to the current ones.
 * @param command How a failure names the command, e.g. `pg_dump --version`.
 */
function run(
  bin: string,
  args: ReadonlyArray<string>,
  env: Record<string, string>,
  command: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env: pgDumpEnv(process.env, env),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Bytes, decoded once at the end: a character can be split across
    // chunks.
    const stdout: Buffer[] = [];
    const stderr: string[] = [];
    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr.push(chunk);
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      reject(spawnFailure(bin, error));
    });
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
      } else {
        reject(exitFailure(command, code, signal, stderr.join('')));
      }
    });
  });
}

/**
 * Runs `<bin> --version` and parses what it prints (see
 * `parsePgDumpVersion()`).
 *
 * Throws a `BaselineError` with code `PG_DUMP_NOT_FOUND` when `bin` cannot be
 * found, and `PG_DUMP_FAILED` when it fails or prints something else.
 *
 * @param bin The pg_dump executable.
 * @param env Environment variables to add to the current ones.
 */
export async function getPgDumpVersion(
  bin: string,
  env: Record<string, string>
): Promise<PgDumpVersion> {
  const stdout = await run(bin, ['--version'], env, `${bin} --version`);

  try {
    return parsePgDumpVersion(stdout.toString('utf8'));
  } catch (error) {
    // Its message does not say which executable printed that.
    throw error instanceof BaselineError
      ? new BaselineError(error.code, `${bin}: ${error.message}`, {
          cause: error,
        })
      : error;
  }
}

/**
 * Runs pg_dump and returns what it writes to its standard output, which must
 * be UTF-8 (see `decodeDump()`).
 *
 * Throws a `BaselineError` with code `PG_DUMP_FAILED` and the first lines of
 * pg_dump's standard error when it exits with a non-zero code. When it gave
 * up waiting for a table lock, the message says so. Throws one with code
 * `NOT_UTF8` when its output is not UTF-8.
 *
 * @param bin The pg_dump executable.
 * @param args The arguments (see `buildPgDumpArgs()`).
 * @param env Environment variables to add to the current ones (see
 * `toPgEnv()`); pg_dump gets them the way `pgDumpEnv()` says.
 */
export async function runPgDump(
  bin: string,
  args: ReadonlyArray<string>,
  env: Record<string, string>
): Promise<string> {
  return decodeDump(await run(bin, args, env, 'pg_dump'), NOT_UTF8_REMEDY);
}
