import { basename } from 'node:path';
import type { ClientBase, ClientConfig } from 'pg';
import type { OutputLanguage } from '../codegen/types';
import type { Logger } from '../logger';
import type { FilenameFormat } from '../migration';
import { quoteShellWord } from './core/fakeCommand';
import { toPgDumpPattern } from './core/identifiers';
import { buildPgDumpArgs } from './core/pgDumpArgs';
import type { CatalogSettings, SchemaSettings } from './core/plan';
import {
  assertNoEmptyOption,
  assertSafeMigrationName,
  invalidOptions,
  resolveCatalogSettings,
  resolveSchemaSettings,
} from './core/plan';
import type { InstalledExtension } from './io/server';
import type { BaselineOptions, PgDumpVersion, QualifiedName } from './types';

export {
  assertCanBaseline,
  assertDecamelizeKeepsNames,
  fallbackWarnings,
  locksNeeded,
  migrationsObjects,
} from './core/plan';

// What `baseline()` decides from its options and from what it reads, without
// any I/O of its own. What a TypeScript or JavaScript baseline needs of it is
// in `core/plan.ts`, without Node.js, so that the Node.js-free entry
// (`src/baseline/catalogs.ts`) decides the same; this module re-exports it.

/**
 * The first pg_dump version with `--extension`.
 */
const EXTENSION_OPTION_MAJOR = 14;

/**
 * What `buildPgDumpArgs()` adds with included schemas, so that pg_dump still
 * dumps the extensions.
 */
const ALL_EXTENSIONS = '--extension=*';

/**
 * The schemas every database has, so that an extension in one of them can be
 * created on a blank database even when the schema is not dumped.
 */
const BUILT_IN_SCHEMAS: ReadonlySet<string> = new Set(['public', 'pg_catalog']);

/**
 * Options whose value must not be an empty string.
 */
const NON_EMPTY_OPTIONS = [
  'dir',
  'name',
  'migrationsTable',
  'migrationsSchema',
  'fromFile',
  'pgDump',
  'lockWaitTimeout',
] as const;

/**
 * The languages a baseline can be written in (`format`).
 */
const FORMATS: ReadonlySet<string> = new Set(['sql', 'ts', 'js']);

/**
 * A database to connect to: a caller-provided client (`dbClient`), or a
 * connection string or client config (`databaseUrl`).
 */
export type Connection = ClientBase | string | ClientConfig;

/**
 * Cleans up an existing pg_dump output.
 */
export interface FileDumpPlan {
  readonly kind: 'file';

  /**
   * The dump, or `'-'` for standard input.
   */
  readonly path: string;

  /**
   * How the baseline names the dump: its base name, or `'stdin'`.
   */
  readonly label: string;

  /**
   * The database whose migration history to check, if any.
   */
  readonly connection?: Connection;
}

/**
 * Runs pg_dump against the database.
 */
export interface PgDumpPlan {
  readonly kind: 'pg_dump';

  /**
   * The database, for its facts and for pg_dump.
   */
  readonly connection: string | ClientConfig;

  /**
   * The pg_dump executable.
   */
  readonly bin: string;

  readonly includeSchemas: ReadonlyArray<string>;
  readonly excludeSchemas: ReadonlyArray<string>;
  readonly lockWaitTimeout: string;
}

/**
 * Reads the catalogs of the database and writes `pgm` calls (`format` `ts` or
 * `js`).
 */
export interface CatalogPlan extends CatalogSettings {
  readonly kind: 'catalogs';

  /**
   * The database to read.
   */
  readonly connection: Connection;
}

/**
 * The options of `baseline()`, checked, with their defaults.
 */
export interface BaselineSettings extends SchemaSettings {
  readonly dir: string;
  readonly name: string;
  readonly filenameFormat: FilenameFormat;
  readonly logger: Logger;

