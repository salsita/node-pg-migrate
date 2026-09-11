import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { onTestFinished } from 'vitest';
import { runner } from '../../../src';
import type { Logger } from '../../../src/logger';
import type { RunMigration } from '../../../src/migration';
import { pgDumpShim } from '../../e2e/utils';

/**
 * The messages a {@link RecordingLogger} got, per level.
 */
export interface LoggedMessages {
  readonly debug: string[];
  readonly info: string[];
  readonly warn: string[];
  readonly error: string[];
}

/**
 * A logger that keeps its messages instead of printing them.
 */
export interface RecordingLogger extends Logger {
  /**
   * What the logger got so far.
   */
  readonly messages: LoggedMessages;
}

/**
 * Creates a logger that keeps its messages instead of printing them.
 *
 * @returns The logger.
 */
export function recordingLogger(): RecordingLogger {
  const messages: LoggedMessages = { debug: [], info: [], warn: [], error: [] };

  return {
    messages,
    debug: (message) => {
      messages.debug.push(message);
    },
    info: (message) => {
      messages.info.push(message);
    },
    warn: (message) => {
      messages.warn.push(message);
    },
    error: (message) => {
      messages.error.push(message);
    },
  };
}

/**
 * Creates a temporary directory that is removed when the current test
 * finishes. Call it from inside a test.
 *
 * @returns The absolute path of the new directory.
 */
export async function workDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-baseline-it-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * Writes a `pg_dump` shim that runs the `pg_dump` inside the container (see
 * `pgDumpShim()`), and removes it when the current test finishes. Call it
 * from inside a test.
 *
 * @param container The PostgreSQL container.
 * @param options Optional settings.
 * @param options.reportVersion Makes `pg_dump --version` print
 * `pg_dump (PostgreSQL) <reportVersion>` instead.
 *
 * @returns The path of the shim.
 */
export async function pgDumpShimForTest(
  container: StartedPostgreSqlContainer,
  options: { readonly reportVersion?: string } = {}
): Promise<string> {
  const shim = await pgDumpShim(container, options);
  onTestFinished(async () => {
    await rm(dirname(shim), { recursive: true, force: true });
  });

  return shim;
}

/**
 * Runs a query with the `psql` inside the container.
 *
 * @param container The PostgreSQL container.
 * @param database The database to query.
 * @param sql The query.
 *
 * @returns One line per row, with the columns separated by `|`.
 *
 * @throws Throws an error with `psql`'s output when the query fails.
 */
export async function queryRows(
  container: StartedPostgreSqlContainer,
  database: string,
  sql: string
): Promise<string[]> {
  const res = await container.exec([
    'psql',
    '-X',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '-c',
    sql,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(
      `query failed in database "${database}": ${res.stderr || res.stdout}`
    );
  }

  return res.stdout.split('\n').filter((line) => line.length > 0);
}

/**
 * Dumps the schema of a database the way a user would before
 * `baseline --from-file`: with the `pg_dump` inside the container (so it
 * matches the server) and `--schema-only --no-owner --no-privileges`, plus
 * `args`. Unlike `dumpSchema()`, it returns the output unchanged.
 *
 * @param container The PostgreSQL container.
 * @param database The database to dump.
 * @param args More `pg_dump` arguments.
 *
 * @returns The output of `pg_dump`.
 *
 * @throws Throws an error with `pg_dump`'s output when it fails.
 */
export async function pgDumpText(
  container: StartedPostgreSqlContainer,
  database: string,
  args: ReadonlyArray<string> = []
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
    ...args,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(
      `pg_dump failed for database "${database}": ${res.stderr || res.stdout}`
    );
  }

  return res.stdout;
}

/**
 * Writes the output of {@link pgDumpText} to a file.
 *
 * @param container The PostgreSQL container.
 * @param database The database to dump.
 * @param file Where to write the dump.
 *
 * @returns The dump.
 */
export async function pgDumpFile(
  container: StartedPostgreSqlContainer,
  database: string,
  file: string
): Promise<string> {
  const dump = await pgDumpText(container, database);
  await writeFile(file, dump);

  return dump;
}

/**
 * A version comment in the header of a pg_dump output.
 */
export type DumpVersionComment =
  | 'Dumped from database version'
  | 'Dumped by pg_dump version';

/**
 * Reads a version comment from the header of a pg_dump output.
 *
 * @param dump The pg_dump output.
 * @param comment The comment, e.g. `Dumped from database version`.
 *
 * @returns The version after the comment, e.g. `18.6`.
 *
 * @throws Throws an error when the dump has no such comment.
 */
