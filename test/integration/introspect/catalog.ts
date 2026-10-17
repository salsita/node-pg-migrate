import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Oracles for the introspection specs. They read the catalogs with their own
// queries and never call the code under test.

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
