import type { ClientConfig } from 'pg';

/**
 * The libpq environment variables (`PGHOST`, `PGPORT`, `PGUSER`,
 * `PGPASSWORD`, `PGDATABASE` and `PGSSLMODE`) that point pg_dump to the
 * database of a node-postgres connection, so that no credential has to appear
 * in pg_dump's arguments.
 *
 * @param connection A connection string (URL) or a client config. A
 * `password` function in the client config is called.
 */
export function toPgEnv(
  _connection: string | ClientConfig
): Promise<Record<string, string>> {
  return Promise.reject(new Error('not implemented'));
}
