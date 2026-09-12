import type { ClientBase, ClientConfig } from 'pg';
import type { Fallback } from '../codegen/fallback';
import type { Logger } from '../logger';
import type { FilenameFormat } from '../migration';

/**
 * Options of `baseline()`.
 */
export interface BaselineOptions {
  /**
   * Connection string or client config of the database to baseline, which is
   * passed to [new pg.Client](https://node-postgres.com/apis/client).
   *
   * Only optional together with `fromFile`: without a connection, the dump is
   * cleaned up without looking at the server (so without checking its
   * migration history).
   */
  readonly databaseUrl?: string | ClientConfig;

  /**
   * Instance of [new pg.Client](https://node-postgres.com/apis/client), as an
   * alternative to `databaseUrl`.
   *
   * It should be connected to the database; `baseline()` never closes it.
   */
  readonly dbClient?: ClientBase;

  /**
   * The directory the baseline migration is written to. It is created if it
   * does not exist, and it must not have any migration yet.
   */
  readonly dir: string;

  /**
   * The name of the migration, after the filename prefix.
   *
   * @default 'baseline'
   */
  readonly name?: string;

  /**
   * The table storing which migrations have been run.
   *
   * @default 'pgmigrations'
   */
  readonly migrationsTable?: string;

  /**
   * The schema storing the table which migrations have been run.
   *
   * (defaults to the first schema of `schema`, else `'public'`)
   */
  readonly migrationsSchema?: string;

  /**
   * The schema(s) on which migrations are run. Defaults `migrationsSchema`
   * the way the runner does, and the baseline creates these schemas with
   * `CREATE SCHEMA IF NOT EXISTS`, because the runner may create them before
   * the baseline runs (`createSchema`).
   *
   * @default 'public'
   */
  readonly schema?: string | string[];

  /**
   * Path to an existing `pg_dump --schema-only` output to clean up, instead of
   * running pg_dump. `'-'` reads it from standard input.
   */
  readonly fromFile?: string;

  /**
   * The pg_dump executable to run when there is no `fromFile`. Its major
   * version must be at least the server's. Not used with `format` `'ts'` or
   * `'js'`, which read the catalogs instead.
   *
   * @default 'pg_dump'
   */
  readonly pgDump?: string;

  /**
   * Only dump these schemas (`pg_dump --schema`). When set, extensions are
   * still dumped with pg_dump 14 or newer (`--extension=*`), and left out
   * with older versions. With `format` `'ts'` or `'js'`, only these schemas
   * are read: extensions are kept whatever their schema, and casts, which
   * belong to no schema, are left out.
   */
  readonly includeSchemas?: ReadonlyArray<string>;

  /**
   * Leave these schemas out of the dump (`pg_dump --exclude-schema`), or out
   * of what `format` `'ts'` or `'js'` reads.
   */
  readonly excludeSchemas?: ReadonlyArray<string>;

  /**
   * How long pg_dump waits for the table locks it needs before it fails
   * (`pg_dump --lock-wait-timeout`), e.g. `'10s'`. Not used with `format`
   * `'ts'` or `'js'`.
   *
   * @default '10s'
   */
  readonly lockWaitTimeout?: string;

  /**
   * Prefix type of the migration filename.
   *
   * @default 'timestamp'
   */
  readonly filenameFormat?: FilenameFormat;

  /**
   * Redirect messages to this logger object, rather than `console`.
   */
  readonly logger?: Logger;

  /**
   * The language of the migration: `'sql'` cleans up a pg_dump output, while
   * `'ts'` and `'js'` (experimental) read the catalogs of the live database
   * and write `pgm` calls, falling back to `pgm.sql(…)` for what the `pgm`
   * operations cannot express. `'ts'` and `'js'` need a connection and
   * cannot be combined with `fromFile`.
   *
   * @default 'sql'
   */
  readonly format?: 'sql' | 'ts' | 'js';

  /**
   * With `format` `'ts'` or `'js'`: fail with `UNSUPPORTED_OBJECTS`, listing
   * every object that would need raw SQL and why, instead of writing a
   * migration with fallbacks.
   *
   * @default false
   */
  readonly strict?: boolean;

  /**
   * With `format` `'ts'` or `'js'`: whether the migrations run with
   * `decamelize` (see `RunnerOption.decamelize`). Then a database whose
   * identifiers decamelize would rename (any with an uppercase letter, e.g.
   * `LegacyCustomer`) is refused with `INVALID_OPTIONS`, since the migration
   * would not create them as they are.
   *
   * @default false
   */
  readonly decamelize?: boolean;
}

/**
 * The baseline migration written by `baseline()`.
 */
