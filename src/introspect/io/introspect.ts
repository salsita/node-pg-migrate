import type { DBConnection } from '../../db';
import { rowsToModel } from '../core/model';
import type { CatalogRows, IntrospectOptions, SchemaModel } from '../types';
import type { QueryName } from './queries';
import { QUERIES } from './queries';

/**
 * Runs every query of `QUERIES` once, in order.
 *
 * @param db The database connection, in the introspection's transaction.
 * @returns The rows of each query.
 */
async function readCatalogs(db: DBConnection): Promise<CatalogRows> {
  const select = (name: QueryName): ReturnType<DBConnection['select']> =>
    db.select(QUERIES[name]);

  // The object literal evaluates, and so awaits, the queries in the order
  // of `QUERIES`.
  return {
    schemas: await select('schemas'),
    extensions: await select('extensions'),
    enums: await select('enums'),
    shellTypes: await select('shellTypes'),
    composites: await select('composites'),
    domains: await select('domains'),
    ranges: await select('ranges'),
    collations: await select('collations'),
    sequences: await select('sequences'),
    functions: await select('functions'),
    operators: await select('operators'),
    casts: await select('casts'),
    aggregates: await select('aggregates'),
    tables: await select('tables'),
    columns: await select('columns'),
    constraints: await select('constraints'),
    indexes: await select('indexes'),
    partitionIndexes: await select('partitionIndexes'),
    views: await select('views'),
    triggers: await select('triggers'),
    partitionTriggers: await select('partitionTriggers'),
    policies: await select('policies'),
    rules: await select('rules'),
    statistics: await select('statistics'),
    dependencies: await select('dependencies'),
    unsupported: await select('unsupported'),
  };
}

/**
 * Reads the schema of a database from its catalogs.
 *
 * Runs `BEGIN READ ONLY` (with `REPEATABLE READ`, so that every query sees
 * the same snapshot, like pg_dump) and `SET LOCAL search_path = ''`, then
 * each query of `QUERIES` once, then `ROLLBACK` (also when a query fails): a
 * fixed number of queries whatever the size of the schema, and nothing is
 * changed. The rows go through `rowsToModel()` with `options`.
 *
 * Publications and subscriptions are left out on purpose, like the SQL
 * output does (`--no-publications --no-subscriptions`): replication settings
 * are not schema. So are owners, privileges, security labels and
 * tablespaces (`--no-owner --no-privileges --no-security-labels
 * --no-tablespaces`).
 *
 * The connection must not be in a transaction already: the rollback would
 * end it.
 *
 * @param db The database connection.
 * @param options Which schemas to read, and where the migrations table is.
 * @returns The schema of the database.
 */
export async function introspect(
  db: DBConnection,
  options: IntrospectOptions
): Promise<SchemaModel> {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await db.query("SET LOCAL search_path = ''");

    return rowsToModel(await readCatalogs(db), options);
  } finally {
    await db.query('ROLLBACK');
  }
}
