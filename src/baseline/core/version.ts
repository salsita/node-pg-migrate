import type { PgDumpVersion } from '../types';

/**
 * Parses the output of `pg_dump --version`, e.g. `pg_dump (PostgreSQL) 18.6`,
 * `pg_dump (PostgreSQL) 16.11 (Homebrew)` or `pg_dump (PostgreSQL) 18beta1`.
 *
 * Throws a `BaselineError` with code `PG_DUMP_FAILED` for anything else.
 *
 * @param text The output of `pg_dump --version`.
 */
export function parsePgDumpVersion(_text: string): PgDumpVersion {
  throw new Error('not implemented');
}

/**
 * The major version of a PostgreSQL server, e.g. `18` for the
 * `server_version_num` `180006`.
 *
 * @param serverVersionNum The server's `server_version_num`.
 */
export function serverMajor(_serverVersionNum: number): number {
  throw new Error('not implemented');
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
  _pgDump: PgDumpVersion,
  _serverVersionNum: number,
  _serverVersion: string
): void {
  throw new Error('not implemented');
}
