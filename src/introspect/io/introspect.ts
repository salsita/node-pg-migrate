import type { DBConnection } from '../../db';
import type { IntrospectOptions, SchemaModel } from '../types';

/**
 * Reads the schema of a database from its catalogs.
 *
 * Runs `BEGIN READ ONLY` and `SET LOCAL search_path = ''`, then each query of
 * `QUERIES` once, then `ROLLBACK` (also when a query fails): a fixed number
 * of queries whatever the size of the schema, and nothing is changed. The
 * rows go through `rowsToModel()` with `options`.
 *
 * Publications and subscriptions are left out on purpose, like the SQL
 * output does (`--no-publications --no-subscriptions`): replication settings
 * are not schema. So are owners, privileges, security labels and
 * tablespaces (`--no-owner --no-privileges --no-security-labels
 * --no-tablespaces`).
 *
 * @param db The database connection.
 * @param options Which schemas to read, and where the migrations table is.
 * @returns The schema of the database.
 */
export function introspect(
  _db: DBConnection,
  _options: IntrospectOptions
): Promise<SchemaModel> {
  return Promise.reject(new Error('not implemented'));
}
