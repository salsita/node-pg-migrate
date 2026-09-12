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
 * The `relkind` of the relation with the migrations table's name (`$1`,
 * quoted and schema-qualified): one row, or none when no relation has that
 * name. It only reads `pg_class`, never the relation itself, so a view's
 * definition, a foreign table's wrapper, etc. never run.
 */
const RELKIND_QUERY = `SELECT c.relkind
FROM pg_catalog.pg_class AS c
WHERE c.oid OPERATOR(pg_catalog.=) pg_catalog.to_regclass($1)`;

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
 * Refuses a relation with the migrations table's name that exists but is not
 * an ordinary or partitioned table, with a `BaselineError` with code
 * `INVALID_MIGRATIONS_TABLE`. It decides from `pg_class` alone (see
 * {@link RELKIND_QUERY}), so none of the relation's code runs. A missing
 * relation passes: it means there is no history.
 *
 * @param db The database connection.
 * @param table The relation, quoted and schema-qualified.
 */
async function assertMigrationsTableKind(
  db: DBConnection,
  table: string
): Promise<void> {
  const rows: Array<{ relkind: string }> = await db.select({
    text: RELKIND_QUERY,
    values: [table],
  });
  const relkind = rows[0]?.relkind;
  if (relkind !== undefined && !TABLE_RELKINDS.has(relkind)) {
    throw invalidMigrationsTable(table, relkind);
  }
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
 * With `check.requireTable`, which `baseline()` always sets, a relation with
 * the migrations table's name that exists but is not an ordinary or
 * partitioned table (a view, a materialized view, a foreign table, …) makes
 * it throw a `BaselineError` with code `INVALID_MIGRATIONS_TABLE`. That is
 * decided from `pg_class` first, before any other query names the relation,
 * so none of its code runs. Without it, whatever relation has that name is
 * counted as the migrations table.
 *
 * The connection must not be in a transaction already: the rollback would end
 * it.
 *
 * @param db The database connection.
 * @param options Where the migrations table is.
 * @param check What to check before the history is read.
 * @param check.requireTable Whether to refuse a migrations relation that is
 * not an ordinary or partitioned table.
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
  },
  check: { readonly requireTable?: boolean } = {}
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
    // Before anything else names the relation: pg_get_serial_sequence() would
    // fail on a view without an `id` column, and counting would run its code.
    if (check.requireTable === true) {
      await assertMigrationsTableKind(db, table);
    }

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
 * Refuses `includeSchemas` names that match no schema in the database, so
 * that a typo or pg_dump's case-folding does not silently leave a schema out
 * of the baseline. Names are matched exactly and case-sensitively against
 * `pg_namespace.nspname`.
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS` that names every
 * unknown schema. It only reads the catalogs.
 *
 * @param db The database connection.
 * @param includeSchemas The `--include-schema` names; nothing is checked when
 * it is empty.
 */
export async function assertIncludedSchemasExist(
  db: DBConnection,
  includeSchemas: ReadonlyArray<string>
): Promise<void> {
  if (includeSchemas.length === 0) {
    return;
  }

  const unknown: Array<{ name: string }> = await db.select({
    text: `SELECT n AS name
FROM pg_catalog.unnest($1::pg_catalog.text[]) AS n
WHERE NOT EXISTS (
  SELECT FROM pg_catalog.pg_namespace AS ns
  WHERE ns.nspname OPERATOR(pg_catalog.=) n
)`,
    values: [[...includeSchemas]],
  });
  if (unknown.length === 0) {
    return;
  }

  const names = unknown.map((row) => quote(row.name)).join(', ');
  throw new BaselineError(
    'INVALID_OPTIONS',
    `--include-schema names schema(s) that do not exist: ${names}. Names are matched exactly and case-sensitively: check the spelling, or leave --include-schema out to dump every schema.`
  );
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
