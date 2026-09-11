import type { DBConnection } from '../../db';
import type { ServerFacts } from '../types';

/**
 * Reads what `baseline()` checks before it dumps the schema: the kind and the
 * version of the server, the settings that size its lock table, and the
 * migration history.
 *
 * It runs a fixed number of queries, whatever the size of the schema, in a
 * read-only transaction that it rolls back. On CockroachDB it stops after
 * `SELECT version()`.
 *
 * @param db The database connection.
 * @param options Where the migrations table is.
 */
export function readServerFacts(
  _db: DBConnection,
  _options: {
    /**
     * The schema storing the table which migrations have been run.
     */
    readonly migrationsSchema: string;

    /**
     * The table storing which migrations have been run.
     */
    readonly migrationsTable: string;
  }
): Promise<ServerFacts> {
  return Promise.reject(new Error('not implemented'));
}