export interface BaselineResult {
  /**
   * Absolute path of the written migration file.
   */
  readonly path: string;

  /**
   * The file name without its extension, as the migrations table records it.
   */
  readonly migrationName: string;

  /**
   * The command that records the migration as run without running it, for
   * databases that already have this schema (see `formatFakeCommand()`), e.g.
   * `node-pg-migrate up 1700000000000_baseline --fake`.
   */
  readonly fakeCommand: string;

  /**
   * About how many relations the migration creates in its transaction (see
   * `estimateRelations()`).
   */
  readonly relations: number;

  /**
   * The `max_locks_per_transaction` a blank database needs to run the
   * migration. Only set when it is more than the default of 64 (see
   * `requiredMaxLocksPerTransaction()`).
   */
  readonly requiredMaxLocksPerTransaction?: number;

  /**
   * What the user should know about the migration; each one is also logged
   * as a warning.
   */
  readonly warnings: ReadonlyArray<string>;

  /**
   * Where the schema came from.
   */
  readonly source: DumpSource;

  /**
   * With `format` `'ts'` or `'js'`: the objects the migration creates with
   * raw SQL (`pgm.sql(…)`), in the order of the migration; empty when there
   * are none. Left out with `format` `'sql'`.
   */
  readonly fallbacks?: ReadonlyArray<Fallback>;
}

/**
 * What a top-level slice of a SQL script is (see `scanTopLevel()`):
 *
 * - `statement`: a statement up to and including its terminating `;`, or the
 *   rest of the input when it is not terminated.
 * - `meta`: a psql meta-command line such as `\connect db`, with its newline.
 * - `trivia`: whitespace and comments between statements.
 * - `copy-data`: the data after a `COPY … FROM stdin` statement, up to and
 *   including the `\.` line.
 */
export type SegmentKind = 'statement' | 'meta' | 'trivia' | 'copy-data';

/**
 * A top-level slice of a SQL script (see `scanTopLevel()`).
 */
export interface TopLevelSegment {
  /**
   * What the slice is.
   */
  readonly kind: SegmentKind;

  /**
   * The exact slice of the input.
   */
  readonly text: string;

  /**
   * The offset of the first character of `text` in the input.
   */
  readonly start: number;

  /**
   * The 1-based line of the first character of `text` in the input.
   */
  readonly line: number;
}

/**
 * The name of a database object, optionally qualified with its schema.
 *
 * Both parts are the names PostgreSQL stores, not SQL syntax: no quotes
 * around them and no doubled quotes in them.
 */
export interface QualifiedName {
  /**
   * The schema of the object, when the name is qualified.
   */
  readonly schema?: string;

  /**
   * The name of the object.
   */
  readonly name: string;
}

/**
 * Options of `sanitizeDump()`.
 */
export interface SanitizeOptions {
  /**
   * The schema storing the table which migrations have been run.
   */
  readonly migrationsSchema: string;

  /**
   * The table storing which migrations have been run. The dump must not
   * create it.
   */
  readonly migrationsTable: string;

  /**
   * The sequence of the migrations table's `id` column. The dump must not
   * create it.
   *
   * (defaults to `<migrationsTable>_id_seq` in `migrationsSchema`)
   */
  readonly migrationsSequence?: QualifiedName;

  /**
   * The schemas the runner may create before the baseline runs, besides
   * `migrationsSchema` (which it creates with `createMigrationsSchema`):
   * node-pg-migrate's configured `schema`s (`createSchema`). The dump's
   * `CREATE SCHEMA <s>;` of one of them, or of `migrationsSchema`, becomes
   * `CREATE SCHEMA IF NOT EXISTS <s>;`, so the baseline still runs when the
   * schema already exists.
   *
   * @default []
   */
  readonly createdSchemas?: ReadonlyArray<string>;
}

/**
 * How many objects of each kind a dump creates (see `estimateRelations()`).
 */
export interface DumpStats {
  /**
   * `CREATE [UNLOGGED] TABLE` statements, partitions included.
   */
  readonly tables: number;

  /**
   * `CREATE [UNIQUE] INDEX` statements.
   */
  readonly indexes: number;

  /**
   * `ADD CONSTRAINT … PRIMARY KEY | UNIQUE | EXCLUDE` clauses, which create an
   * index each.
   */
  readonly indexBackedConstraints: number;

  /**
   * `CREATE SEQUENCE` statements and `ADD GENERATED … AS IDENTITY` clauses.
   */
  readonly sequences: number;

  /**
   * `CREATE [OR REPLACE] VIEW` statements.
   */
  readonly views: number;

  /**
   * `CREATE MATERIALIZED VIEW` statements.
   */
  readonly materializedViews: number;
}