  /**
   * Where the schema comes from: a dump or pg_dump for a SQL migration, the
   * catalogs for a TypeScript or JavaScript one.
   */
  readonly dump: FileDumpPlan | PgDumpPlan | CatalogPlan;
}

/**
 * Where the schema comes from: the dump file, or pg_dump.
 *
 * @param options The options of `baseline()`.
 */
function dumpPlan(options: BaselineOptions): FileDumpPlan | PgDumpPlan {
  const { fromFile, databaseUrl, dbClient } = options;
  const includeSchemas = options.includeSchemas ?? [];
  const excludeSchemas = options.excludeSchemas ?? [];

  if (fromFile !== undefined) {
    if (includeSchemas.length + excludeSchemas.length > 0) {
      throw invalidOptions(
        '--include-schema and --exclude-schema only apply when baseline runs pg_dump. With --from-file, pass --schema or --exclude-schema to pg_dump when you make the dump.'
      );
    }

    return {
      kind: 'file',
      path: fromFile,
      label: fromFile === '-' ? 'stdin' : basename(fromFile),
      connection: dbClient ?? databaseUrl,
    };
  }

  if (databaseUrl === undefined) {
    throw invalidOptions(
      dbClient === undefined
        ? 'Nothing to make a baseline from: pass a database connection (databaseUrl) to run pg_dump, or the output of pg_dump --schema-only (fromFile).'
        : 'Running pg_dump needs databaseUrl, since pg_dump cannot use dbClient. Pass databaseUrl, or run pg_dump --schema-only yourself and pass its output (fromFile).'
    );
  }

  return {
    kind: 'pg_dump',
    connection: databaseUrl,
    bin: options.pgDump ?? 'pg_dump',
    includeSchemas,
    excludeSchemas,
    lockWaitTimeout: options.lockWaitTimeout ?? '10s',
  };
}

/**
 * Reads the catalogs of the database for a TypeScript or JavaScript
 * migration, which needs a live connection and no dump.
 *
 * @param options The options of `baseline()`.
 * @param language The language of the migration.
 */
function catalogPlan(
  options: BaselineOptions,
  language: OutputLanguage
): CatalogPlan {
  if (options.fromFile !== undefined) {
    throw invalidOptions(
      `--format ${language} reads the schema from the catalogs of a live database, so it cannot use a dump file with --from-file. To use --format ${language} with this dump, load it into a scratch database (createdb scratch && psql -d scratch -f ${quoteShellWord(options.fromFile)}) and run baseline against that database. To clean up the dump as a SQL baseline, use --format sql.`
    );
  }

  const connection = options.dbClient ?? options.databaseUrl;
  if (connection === undefined) {
    throw invalidOptions(
      `--format ${language} reads the schema from the catalogs of a live database: pass a database connection (databaseUrl or dbClient).`
    );
  }

  return {
    kind: 'catalogs',
    ...resolveCatalogSettings(options, language),
    connection,
  };
}

/**
 * Where the schema comes from, for the language of the migration.
 *
 * @param options The options of `baseline()`.
 */
function sourcePlan(
  options: BaselineOptions
): FileDumpPlan | PgDumpPlan | CatalogPlan {
  const format = options.format ?? 'sql';
  if (!FORMATS.has(format)) {
    throw invalidOptions(`format must be sql, ts or js, not ${format}.`);
  }

  if (format !== 'sql') {
    return catalogPlan(options, format);
  }

  if (options.strict === true) {
    throw invalidOptions(
      '--strict only applies to --format ts and --format js, which fall back to raw SQL for what pgm calls cannot express: a --format sql baseline is all SQL.'
    );
  }

  return dumpPlan(options);
}

/**
 * Checks the options of `baseline()` and applies their defaults.
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS` when they are
 * incomplete or contradict each other.
 *
 * @param options The options of `baseline()`.
 */
