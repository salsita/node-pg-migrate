import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { exec as processExec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

/**
 * List of PostgreSQL versions to be used in integration tests.
 *
 * Reads from the `PGM_VERSIONS` environment variable or defaults to ['18'].
 */
export const PG_VERSIONS = (process.env.PGM_VERSIONS ?? '18')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

export const INTEGRATION_TIMEOUT = Number(
  process.env.INTEGRATION_TIMEOUT ?? 30_000
);

/**
 * Promisified version of Node.js `child_process.exec` for running shell commands asynchronously.
 */
// `exec` returns a `ChildProcess` instead of `void`, which is the documented
// Node.js signature `promisify` is designed to consume.
// oxlint-disable-next-line typescript/strict-void-return
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
  /^\(node:\d+\) ExperimentalWarning: Importing JSON modules is an experimental feature and might change at any time$/,
  /^\(node:\d+\) DeprecationWarning: Calling client\.query\(\) when the client is already executing a query is deprecated and will be removed in pg@9\.0\. Use async\/await or an external async flow control mechanism instead\.$/,
  /^\(Use `node --trace-deprecation \.\.\.` to show where the warning was created\)$/,
  /^\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)$/,
] as const;

/**
 * Filters out lines from the given output that match any pattern from the predefined ignored log patterns.
 *
 * @param output The multiline string output to filter.
 * @param ignorePatterns An array of regular expressions to match lines that should be ignored. Defaults to `IGNORE_LOG_PATTERNS`.
 *
 * @return A string containing only the lines that do not match the ignored log patterns.
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
 * Starts a PostgreSQL container for integration testing.
 *
 * @param containerImage The Docker image to use for the PostgreSQL container.
 * @param databaseName The name of the database to create in the container. Defaults to 'node_pg_migrate'.
 *
 * @returns A started PostgreSqlContainer instance.
 */
export async function setupPostgresDatabase(
  containerImage: string,
  databaseName: string = 'node_pg_migrate'
): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(containerImage)
    .withUsername('ubuntu')
    .withPassword('ubuntu')
    .withDatabase(databaseName)
    .start();
}

/**
 * Executes a SQL command on the provided PostgreSQL container.
 *
 * @param pgContainer The PostgreSQL container instance to execute the command on.
 * @param sql The SQL command to be executed.
 *
 * @returns A promise that resolves when the SQL command is successfully executed.
 *
 * @throws Throws an error if the SQL command execution fails. The error includes the failed SQL command and any output indicating the failure.
 */
async function execSql(
  pgContainer: StartedPostgreSqlContainer,
  sql: string
): Promise<void> {
  const res = await pgContainer.exec([
    'psql',
    '-U',
    'ubuntu',
    '-d',
    pgContainer.getDatabase(),
    '-c',
    sql,
  ]);

  if (res.exitCode !== 0) {
    throw new Error(`Failed to execute SQL command: ${sql}`, {
      cause: res.stderr || res.stdout,
    });
  }
}

/**
 * Runs a `SELECT` on the provided PostgreSQL container and returns the values of the first
 * column, one per row.
 *
 * @param pgContainer The PostgreSQL container instance to query.
 * @param sql The `SELECT` statement to run.
 *
 * @returns The values of the first column of every returned row.
 *
 * @throws Throws an error if the query fails.
 */
