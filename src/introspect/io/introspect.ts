import { rowsToModel } from '../core/model';
import type {
  CatalogConnection,
  CatalogRows,
  IntrospectOptions,
  SchemaModel,
} from '../types';
import type { QueryName } from './queries';
import { QUERIES } from './queries';

/**
 * Runs every query of `QUERIES` once, in order.
 *
 * @param db The database connection, in the introspection's transaction.
 * @returns The rows of each query.
 */
async function readCatalogs(db: CatalogConnection): Promise<CatalogRows> {
  const select = (name: QueryName): ReturnType<CatalogConnection['select']> =>
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
 * The settings that decide how the server renders the constants inside the
 * expressions the introspection reads: `pg_get_expr()` (column and domain
 * defaults, index predicates, policy expressions, partition bounds),
 * `pg_get_constraintdef()` and the `pg_get_*def()` of indexes, views and
 * functions all print a constant with its type's output function, which reads
 * these. A `timestamptz` in a partition bound comes out as `'2022-01-01
 * 00:00:00+00'` for a reader in UTC and `'31.12.2021 21:00:00 -03'` for one in
 * America/Sao_Paulo with German dates: the same database, a different
 * migration, and German dates do not even load back.
 *
 * pg_dump pins the last three in `setup_connection()`
 * (`src/bin/pg_dump/pg_dump.c`): `SET DATESTYLE = ISO` ("to ensure the dump's
 * portability"), `SET INTERVALSTYLE = POSTGRES` and `SET extra_float_digits TO
 * 3` ("so that we can dump float data exactly"). It does not pin `TimeZone` or
 * `bytea_output`, because it writes a timestamp only inside an expression it
 * quotes verbatim, where `DATESTYLE = ISO` already fixes the zone's format;
 * baseline writes that text into a file a team commits, so it must not depend
 * on the reader at all, and pins both as well. `bytea_output = 'hex'` is also
 * the format node-postgres parses.
 *
 * They are set with `SET LOCAL`, so the caller's session is the same after the
 * introspection as before it.
 */
const RENDERING_SETTINGS: ReadonlyArray<string> = [
  "SET LOCAL TimeZone = 'UTC'",
  "SET LOCAL DateStyle = 'ISO, YMD'",
  "SET LOCAL IntervalStyle = 'postgres'",
  'SET LOCAL extra_float_digits = 3',
  "SET LOCAL bytea_output = 'hex'",
];

/**
 * Reads the schema of a database from its catalogs.
 *
 * Runs `BEGIN READ ONLY` (with `REPEATABLE READ`, so that every query sees
 * the same snapshot, like pg_dump), `SET LOCAL search_path = ''` and the
 * {@link RENDERING_SETTINGS}, then each query of `QUERIES` once, then
 * `ROLLBACK` (also when a query fails): a fixed number of queries whatever
 * the size of the schema, and nothing is changed. The rows go through
 * `rowsToModel()` with `options`.
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
  db: CatalogConnection,
  options: IntrospectOptions
): Promise<SchemaModel> {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await db.query("SET LOCAL search_path = ''");
    for (const setting of RENDERING_SETTINGS) {
      await db.query(setting);
    }

    return rowsToModel(await readCatalogs(db), options);
  } finally {
    await db.query('ROLLBACK');
  }
}
