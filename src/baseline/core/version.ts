import { BaselineError } from '../errors';
import type { PgDumpVersion } from '../types';

/**
 * What `pg_dump --version` prints before the version.
 */
const VERSION_PREFIX = 'pg_dump (PostgreSQL) ';

/**
 * The major and, when there is one, minor version at the start of a version,
 * e.g. `18` and `6` in `18.6`, `18` in `18beta1`.
 */
const VERSION_NUMBERS = /^(\d+)(?:\.(\d+))?/;

/**
 * How much of an unexpected `pg_dump --version` output error messages quote.
 */
const QUOTED_OUTPUT_LENGTH = 120;

/**
 * Parses the output of `pg_dump --version`, e.g. `pg_dump (PostgreSQL) 18.6`,
 * `pg_dump (PostgreSQL) 16.11 (Homebrew)` or `pg_dump (PostgreSQL) 18beta1`.
 *
 * Throws a `BaselineError` with code `PG_DUMP_FAILED` for anything else.
 *
 * @param text The output of `pg_dump --version`.
 */
export function parsePgDumpVersion(text: string): PgDumpVersion {
  const [firstLine] = text.trim().split('\n', 1);
  const line = firstLine.trim();
  const raw = line.startsWith(VERSION_PREFIX)
    ? line.slice(VERSION_PREFIX.length).trim()
    : '';
  const numbers = VERSION_NUMBERS.exec(raw);
  if (numbers === null) {
    const output = line.slice(0, QUOTED_OUTPUT_LENGTH);
    throw new BaselineError(
      'PG_DUMP_FAILED',
      `could not read the version of pg_dump from what \`pg_dump --version\` printed ("${output}"). Is it PostgreSQL's pg_dump? Pass its path with --pg-dump <path>, or dump the schema yourself and use --from-file.`
    );
  }

  const major = Number(numbers[1]);
  const minor = numbers.at(2);

  return minor === undefined
    ? { major, raw }
    : { major, minor: Number(minor), raw };
}

/**
 * The major version of a PostgreSQL server, e.g. `18` for the
 * `server_version_num` `180006`.
 *
 * @param serverVersionNum The server's `server_version_num`.
 */
export function serverMajor(serverVersionNum: number): number {
  return Math.floor(serverVersionNum / 10_000);
}

/**
 * Checks that pg_dump can dump the server: pg_dump refuses servers of a newer
 * major version than its own.
 *
 * Throws a `BaselineError` with code `PG_DUMP_TOO_OLD`, naming both versions
 * and what to do, when pg_dump's major version is older than the server's.
 *
 * @param pgDump The version of pg_dump.
 * @param serverVersionNum The server's `server_version_num`.
 * @param serverVersion The server's version, as shown to the user.
 */
export function assertPgDumpCompatible(
  pgDump: PgDumpVersion,
  serverVersionNum: number,
  serverVersion: string
): void {
  const major = serverMajor(serverVersionNum);
  if (pgDump.major < major) {
    throw new BaselineError(
      'PG_DUMP_TOO_OLD',
      `pg_dump ${pgDump.raw} is older than the PostgreSQL ${serverVersion} server, which it cannot dump. Install pg_dump ${String(major)} or newer and pass its path with --pg-dump <path>, or dump the schema with it yourself and use --from-file.`
    );
  }
}