export async function psqlSelect(
  pgContainer: StartedPostgreSqlContainer,
  sql: string
): Promise<string[]> {
  const res = await pgContainer.exec([
    'psql',
    '-U',
    pgContainer.getUsername(),
    '-d',
    pgContainer.getDatabase(),
    '-At',
    '-c',
    sql,
  ]);

  if (res.exitCode !== 0) {
    throw new Error(`Failed to execute SQL command: ${sql}`, {
      cause: res.stderr || res.stdout,
    });
  }

  return res.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Cleans and removes all unnecessary or redundant objects and data from the public schema in the database.
 *
 * It ensures that the public schema is entirely reset to a clean state, except for system or default roles and objects.
 *
 * @param pgContainer
 *
 * @return A promise that resolves when the database garbage cleanup is completed successfully.
 */
export async function cleanupDatabase(
  pgContainer: StartedPostgreSqlContainer
): Promise<void> {
  // Drop all non-system schemas except 'public'
  await execSql(
    pgContainer,
    `
    DO $$
    DECLARE schema_rec RECORD;
    BEGIN
      FOR schema_rec IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('public', 'information_schema')
          AND schema_name NOT LIKE 'pg_%'
      LOOP
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_rec.schema_name);
      END LOOP;
    END $$;
  `
  );

  // Drop all objects in the public schema
  await execSql(
    pgContainer,
    `
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
      FOR obj IN SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'c' LOOP
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
  `
  );

  // Drop all custom roles except system/default
  await execSql(
    pgContainer,
    `
    DO $$
    DECLARE role_rec RECORD;
    BEGIN
      FOR role_rec IN
        SELECT rolname
        FROM pg_roles
        WHERE rolname NOT IN (
                              'postgres', 'pg_signal_backend', 'pg_read_all_data', 'pg_write_all_data', 'pg_monitor',
                              'pg_read_all_settings', 'pg_read_all_stats', 'pg_stat_scan_tables', 'pg_database_owner',
                              'pg_read_server_files', 'pg_write_server_files', 'pg_execute_server_program'
          )
          AND rolname NOT LIKE 'pg\\_%'
          AND rolname <> current_user
      LOOP
        EXECUTE format('DROP ROLE IF EXISTS %I', role_rec.rolname);
      END LOOP;
    END $$;
  `
  );

  // Drop all custom types in the public schema
  await execSql(
    pgContainer,
    `
    DO $$
    DECLARE type_rec RECORD;
    BEGIN
      FOR type_rec IN
        SELECT typname
        FROM pg_type
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
          AND typtype IN ('c', 'e', 'd')
          AND typname NOT LIKE 'pg\\_%'
      LOOP
        EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', type_rec.typname);
      END LOOP;
    END $$;
  `
  );
}

/**
 * A schema fixture: a directory in `test/fixtures/schemas` whose `*.sql` files
 * {@link loadFixture} loads in file name order.
 */
export type SchemaFixture = 'pagila' | 'chinook' | 'kitchen-sink';

/**
 * Every schema fixture.
 */
export const SCHEMA_FIXTURES: ReadonlyArray<SchemaFixture> = [
  'pagila',
  'chinook',
  'kitchen-sink',
];

const SCHEMA_FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/schemas');

/**
 * A first line like `-- requires: 18` marks a fixture file that only loads on
 * that PostgreSQL major version or later.
 */
const REQUIRES_LINE = /^-- requires: (\d+)\s*$/;

/**
 * Quotes an SQL identifier.
 *
 * @param name The identifier.
 *
 * @returns The identifier in double quotes, with inner double quotes doubled.
 */
function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Runs `psql` inside the container, connected to the given database through
 * the local socket, and stops at the first error.
 *
 * @param container The PostgreSQL container.
 * @param database The database to connect to.
 * @param args More `psql` arguments, e.g. `['-c', sql]`.
 *
 * @returns What `psql` printed on stdout.
 *
 * @throws Throws an error with `psql`'s output when it exits with a non-zero
 * code.
 */
async function psql(
  container: StartedPostgreSqlContainer,
  database: string,
  args: ReadonlyArray<string>
): Promise<string> {
  const res = await container.exec([
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    ...args,
  ]);

  if (res.exitCode !== 0) {
    throw new Error(
      `psql failed in database "${database}": ${res.stderr || res.stdout}`
    );
  }

  return res.stdout;
}

/**
 * Creates a database in the container.
 *
 * @param container The PostgreSQL container.
 * @param name The name of the new database, used as is (it gets quoted).
 *
 * @returns A promise that resolves once the database exists.
 *
 * @throws Throws an error if `CREATE DATABASE` fails, e.g. when the database
 * already exists.
 */
export async function createDatabase(
  container: StartedPostgreSqlContainer,
  name: string
): Promise<void> {
  await psql(container, container.getDatabase(), [
    '-c',
    `CREATE DATABASE ${quoteIdent(name)}`,
  ]);
}

/**
 * Runs an SQL script in a database with `psql -v ON_ERROR_STOP=1 -f`.
 *
 * The script is copied into the container first, so it can be of any size
 * (arguments of `psql -c` are limited) and may contain psql meta-commands such
 * as the `\restrict` lines of recent `pg_dump` output.
 *
 * @param container The PostgreSQL container.
 * @param database The database to run the script in.
 * @param sql The SQL script.
 *
 * @returns A promise that resolves once the whole script ran.
 *
 * @throws Throws an error with `psql`'s output at the first failing statement.
 */
export async function loadSql(
  container: StartedPostgreSqlContainer,
  database: string,
  sql: string
): Promise<void> {
  const target = `/tmp/pgm-load-${randomUUID()}.sql`;
  await container.copyContentToContainer([{ content: sql, target }]);
  try {
    await psql(container, database, ['-q', '-f', target]);
  } finally {
    await container.exec(['rm', '-f', target]);
  }
}

/**
 * Builds a connection URL for a database in the container, reachable from the
 * host.
 *
 * @param container The PostgreSQL container.
 * @param database The database name.
 *
 * @returns A URL like `postgres://user:password@host:mappedPort/database`.
 */
export function databaseUrl(
  container: StartedPostgreSqlContainer,
  database: string
): string {
  const user = encodeURIComponent(container.getUsername());
  const password = encodeURIComponent(container.getPassword());

  return `postgres://${user}:${password}@${container.getHost()}:${container.getPort()}/${encodeURIComponent(database)}`;
}

/**
 * The comment-only entry that `pg_dump` 15+ writes, even with `--no-owner`,
 * for a `public` schema whose owner isn't the default `pg_database_owner`,
 * blank lines included.
 */
const PUBLIC_SCHEMA_ENTRY: ReadonlyArray<string> = [
  '--',
  '-- Name: public; Type: SCHEMA; Schema: -; Owner: -',
  '--',
  '',
  '-- *not* creating schema, since initdb creates it',
  '',
  '',
];

/**
 * Dumps the schema of a database for comparisons, with the `pg_dump` inside
 * the container, so it always matches the server version.
 *
 * It runs `pg_dump --schema-only --no-owner --no-privileges` without the
 * default migrations table (`public.pgmigrations`) and its sequence. It
 * doesn't use the code under test. It only drops what differs between dumps of
 * identical schemas:
 *
 * - the `\restrict` and `\unrestrict` lines, which have random keys;
 * - the `-- Dumped from database version` and `-- Dumped by pg_dump version`
 *   comments;
 * - the comment-only entry for the `public` schema (`-- *not* creating schema,
 *   since initdb creates it`, with its `-- Name: public; Type: SCHEMA` header
 *   and blank lines). `pg_dump` 15+ writes it only when `public` isn't owned by
 *   `pg_database_owner`, e.g. in databases that started on PostgreSQL 14 or
 *   earlier, or after Pagila's `ALTER SCHEMA public OWNER TO postgres`. It is
 *   ownership leaking into `--no-owner` output. Baselines leave owners out, so
 *   this entry would otherwise make a database and one built from its baseline
 *   compare unequal.
 *
 * @param container The PostgreSQL container.
 * @param database The database to dump.
 *
 * @returns The dump without those lines.
 *
 * @throws Throws an error with `pg_dump`'s output if it fails.
 */
export async function dumpSchema(
  container: StartedPostgreSqlContainer,
  database: string
): Promise<string> {
  const res = await container.exec([
    'pg_dump',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    '--exclude-table="public"."pgmigrations"',
    '--exclude-table="public"."pgmigrations_id_seq"',
  ]);

  if (res.exitCode !== 0) {
    throw new Error(
      `pg_dump failed for database "${database}": ${res.stderr || res.stdout}`
    );
  }

  const lines = res.stdout
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('\\restrict ') &&
        !line.startsWith('\\unrestrict ') &&
        !line.startsWith('-- Dumped from database version ') &&
        !line.startsWith('-- Dumped by pg_dump version ')
    );

  const publicEntry = lines.findIndex((_, start) =>
    PUBLIC_SCHEMA_ENTRY.every((line, offset) => lines[start + offset] === line)
  );
  if (publicEntry !== -1) {
    lines.splice(publicEntry, PUBLIC_SCHEMA_ENTRY.length);
  }

  return lines.join('\n');
}