export function dumpedVersion(
  dump: string,
  comment: DumpVersionComment
): string {
  const prefix = `-- ${comment} `;
  const line = dump.split('\n').find((text) => text.startsWith(prefix));
  if (line === undefined) {
    throw new Error(`the dump has no "${prefix.trim()}" comment`);
  }

  return line.slice(prefix.length).trim();
}

/**
 * Reads the version of the server, the way users see it.
 *
 * @param container The PostgreSQL container.
 *
 * @returns `SHOW server_version`, cut at the first space, e.g. `18.6`.
 */
export async function serverVersion(
  container: StartedPostgreSqlContainer
): Promise<string> {
  const [version] = await queryRows(
    container,
    container.getDatabase(),
    'SHOW server_version'
  );

  return version.split(' ')[0];
}

/**
 * Reads the version of the `pg_dump` inside the container.
 *
 * @param container The PostgreSQL container.
 *
 * @returns What `pg_dump --version` prints after `pg_dump (PostgreSQL) `,
 * e.g. `18.6`.
 *
 * @throws Throws an error when `pg_dump --version` fails.
 */
export async function containerPgDumpVersion(
  container: StartedPostgreSqlContainer
): Promise<string> {
  const res = await container.exec(['pg_dump', '--version']);
  if (res.exitCode !== 0) {
    throw new Error(`pg_dump --version failed: ${res.stderr || res.stdout}`);
  }

  return res.stdout.replace('pg_dump (PostgreSQL) ', '').trim();
}

/**
 * Lists the files in a directory.
 *
 * @param dir The directory.
 *
 * @returns The file names, sorted; none when the directory doesn't exist.
 */
export async function listFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).toSorted();
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

/**
 * Waits for a promise that is expected to reject.
 *
 * @param promise The promise.
 *
 * @returns What it rejected with, or what it resolved to, so that an
 * assertion about the error fails with that value.
 */
export function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

/**
 * Names a migration that sorts right after another one.
 *
 * @param previous The name of the other migration, e.g. `1700000000000_baseline`.
 * @param name What the new migration is called, after its prefix.
 *
 * @returns The other migration's numeric prefix plus one, then `_<name>`,
 * e.g. `1700000000001_<name>`.
 *
 * @throws Throws an error when `previous` has no numeric prefix.
 */
export function nextMigrationName(previous: string, name: string): string {
  const prefix = /^\d+/.exec(previous)?.[0];
  if (prefix === undefined) {
    throw new Error(`"${previous}" has no numeric prefix`);
  }

  return `${String(BigInt(prefix) + 1n)}_${name}`;
}

/**
 * Writes an SQL migration with an up migration only.
 *
 * @param dir The migrations directory.
 * @param name The migration name (the file name without `.sql`).
 * @param statements The SQL of the up migration.
 *
 * @returns A promise that resolves once the file is written.
 */
export async function writeSqlMigration(
  dir: string,
  name: string,
  statements: ReadonlyArray<string>
): Promise<void> {
  await writeFile(
    join(dir, `${name}.sql`),
    ['-- Up Migration', ...statements, ''].join('\n')
  );
}

/**
 * Options of {@link migrateUp}.
 */
export interface MigrateUpOptions {
  /**
   * Record the migrations without running them (`--fake`).
   */
  readonly fake?: boolean;

  /**
   * Only run this migration (`up <name>`).
   */
  readonly file?: string;

  /**
   * The schema the runner sets the search path to.
   */
  readonly schema?: string;

  /**
   * The migrations table.
   *
   * @default 'pgmigrations'
   */
  readonly migrationsTable?: string;
}

/**
 * Runs `node-pg-migrate up` in process, in one transaction like the CLI does
 * by default, without printing anything.
 *
 * @param databaseUrl The database.
 * @param dir The migrations directory.
 * @param options More runner options.
 *
 * @returns The migrations that ran.
 */
export function migrateUp(
  databaseUrl: string,
  dir: string,
  options: MigrateUpOptions = {}
): Promise<RunMigration[]> {
  return runner({
    databaseUrl,
    dir,
    direction: 'up',
    migrationsTable: options.migrationsTable ?? 'pgmigrations',
    singleTransaction: true,
    fake: options.fake,
    file: options.file,
    schema: options.schema,
    logger: recordingLogger(),
  });
}
