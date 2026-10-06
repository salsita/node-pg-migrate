import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Fallback } from '../../../src/codegen/fallback';

// Oracles for the TypeScript/JavaScript baseline specs. They read the catalogs
// with their own queries and never call the code under test.

/**
 * Runs a query with `psql` in a database of the container, after `SET
 * search_path = ''` like the introspection does, so that `format_type()` and
 * `pg_get_function_identity_arguments()` qualify every name outside
 * `pg_catalog` the way the model has them.
 *
 * @param container The PostgreSQL container.
 * @param database The database to query.
 * @param sql A query that returns one value.
 *
 * @returns The value, as text.
 *
 * @throws Throws an error with `psql`'s output if the query fails.
 */
export async function catalogQuery(
  container: StartedPostgreSqlContainer,
  database: string,
  sql: string
): Promise<string> {
  const res = await container.exec([
    'psql',
    '-X',
    '-q',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '-c',
    "SET search_path = ''",
    '-c',
    sql,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(`query failed in "${database}": ${res.stderr}`);
  }

  return res.stdout.trim();
}

/**
 * The fallbacks whose reason is a plain catalog fact, by the rules of the
 * emitters' JSDoc (`src/codegen/emitters/*.ts`), as a JSON array of
 * `{ kind, identity, reason }`:
 *
 * - a partition (`relispartition`) is a whole-table fallback, reason
 *   `partition`; so is a table with a virtual generated column (PostgreSQL
 *   18), reason `virtual generated column` (joined with `, ` when both apply);
 * - an aggregate is always one, reason `aggregate`, and so are a range type
 *   (`range type`) and a collation (`collation`);
 * - a procedure is one, reason `procedure`, and so is a function with a
 *   SQL-standard body, reason `SQL-standard body`;
 * - a restrictive policy, reason `restrictive policy`;
 * - a trigger with transition tables, reason `transition tables` (a trigger on
 *   `UPDATE OF` columns is a `pgm.createTrigger` call).
 *
 * Identities are written like `Fallback.identity`: names as stored,
 * `schema.name`, `schema.name(identity arguments)` for routines and `name on
 * schema.table` for policies and triggers. Members of extensions, the objects
 * that `CREATE TYPE … AS RANGE` makes and temporary tables are left out.
 */
const CATALOG_FALLBACKS = `
WITH
namespaces AS (
  SELECT oid, nspname FROM pg_catalog.pg_namespace
  WHERE nspname <> 'information_schema' AND nspname NOT LIKE 'pg\\_%'
),
dependencies AS (
  SELECT classid, objid, deptype FROM pg_catalog.pg_depend WHERE deptype IN ('e', 'i')
),
relations AS (
  SELECT c.oid, c.relkind, c.relispartition, n.nspname || '.' || c.relname AS identity
  FROM pg_catalog.pg_class AS c JOIN namespaces AS n ON n.oid = c.relnamespace
  WHERE c.relpersistence <> 't'
    AND NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.objid = c.oid)
),
routines AS (
  SELECT p.oid, p.prokind, p.prosqlbody IS NOT NULL AS sql_body,
    n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS identity
  FROM pg_catalog.pg_proc AS p JOIN namespaces AS n ON n.oid = p.pronamespace
  WHERE NOT EXISTS (SELECT FROM dependencies AS d WHERE d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass AND d.objid = p.oid)
),
fallbacks (kind, identity, reason) AS (
  SELECT 'table', r.identity, pg_catalog.concat_ws(', ',
      CASE WHEN r.relispartition THEN 'partition' END,
      CASE WHEN EXISTS (
        SELECT FROM pg_catalog.pg_attribute AS a
        WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = 'v'
      ) THEN 'virtual generated column' END)
  FROM relations AS r WHERE r.relkind IN ('r', 'p')
  UNION ALL
  SELECT 'aggregate', r.identity, 'aggregate'
  FROM routines AS r JOIN pg_catalog.pg_aggregate AS a ON a.aggfnoid = r.oid
  WHERE r.prokind = 'a' AND a.aggkind = 'n'
  UNION ALL
  SELECT 'function', identity, 'procedure' FROM routines WHERE prokind = 'p'
  UNION ALL
  SELECT 'function', identity, 'SQL-standard body' FROM routines WHERE prokind IN ('f', 'w') AND sql_body
  UNION ALL
  SELECT 'range', n.nspname || '.' || t.typname, 'range type'
  FROM pg_catalog.pg_type AS t JOIN namespaces AS n ON n.oid = t.typnamespace
  WHERE t.typtype = 'r'
    AND NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_type'::pg_catalog.regclass AND d.objid = t.oid)
  UNION ALL
  SELECT 'collation', n.nspname || '.' || co.collname, 'collation'
  FROM pg_catalog.pg_collation AS co JOIN namespaces AS n ON n.oid = co.collnamespace
  WHERE NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_collation'::pg_catalog.regclass AND d.objid = co.oid)
  UNION ALL
  SELECT 'policy', po.polname || ' on ' || r.identity, 'restrictive policy'
  FROM pg_catalog.pg_policy AS po JOIN relations AS r ON r.oid = po.polrelid
  WHERE NOT po.polpermissive
  UNION ALL
  SELECT 'trigger', tg.tgname || ' on ' || r.identity,
      CASE WHEN tg.tgoldtable IS NOT NULL OR tg.tgnewtable IS NOT NULL THEN 'transition tables' ELSE '' END
  FROM pg_catalog.pg_trigger AS tg JOIN relations AS r ON r.oid = tg.tgrelid
  WHERE NOT tg.tgisinternal AND tg.tgparentid = 0
)
SELECT coalesce(pg_catalog.json_agg(pg_catalog.json_build_object('kind', kind, 'identity', identity, 'reason', reason)), '[]')
FROM fallbacks WHERE reason <> ''`;

/**
 * Puts fallbacks in a fixed order (by kind, identity, then reason) and keeps
 * only the fields of `Fallback`, so that lists can be compared whatever order
 * the migration has them in.
 *
 * @param fallbacks The fallbacks.
 *
 * @returns A sorted copy.
 */
export function sortFallbacks(fallbacks: ReadonlyArray<Fallback>): Fallback[] {
  // PostgreSQL names cannot contain a zero byte, so two keys never collide.
  const key = (fallback: Fallback): string =>
    [fallback.kind, fallback.identity, fallback.reason].join('\u0000');

  return fallbacks
    .map(({ kind, identity, reason }) => ({ kind, identity, reason }))
    .toSorted((a, b) => {
      const [left, right] = [key(a), key(b)];
      if (left === right) {
        return 0;
      }

      return left < right ? -1 : 1;
    });
}

/**
 * Reads from the catalogs of a database the fallbacks that a TypeScript
 * baseline of it must report for the objects whose reason is a plain catalog
 * fact (see {@link CATALOG_FALLBACKS}). The fallbacks that depend on finer
 * details (storage parameters, operator classes, comments, …) are not in it.
 *
 * @param container The PostgreSQL container.
 * @param database The database.
 *
 * @returns The fallbacks, sorted with {@link sortFallbacks}.
 */
export async function catalogFallbacks(
  container: StartedPostgreSqlContainer,
  database: string
): Promise<Fallback[]> {
  const fallbacks: Fallback[] = JSON.parse(
    await catalogQuery(container, database, CATALOG_FALLBACKS)
  );

  return sortFallbacks(fallbacks);
}

/**
 * How many fallbacks there are per reason, e.g. `{ partition: 55, aggregate:
 * 1 }`.
 *
 * @param reasons The reason of each fallback.
 *
 * @returns The count of each reason.
 */
export function countReasons(
  reasons: ReadonlyArray<string>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reason of reasons) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }

  return counts;
}

/**
 * The reasons of the `// fallback: <reason>` comments of a generated
 * migration, in the order of the file.
 *
 * @param content The content of the migration file.
 *
 * @returns The reasons.
 */
export function fallbackComments(content: string): string[] {
  return [...content.matchAll(/^[ \t]*\/\/ fallback: (.+)$/gm)].map(
    ([, reason]) => reason.trim()
  );
}

/**
 * A pattern that matches an identity where it is not the start of a longer
 * name (`public.payment_p2022_01` must not match `public.payment_p2022_010`).
 *
 * @param identity The identity of an object.
 *
 * @returns The pattern.
 */
export function identityPattern(identity: string): RegExp {
  return new RegExp(
    `${identity.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`)}(?![\\w$])`
  );
}