/**
 * Creates a role unless it already exists, the way a restore needs the roles
 * that a dump refers to.
 *
 * @param container The PostgreSQL container.
 * @param role The role name, used as is (it gets quoted).
 *
 * @returns A promise that resolves once the role exists.
 */
export async function ensureRole(
  container: StartedPostgreSqlContainer,
  role: string
): Promise<void> {
  const literal = `'${role.replaceAll("'", "''")}'`;
  await psql(container, container.getDatabase(), [
    '-c',
    `DO $pgm$
BEGIN
  EXECUTE format('CREATE ROLE %I', ${literal});
EXCEPTION
  WHEN duplicate_object OR unique_violation THEN NULL;
END
$pgm$`,
  ]);
}

/**
 * Returns the major version of the server, e.g. `18`.
 *
 * @param container The PostgreSQL container.
 *
 * @returns The major version.
 */
async function serverMajor(
  container: StartedPostgreSqlContainer
): Promise<number> {
  const versionNum = await psql(container, container.getDatabase(), [
    '-At',
    '-c',
    'SHOW server_version_num',
  ]);

  return Math.floor(Number(versionNum.trim()) / 10_000);
}

/**
 * Loads a schema fixture from `test/fixtures/schemas/<fixture>` into a
 * database: its `*.sql` files, one {@link loadSql} each, in file name order.
 *
 * A file whose first line is `-- requires: <major>` is skipped on servers
 * older than that major version. Pagila's dump refers to the role `postgres`,
 * so that role is created first when it doesn't exist, the way a real restore
 * needs its roles. Nothing else is changed: Pagila leaves `public` owned by
 * `postgres`, see {@link dumpSchema}.
 *
 * @param container The PostgreSQL container.
 * @param database The database to load the fixture into, e.g. a new one from
 * {@link createDatabase}.
 * @param fixture The fixture.
 *
 * @returns A promise that resolves once every file is loaded.
 *
 * @throws Throws an error with `psql`'s output if a file fails to load.
 */
export async function loadFixture(
  container: StartedPostgreSqlContainer,
  database: string,
  fixture: SchemaFixture
): Promise<void> {
  if (fixture === 'pagila') {
    await ensureRole(container, 'postgres');
  }

  const dir = join(SCHEMA_FIXTURES_DIR, fixture);
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql'));
  files.sort();

  const major = await serverMajor(container);
  for (const file of files) {
    const sql = await readFile(join(dir, file), 'utf8');
    const requires = REQUIRES_LINE.exec(sql.split('\n', 1)[0]);
    if (requires !== null && Number(requires[1]) > major) {
      continue;
    }

    await loadSql(container, database, sql);
  }
}