export function resolveSettings(options: BaselineOptions): BaselineSettings {
  assertNoEmptyOption(options, NON_EMPTY_OPTIONS);
  const name = options.name ?? 'baseline';
  assertSafeMigrationName(name);
  if (options.databaseUrl !== undefined && options.dbClient !== undefined) {
    throw invalidOptions('Pass either databaseUrl or dbClient, not both.');
  }

  return {
    dir: options.dir,
    name,
    filenameFormat: options.filenameFormat ?? 'timestamp',
    ...resolveSchemaSettings(options),
    logger: options.logger ?? console,
    dump: sourcePlan(options),
  };
}

/**
 * The pg_dump arguments of a baseline (see `buildPgDumpArgs()`), without the
 * migrations table and its sequence.
 *
 * pg_dump creates an extension `WITH SCHEMA` its schema, which a blank
 * database only has when the baseline creates it too, or when it is `public`
 * or `pg_catalog`:
 *
 * - With included schemas, pg_dump 14+ gets `--extension` for the extensions
 *   in such schemas only, and a warning names the ones left out. Older
 *   pg_dumps cannot dump extensions together with included schemas at all,
 *   and a warning says so.
 * - Without, pg_dump dumps every extension, even one in an excluded schema,
 *   and a warning names those.
 *
 * @param options What to dump.
 * @returns The arguments, and what the user should know about them.
 */
export function pgDumpArguments(options: {
  /**
   * The pg_dump that runs.
   */
  readonly pgDump: PgDumpVersion;

  /**
   * What to dump.
   */
  readonly plan: PgDumpPlan;

  /**
   * The migrations table and its sequence.
   */
  readonly migrations: {
    readonly table: QualifiedName;
    readonly sequence: QualifiedName;
  };

  /**
   * The extensions of the database. Only needed with included or excluded
   * schemas.
   */
  readonly extensions: ReadonlyArray<InstalledExtension>;
}): { readonly args: string[]; readonly warnings: string[] } {
  const { pgDump, plan, migrations, extensions } = options;
  const { includeSchemas, excludeSchemas } = plan;
  const args = buildPgDumpArgs({
    pgDumpMajor: pgDump.major,
    includeSchemas,
    excludeSchemas,
    excludeTables: [migrations.table, migrations.sequence],
    lockWaitTimeout: plan.lockWaitTimeout,
  });
  const onBlankDatabase = (schema: string): boolean =>
    BUILT_IN_SCHEMAS.has(schema) ||
    ((includeSchemas.length === 0 || includeSchemas.includes(schema)) &&
      !excludeSchemas.includes(schema));
  const stranded = extensions
    .filter(({ schema }) => !onBlankDatabase(schema))
    .map(({ name, schema }) => `${name} (in schema ${schema})`)
    .join(', ');

  if (includeSchemas.length === 0) {
    return {
      args,
      warnings:
        stranded === ''
          ? []
          : [
              `pg_dump still creates the extension(s) ${stranded} in the schema(s) that --exclude-schema leaves out: blank databases need those schemas before they run the baseline.`,
            ],
    };
  }

  if (pgDump.major < EXTENSION_OPTION_MAJOR) {
    return {
      args,
      warnings: [
        `pg_dump ${pgDump.raw} cannot dump extensions together with --include-schema (that needs pg_dump ${EXTENSION_OPTION_MAJOR} or newer), so the baseline creates no extension: create them on blank databases before you run it, or use a newer pg_dump.`,
      ],
    };
  }

  return {
    args: args.flatMap((arg) =>
      arg === ALL_EXTENSIONS
        ? extensions
            .filter(({ schema }) => onBlankDatabase(schema))
            .map(({ name }) => `--extension=${toPgDumpPattern({ name })}`)
        : [arg]
    ),
    warnings:
      stranded === ''
        ? []
        : [
            `--include-schema leaves out the extension(s) ${stranded}, since blank databases would not have their schema(s). If the baseline needs them, include their schema(s) too.`,
          ],
  };
}
