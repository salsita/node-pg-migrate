import type { DBConnection } from '../../db';
import { quote } from '../../utils';
import { parseQualifiedName } from '../core/identifiers';
import { BaselineError } from '../errors';
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
 * The server's version and lock table settings, and the `relkind` of the
 * relation with the migrations table's name, `null` when there is none. The
 * name is `$1`, quoted and schema-qualified.
 *
 * It only reads the catalogs: the relation itself is never selected from (so
 * a view's definition, a foreign table's wrapper, etc. never run), and its
 * history is only counted once {@link readHistory} has checked that it is an
 * ordinary or partitioned table.
 *
 * The settings stay text: a database may define its own casts from text, and
 * the queries of this file must not run code of the database.
 */
const FACTS_QUERY = `SELECT
  pg_catalog.current_setting('server_version') AS version,
  pg_catalog.current_setting('server_version_num') AS version_num,
  pg_catalog.current_setting('max_connections') AS max_connections,
  pg_catalog.current_setting('max_prepared_transactions') AS max_prepared_transactions,
  (
    SELECT c.relkind
    FROM pg_catalog.pg_class AS c
    WHERE c.oid OPERATOR(pg_catalog.=) pg_catalog.to_regclass($1)
  ) AS relkind`;

/**
 * The `relkind` codes of relations baseline reads as a migrations table: an
 * ordinary table (`r`) and a partitioned table (`p`). `count(*)` over either
 * runs no code of the database.
 */
const TABLE_RELKINDS: ReadonlySet<string> = new Set(['r', 'p']);

/**
 * How the refusal names a relation that is not a usable migrations table, by
 * its `relkind`. A view contains "view", a materialized view "materialized",
 * a foreign table "foreign".
 */
const RELKIND_LABELS: Readonly<Record<string, string>> = {
  v: 'a view',
  m: 'a materialized view',
  f: 'a foreign table',
  i: 'an index',
  I: 'a partitioned index',
  S: 'a sequence',
  c: 'a composite type',
  t: 'a TOAST table',
};

/**
 * Counts the rows and reads the `id` column's sequence of the migrations
 * table in one query. It only runs once {@link FACTS_QUERY} has shown the
 * relation is an ordinary or partitioned table, so `count(*)` over it runs no
 * code of the database. `pg_get_serial_sequence()` has no column references,
 * so it is allowed alongside the aggregate; it returns `null` when the `id`
 * column has no sequence.
 */
const HISTORY_QUERY = `SELECT
  pg_catalog.count(*) AS count,
  pg_catalog.pg_get_serial_sequence($1, 'id') AS sequence`;

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

  /**
   * The `relkind` of the relation with the migrations table's name, or `null`
   * when no relation has it.
   */
  readonly relkind: string | null;
}

/**
 * What {@link HISTORY_QUERY} returns.
 */
interface HistoryRow {
  readonly count: string;
  readonly sequence: string | null;
}

/**
 * The defaults of the settings that size the lock table, for servers that
 * are not PostgreSQL.
 */
const DEFAULT_MAX_CONNECTIONS = 100;
const DEFAULT_MAX_PREPARED_TRANSACTIONS = 0;

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
 * The migration history of the migrations table: how many migrations it
 * records and which sequence its `id` column uses. The caller must have
 * checked that the relation is an ordinary or partitioned table, so that
 * `count(*)` over it runs no code of the database.
 *
 * @param db The database connection.
 * @param table The table, quoted and schema-qualified.
 */
async function readHistory(
  db: DBConnection,
  table: string
): Promise<{
  readonly migrationsTableExists: true;
  readonly recordedMigrations: number;
  readonly migrationsSequence?: QualifiedName;
}> {
  const [{ count, sequence }]: HistoryRow[] = await db.select({
    text: `${HISTORY_QUERY}\nFROM ${table}`,
    values: [table],
  });

  return {
    migrationsTableExists: true,
    recordedMigrations: Number(count),
    ...sequenceOf(sequence),
  };
}

/**
 * The refusal for a migrations table that exists but is not an ordinary or
 * partitioned table, naming it and its kind (see {@link RELKIND_LABELS}).
 *
 * @param table The relation, quoted and schema-qualified.
 * @param relkind Its `pg_class.relkind`.
 */
function invalidMigrationsTable(table: string, relkind: string): BaselineError {
  const kind = RELKIND_LABELS[relkind] ?? `a relation of kind '${relkind}'`;

  return new BaselineError(
    'INVALID_MIGRATIONS_TABLE',
    `${table} is ${kind}, not an ordinary or partitioned table: baseline reads the migration history from the migrations table and will not read ${kind}. Point baseline at the real migrations table (--migrations-table, --migrations-schema), or remove ${kind} with that name.`
  );
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
 * When a relation with the migrations table's name exists but is not an
 * ordinary or partitioned table (a view, a materialized view, a foreign
 * table, …), it throws a `BaselineError` with code `INVALID_MIGRATIONS_TABLE`
 * without reading it, so none of its code runs.
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
    // A relation with that name exists, but it is not a table: refuse before
    // counting the history, so none of its code runs (a view's definition, a
    // foreign table's wrapper, …).
    if (facts.relkind !== null && !TABLE_RELKINDS.has(facts.relkind)) {
      throw invalidMigrationsTable(table, facts.relkind);
    }

    const history =
      facts.relkind === null
        ? { migrationsTableExists: false, recordedMigrations: 0 }
        : await readHistory(db, table);

    return {
      isCockroach: false,
      version: facts.version.split(' ')[0],
      versionNum: Number(facts.version_num),
      maxConnections: Number(facts.max_connections),
      maxPreparedTransactions: Number(facts.max_prepared_transactions),
      ...history,
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
