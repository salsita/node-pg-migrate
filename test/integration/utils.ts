import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec as processExec } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'pg';

/**
 * List of PostgreSQL versions to be used in integration tests.
 * Reads from the `PGM_VERSIONS` environment variable or defaults to ['17'].
 */
export const PG_VERSIONS = (process.env.PGM_VERSIONS ?? '17')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

export const INTEGRATION_TIMEOUT = Number(
  process.env.INTEGRATION_TIMEOUT ?? 20_000
);
/**
 * Promisified version of Node.js `child_process.exec` for running shell commands asynchronously.
 */
export const exec = promisify(processExec);

/**
 * Array of regular expressions for log patterns to ignore during test output filtering.
 * - The first pattern ignores warnings about reading config files with unresolved environment variables (e.g., NPM_TOKEN in .npmrc).
 * - The second pattern ignores unstable log output from `getNumericPrefix` used in sorting, which is non-deterministic.
 * - The third pattern ignores logs from `dotenv` when it injects environment variables from a `.env` file.
 */
export const IGNORE_LOG_PATTERNS = [
  /WARN.*Issue while reading .*\. Failed to replace env in config: /,
  /^Can't determine timestamp for \d{3}$/,
  /^\s*\[dotenv@[\d.]+] injecting .* from .+$/i,
] as const;

/**
 * Filters out lines from the given output that match any pattern from the predefined ignored log patterns.
 *
 * @param {string} output - The multiline string output to filter.
 * @param ignorePatterns - An array of regular expressions to match lines that should be ignored. Defaults to `IGNORE_LOG_PATTERNS`.
 * @return {string} - A string containing only the lines that do not match the ignored log patterns.
 */
export function filterIgnoredLines(
  output: string,
  ignorePatterns: ReadonlyArray<RegExp> = IGNORE_LOG_PATTERNS
): string {
  return output
    .split('\n')
    .filter(
      (line) => !ignorePatterns.some((pattern) => pattern.test(line.trim()))
    )
    .join('\n');
}

/**
 * Starts a PostgresSQL container for integration testing.
 * @param containerImage The Docker image to use for the PostgresSQL container.
 * @param databaseName The name of the database to create in the container. Defaults to 'node_pg_migrate'.
 * @returns A started PostgresSqlContainer instance.
 */
export async function setupPostgresDatabase(
  containerImage: string,
  databaseName: string = 'node_pg_migrate'
): Promise<StartedPostgreSqlContainer> {
  return await new PostgreSqlContainer(containerImage)
    .withUsername('ubuntu')
    .withPassword('ubuntu')
    .withDatabase(databaseName)
    .start();
}

/**
 * Cleans and removes all unnecessary or redundant objects and data from the public schema in the database.
 * It ensures that the public schema is entirely reset to a clean state, except for system or default roles and objects.
 *
 * @param {string} connectionString - The connection string used to connect to the database.
 * @return {Promise<void>} A promise that resolves when the database garbage cleanup is completed successfully.
 */
export async function cleanupDatabase(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  // Drop all non-system schemas except 'public'
  const { rows: schemas } = await client.query(`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('public', 'information_schema')
      AND schema_name NOT LIKE 'pg_%'
  `);
  for (const { schema_name } of schemas) {
    await client.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE;`);
  }

  // Drop all objects in the public schema
  await client.query(`
    DO $$
    DECLARE obj RECORD;
    BEGIN
      FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(obj.tablename) || ' CASCADE';
      END LOOP;
      FOR obj IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(obj.sequencename) || ' CASCADE';
      END LOOP;
      FOR obj IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public' LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(obj.table_name) || ' CASCADE';
      END LOOP;
      FOR obj IN SELECT typname FROM pg_type WHERE typnamespace = '2200' AND typtype = 'c' LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(obj.typname) || ' CASCADE';
      END LOOP;
      FOR obj IN SELECT routine_name, specific_name
                 FROM information_schema.routines
                 WHERE routine_schema = 'public' LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(obj.routine_name) || '(' ||
          pg_get_function_identity_arguments(obj.specific_name::regprocedure) || ') CASCADE';
      END LOOP;
      FOR obj IN SELECT domain_name FROM information_schema.domains WHERE domain_schema = 'public' LOOP
        EXECUTE 'DROP DOMAIN IF EXISTS public.' || quote_ident(obj.domain_name) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  // Drop all custom roles except system/default
  const { rows: roles } = await client.query(`
    SELECT rolname
    FROM pg_roles
    WHERE rolname NOT IN (
                          'postgres', 'pg_signal_backend', 'pg_read_all_data', 'pg_write_all_data', 'pg_monitor',
                          'pg_read_all_settings', 'pg_read_all_stats', 'pg_stat_scan_tables', 'pg_database_owner',
                          'pg_read_server_files', 'pg_write_server_files', 'pg_execute_server_program'
      )
      AND rolname NOT LIKE 'pg\\_%'
      AND rolname <> current_user
  `);
  for (const { rolname } of roles) {
    await client.query(`DROP ROLE IF EXISTS "${rolname}";`);
  }

  // Drop all custom types in the public schema
  const { rows: types } = await client.query(`
    SELECT typname
    FROM pg_type
    WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND typtype IN ('c', 'e', 'd')
      AND typname NOT LIKE 'pg\\_%'
  `);
  for (const { typname } of types) {
    await client.query(`DROP TYPE IF EXISTS public."${typname}" CASCADE;`);
  }

  await client.end();
}
