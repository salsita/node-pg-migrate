import type { SanitizedDump, SanitizeOptions } from '../types';

/**
 * Turns a `pg_dump --schema-only` output into the body of a baseline
 * migration, which runs inside node-pg-migrate's migration transaction.
 *
 * The `\restrict` / `\unrestrict` pair, the `search_path` reset,
 * `*_timeout` settings, `COMMENT ON EXTENSION` and `CREATE SCHEMA public` are
 * dropped. Other session settings become `SET LOCAL` and are restored at the
 * end, so they do not leak into the migrations that run after the baseline in
 * the same transaction. Everything else is kept byte for byte.
 *
 * Throws a `BaselineError` when the dump cannot be a baseline: it has a psql
 * meta-command, data, `CREATE DATABASE` or `DROP` statements, creates the
 * migrations table or its sequence, or has a line that node-pg-migrate would
 * read as an up/down migration marker.
 *
 * @param dump The pg_dump output.
 * @param options The migrations table and sequence, which the dump must not
 * create.
 */
export function sanitizeDump(
  _dump: string,
  _options: SanitizeOptions
): SanitizedDump {
  throw new Error('not implemented');
}
