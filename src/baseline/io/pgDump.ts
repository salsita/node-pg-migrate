import type { PgDumpVersion } from '../types';

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
export function getPgDumpVersion(
  _bin: string,
  _env: Record<string, string>
): Promise<PgDumpVersion> {
  return Promise.reject(new Error('not implemented'));
}

/**
 * Runs pg_dump and returns what it writes to its standard output.
 *
 * Throws a `BaselineError` with code `PG_DUMP_FAILED` and the first lines of
 * pg_dump's standard error when it exits with a non-zero code.
 *
 * @param bin The pg_dump executable.
 * @param args The arguments (see `buildPgDumpArgs()`).
 * @param env Environment variables to add to the current ones (see
 * `toPgEnv()`).
 */
export function runPgDump(
  _bin: string,
  _args: ReadonlyArray<string>,
  _env: Record<string, string>
): Promise<string> {
  return Promise.reject(new Error('not implemented'));
}