/**
 * Where the schema of a baseline came from. Unknown parts are left out.
 */
export interface DumpSource {
  /**
   * The PostgreSQL version of the dumped server, from the dump's
   * `-- Dumped from database version X` comment or the live server.
   */
  readonly serverVersion?: string;

  /**
   * The version of pg_dump, from the dump's `-- Dumped by pg_dump version Y`
   * comment or `pg_dump --version`.
   */
  readonly pgDumpVersion?: string;

  /**
   * The base name of the `fromFile` dump, or `'stdin'` when it was read from
   * standard input.
   */
  readonly file?: string;
}

/**
 * A dump cleaned up by `sanitizeDump()`.
 */
export interface SanitizedDump {
  /**
   * The cleaned-up SQL, without the migration header, ending with a single
   * `\n`.
   */
  readonly sql: string;

  /**
   * How many objects of each kind the dump creates.
   */
  readonly stats: DumpStats;

  /**
   * The versions named in the dump's header comments.
   */
  readonly source: DumpSource;
}

/**
 * What `baseline()` needs to know about the server and the migration history
 * (see `readServerFacts()`).
 */
export interface ServerFacts {
  /**
   * Whether the server is CockroachDB (`version()` contains `CockroachDB`).
   * When it is, the other fields may be defaults.
   */
  readonly isCockroach: boolean;

  /**
   * `SHOW server_version`, cut at the first space, e.g. `'18.6'`.
   */
  readonly version: string;

  /**
   * `server_version_num`, e.g. `180006`.
   */
  readonly versionNum: number;

  /**
   * The server's `max_connections`.
   */
  readonly maxConnections: number;

  /**
   * The server's `max_prepared_transactions`.
   */
  readonly maxPreparedTransactions: number;

  /**
   * Whether the migrations table exists.
   */
  readonly migrationsTableExists: boolean;

  /**
   * How many migrations the migrations table records; `0` when it does not
   * exist.
   */
  readonly recordedMigrations: number;

  /**
   * The sequence of the migrations table's `id` column
   * (`pg_get_serial_sequence(table, 'id')`), when the table exists.
   */
  readonly migrationsSequence?: QualifiedName;
}

/**
 * A pg_dump version (see `parsePgDumpVersion()`).
 */
export interface PgDumpVersion {
  /**
   * The major version, e.g. `18` for `18.6` and for `18beta1`.
   */
  readonly major: number;

  /**
   * The minor version, e.g. `6` for `18.6`. Absent for pre-releases such as
   * `18beta1`.
   */
  readonly minor?: number;

  /**
   * The version as pg_dump prints it after `pg_dump (PostgreSQL) `, trimmed,
   * e.g. `'18.6'` or `'17.2 (Debian 17.2-1.pgdg120+1)'`: the same text a dump
   * names in its `-- Dumped by pg_dump version` comment.
   */
  readonly raw: string;
}

/**
 * What `renderHeader()` writes in the comment header of a baseline migration.
 */
export interface HeaderMeta {
  /**
   * The migration name (the file name without its extension).
   */
  readonly migrationName: string;

  /**
   * The command that records the migration as run without running it (see
   * `formatFakeCommand()`).
   */
  readonly fakeCommand: string;

  /**
   * Where the schema came from.
   */
  readonly source: DumpSource;

  /**
   * How many materialized views the migration creates. When there are any,
   * the header says to refresh them after the first run, since they are
   * created `WITH NO DATA`.
   */
  readonly materializedViews: number;

  /**
   * About how many relations the migration creates (see
   * `estimateRelations()`).
   */
  readonly relations: number;

  /**
   * The `max_locks_per_transaction` a blank database needs to run the
   * migration. Only set when it is more than the default of 64, and then the
   * header says so.
   */
  readonly requiredMaxLocksPerTransaction?: number;
}

/**
 * Options of `buildPgDumpArgs()`.
 */
export interface PgDumpArgsOptions {
  /**
   * The major version of the pg_dump that runs. `--extension` needs 14 or
   * newer.
   */
  readonly pgDumpMajor: number;

  /**
   * Only dump these schemas (`--schema`).
   */
  readonly includeSchemas?: ReadonlyArray<string>;

  /**
   * Leave these schemas out (`--exclude-schema`).
   */
  readonly excludeSchemas?: ReadonlyArray<string>;

  /**
   * Leave these tables and sequences out (`--exclude-table`), e.g. the
   * migrations table and its sequence.
   */
  readonly excludeTables: ReadonlyArray<QualifiedName>;

  /**
   * How long pg_dump waits for table locks (`--lock-wait-timeout`), e.g.
   * `'10s'`.
   */
  readonly lockWaitTimeout: string;
}
