import type { DBConnection } from '../../db';
import { quote } from '../../utils';
import { parseQualifiedName } from '../core/identifiers';
import type { QualifiedName, ServerFacts } from '../types';

/**
 * An extension installed in a database.
 */
export interface InstalledExtension {
  /**
   * The name of the extension, e.g. `pg_trgm`.
   */
  readonly name: string;

  /**
   * The schema of its objects (`CREATE EXTENSION … WITH SCHEMA`).
   */
  readonly schema: string;
}

/**
 * The server's version and lock table settings, and whether the migrations
 * table exists and which sequence its `id` column uses. The table's name is
 * `$1`, quoted and schema-qualified.
 *
 * `pg_get_serial_sequence()` fails for a missing table, so it only runs when
 * the table exists. (It fails for a missing `id` column too, but the runner
 * cannot use a migrations table without one either.)
 *
 * The settings stay text: a database may define its own casts from text, and
 * the queries of this file must not run code of the database.
 */
const FACTS_QUERY = `SELECT
  pg_catalog.current_setting('server_version') AS version,
  pg_catalog.current_setting('server_version_num') AS version_num,
  pg_catalog.current_setting('max_connections') AS max_connections,
  pg_catalog.current_setting('max_prepared_transactions') AS max_prepared_transactions,
  pg_catalog.to_regclass($1) IS NOT NULL AS table_exists,
  CASE WHEN pg_catalog.to_regclass($1) IS NOT NULL
    THEN pg_catalog.pg_get_serial_sequence($1, 'id')
  END AS sequence`;

/**
 * The extensions pg_dump would dump: all but the ones created with the
 * database (object IDs below `FirstNormalObjectId`), such as `plpgsql`. The
 * operators are the built-in ones, whatever the search path.
 */
const EXTENSIONS_QUERY = `SELECT e.extname AS name, n.nspname AS schema
FROM pg_catalog.pg_extension AS e
JOIN pg_catalog.pg_namespace AS n
  ON n.oid OPERATOR(pg_catalog.=) e.extnamespace
WHERE e.oid OPERATOR(pg_catalog.>=) '16384'::pg_catalog.oid
ORDER BY e.extname`;

/**
 * What {@link FACTS_QUERY} returns.
 */
interface FactsRow {
  readonly version: string;
  readonly version_num: string;
  readonly max_connections: string;
  readonly max_prepared_transactions: string;
  readonly table_exists: boolean;
  readonly sequence: string | null;
}

/**
 * The defaults of the settings that size the lock table, for servers that
 * are not PostgreSQL.
 */
const DEFAULT_MAX_CONNECTIONS = 100;
const DEFAULT_MAX_PREPARED_TRANSACTIONS = 0;

/**
 * Counts the rows of a table.
 *
 * @param db The database connection.
 * @param table The table, quoted and schema-qualified.
 */
async function countRows(db: DBConnection, table: string): Promise<number> {
  const [{ count }]: Array<{ count: string }> = await db.select(
    `SELECT pg_catalog.count(*) AS count FROM ${table}`
  );

  return Number(count);
}

/**
 * The `migrationsSequence` of the facts, from what `pg_get_serial_sequence()`
 * returned: a quoted, schema-qualified name, or `null`.
 *
 * @param sequence The name of the sequence, or `null` when there is none.
 */
function sequenceOf(sequence: string | null): {
  readonly migrationsSequence?: QualifiedName;
} {
  const parsed =
    sequence === null ? undefined : parseQualifiedName(sequence, 0);

  return parsed === undefined
    ? {}
    : { migrationsSequence: { schema: parsed.schema, name: parsed.name } };
}

/**
 * Reads what `baseline()` checks before it dumps the schema: the kind and the
 * version of the server, the settings that size its lock table, and the
 * migration history.
 *
 * It runs a fixed number of queries, whatever the size of the schema, in a
 * read-only transaction that it rolls back. On CockroachDB it stops after
 * `SELECT version()`.
 *
 * The connection must not be in a transaction already: the rollback would end
 * it.
 *
 * @param db The database connection.
 * @param options Where the migrations table is.
 */
export async function readServerFacts(
  db: DBConnection,
  options: {
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
  const [{ version }]: Array<{ version: string }> = await db.select(
    'SELECT pg_catalog.version() AS version'
  );
  if (version.includes('CockroachDB')) {
    return {
      isCockroach: true,
      version,
      versionNum: 0,
      maxConnections: DEFAULT_MAX_CONNECTIONS,
      maxPreparedTransactions: DEFAULT_MAX_PREPARED_TRANSACTIONS,
      migrationsTableExists: false,
      recordedMigrations: 0,
    };
  }

  const table = `${quote(options.migrationsSchema)}.${quote(options.migrationsTable)}`;

  await db.query('BEGIN READ ONLY');
  try {
    const [facts]: FactsRow[] = await db.select({
      text: FACTS_QUERY,
      values: [table],
    });
    const recordedMigrations = facts.table_exists
      ? await countRows(db, table)
      : 0;

    return {
      isCockroach: false,
      version: facts.version.split(' ')[0],
      versionNum: Number(facts.version_num),
      maxConnections: Number(facts.max_connections),
      maxPreparedTransactions: Number(facts.max_prepared_transactions),
      migrationsTableExists: facts.table_exists,
      recordedMigrations,
      ...sequenceOf(facts.sequence),
    };
  } finally {
    await db.query('ROLLBACK');
  }
}

/**
 * Lists the extensions of a database that pg_dump dumps, with their schemas.
 *
 * @param db The database connection.
 * @returns The extensions, by name.
 */
export async function readExtensions(
  db: DBConnection
): Promise<InstalledExtension[]> {
  const rows: InstalledExtension[] = await db.select(EXTENSIONS_QUERY);

  return rows.map(({ name, schema }) => ({ name, schema }));
}
