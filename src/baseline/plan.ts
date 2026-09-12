import { basename } from 'node:path';
import type { ClientBase, ClientConfig } from 'pg';
import { usesCreateFunction } from '../codegen/emitters/functions';
import { makeObjectName } from '../codegen/sql';
import type { OutputLanguage } from '../codegen/types';
import type { SchemaModel } from '../introspect/types';
import type { Logger } from '../logger';
import type { FilenameFormat } from '../migration';
import { decamelize, getSchemas, quote } from '../utils';
import { quoteShellWord } from './core/fakeCommand';
import { toPgDumpPattern } from './core/identifiers';
import {
  DEFAULT_MAX_LOCKS_PER_TRANSACTION,
  requiredMaxLocksPerTransaction,
} from './core/locks';
import { buildPgDumpArgs } from './core/pgDumpArgs';
import { BaselineError } from './errors';
import type { InstalledExtension } from './io/server';
import type {
  BaselineOptions,
  PgDumpVersion,
  QualifiedName,
  ServerFacts,
} from './types';

// What `baseline()` decides from its options and from what it reads, without
// any I/O of its own.

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
 * Characters that a migration name cannot have: it becomes a file name and an
 * argument of the printed `up … --fake` command.
 */
const UNSAFE_NAME = /[\s/\\]/;

/**
 * The languages a baseline can be written in (`format`).
 */
const FORMATS: ReadonlySet<string> = new Set(['sql', 'ts', 'js']);

/**
 * How many identifiers the decamelize refusal names before it only counts
 * the rest.
 */
const LISTED_IDENTIFIERS = 10;

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
  readonly connection?: ClientBase | string | ClientConfig;
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
export interface CatalogPlan {
  readonly kind: 'catalogs';

  /**
   * The language of the migration.
   */
  readonly language: OutputLanguage;

  /**
   * The database to read.
   */
  readonly connection: ClientBase | string | ClientConfig;

  /**
   * Refuse a migration that needs raw SQL (`strict`).
   */
  readonly strict: boolean;

  /**
   * Whether node-pg-migrate decamelizes the identifiers of `pgm` calls, so
   * that the database's must not change under it (`decamelize`).
   */
  readonly decamelize: boolean;

  /**
   * Only read these schemas; every schema when it is left out.
   */
  readonly includeSchemas?: ReadonlyArray<string>;

  readonly excludeSchemas: ReadonlyArray<string>;
}

/**
 * The options of `baseline()`, checked, with their defaults.
 */
export interface BaselineSettings {
  readonly dir: string;
  readonly name: string;
  readonly filenameFormat: FilenameFormat;
  readonly migrationsSchema: string;
  readonly migrationsTable: string;

  /**
   * node-pg-migrate's schemas, which the runner may create before it runs the
   * baseline (see `SanitizeOptions.createdSchemas`).
   */
  readonly createdSchemas: ReadonlyArray<string>;

  readonly logger: Logger;

  /**
   * Where the schema comes from: a dump or pg_dump for a SQL migration, the
   * catalogs for a TypeScript or JavaScript one.
   */
  readonly dump: FileDumpPlan | PgDumpPlan | CatalogPlan;
}

/**
 * The error for options that `baseline()` cannot work with.
 *
 * @param message What is wrong.
 */
function invalidOptions(message: string): BaselineError {
  return new BaselineError('INVALID_OPTIONS', message);
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

  const { includeSchemas = [], excludeSchemas = [] } = options;

  return {
    kind: 'catalogs',
    language,
    connection,
    strict: options.strict ?? false,
    decamelize: options.decamelize ?? false,
    // Like pg_dump, which dumps every schema without --schema.
    ...(includeSchemas.length === 0 ? {} : { includeSchemas }),
    excludeSchemas,
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
  const empty = NON_EMPTY_OPTIONS.find((key) => options[key] === '');
  if (empty !== undefined) {
    throw invalidOptions(`${empty} must not be empty.`);
  }

  const name = options.name ?? 'baseline';
  if (UNSAFE_NAME.test(name)) {
    throw invalidOptions(
      `The migration name "${name}" must not have spaces or slashes: it is part of a file name and of the command that records the migration.`
    );
  }

  if (options.databaseUrl !== undefined && options.dbClient !== undefined) {
    throw invalidOptions('Pass either databaseUrl or dbClient, not both.');
  }

  const schemas = getSchemas(options.schema);

  return {
    dir: options.dir,
    name,
    filenameFormat: options.filenameFormat ?? 'timestamp',
    migrationsSchema: options.migrationsSchema ?? schemas[0],
    migrationsTable: options.migrationsTable ?? 'pgmigrations',
    createdSchemas: schemas,
    logger: options.logger ?? console,
    dump: sourcePlan(options),
  };
}

/**
 * The identifiers of a model that `pgm` calls take: the schemas and names of
 * its objects, and the names of their columns, attributes and arguments; the
 * constraint name that `createDomain` gives a domain (`constraintName`: its
 * `NOT NULL` constraint when it is not named `<domain>_not_null`, or else
 * its first valid CHECK); the names of the constraints that `addConstraint`
 * adds to partitions, and to the columns an inheritance child declares `NOT
 * NULL` itself (when not named `<table>_<column>_not_null`); and the names of
 * the settings that `createFunction` sets (`set`).
 *
 * @param model The schema of the database.
 */
function modelIdentifiers(model: SchemaModel): Set<string> {
  const identifiers = new Set<string>();
  const add = (name: string | undefined): void => {
    if (name !== undefined) {
      identifiers.add(name);
    }
  };

  const objects = [
    ...model.schemas,
    ...model.extensions,
    ...model.enums,
    ...model.composites,
    ...model.domains,
    ...model.ranges,
    ...model.collations,
    ...model.sequences,
    ...model.functions,
    ...model.operators,
    ...model.aggregates,
    ...model.tables,
    ...model.constraints,
    ...model.indexes,
    ...model.views,
    ...model.materializedViews,
    ...model.triggers,
    ...model.policies,
    ...model.rules,
    ...model.statistics,
  ];
  for (const object of objects) {
    add(object.schema);
    add(object.name);
  }

  for (const { columns } of [
    ...model.tables,
    ...model.views,
    ...model.materializedViews,
  ]) {
    for (const column of columns) {
      add(column.name);
    }
  }

  for (const composite of model.composites) {
    for (const attribute of composite.attributes) {
      add(attribute.name);
    }
  }

  for (const routine of model.functions) {
    for (const argument of routine.arguments) {
      add(argument.name);
    }

    if (usesCreateFunction(routine)) {
      for (const setting of routine.config) {
        add(setting.name);
      }
    }
  }

  for (const domain of model.domains) {
    const notNull = domain.notNullConstraintName;
    if (notNull !== makeObjectName(domain.name, undefined, 'not_null')) {
      add(notNull);
    }

    if (!domain.notNull) {
      add(domain.checks.find((check) => check.validated)?.name);
    }
  }

  for (const constraint of model.constraints) {
    for (const partitionIndex of constraint.partitionIndexes ?? []) {
      add(partitionIndex.name);
    }
  }

  for (const table of model.tables) {
    for (const column of table.columns) {
      const name = column.notNullConstraint?.name;
      if (
        table.partitionOf === undefined &&
        column.inheritance?.localNotNull === true &&
        name !== makeObjectName(table.name, column.name, 'not_null')
      ) {
        add(name);
      }
    }
  }

  return identifiers;
}

/**
 * Refuses a TypeScript or JavaScript baseline when node-pg-migrate
 * decamelizes identifiers (`decamelize`) and would rename some of the
 * database's, among those its `pgm` calls take (see `modelIdentifiers()`):
 * the migration would not create the schema as it is (e.g. `LegacyCustomer`
 * would become `legacy_customer`, and a function's `SET TimeZone` would set
 * `time_zone`).
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS` that names
 * `decamelize` and such identifiers, sorted (the first ten, then how many
 * more).
 *
 * @param model The schema of the database.
 * @param decamelizes Whether node-pg-migrate decamelizes identifiers.
 */
export function assertDecamelizeKeepsNames(
  model: SchemaModel,
  decamelizes: boolean
): void {
  if (!decamelizes) {
    return;
  }

  const renamed = [...modelIdentifiers(model)]
    .filter((name) => decamelize(name) !== name)
    .toSorted((a, b) => (a < b ? -1 : 1));
  if (renamed.length === 0) {
    return;
  }

  const listed = renamed
    .slice(0, LISTED_IDENTIFIERS)
    .map((name) => `${quote(name)} (as ${decamelize(name)})`)
    .join(', ');
  const more =
    renamed.length > LISTED_IDENTIFIERS
      ? ` and ${renamed.length - LISTED_IDENTIFIERS} more`
      : '';

  throw invalidOptions(
    `decamelize is on, and it would rename identifiers of this database when the baseline runs: ${listed}${more}. A baseline must create the schema as it is: turn decamelize off, or write the baseline with --format sql, which decamelize does not change.`
  );
}

/**
 * What the user should know about the objects a TypeScript or JavaScript
 * baseline creates with raw SQL: one warning with their count, when there
 * are any.
 *
 * @param fallbacks How many objects need raw SQL.
 * @returns The warnings.
 */
export function fallbackWarnings(fallbacks: number): string[] {
  return fallbacks === 0
    ? []
    : [
        `The migration creates ${fallbacks} object(s) with raw SQL (pgm.sql), each under a "// fallback: <reason>" comment: review them. --strict refuses to write a baseline that needs any.`,
      ];
}

/**
 * Refuses a server that cannot get a baseline: one that is not PostgreSQL, or
 * whose migrations table already records migrations.
 *
 * Throws a `BaselineError` with code `UNSUPPORTED_SERVER` or
 * `HISTORY_EXISTS`.
 *
 * @param facts What the server says.
 * @param settings Where the migrations table is.
 */
export function assertCanBaseline(
  facts: ServerFacts,
  settings: Pick<BaselineSettings, 'migrationsSchema' | 'migrationsTable'>
): void {
  if (facts.isCockroach) {
    throw new BaselineError(
      'UNSUPPORTED_SERVER',
      `baseline only supports PostgreSQL, but the server is ${facts.version}.`
    );
  }

  if (facts.recordedMigrations > 0) {
    throw new BaselineError(
      'HISTORY_EXISTS',
      `${quote(settings.migrationsSchema)}.${quote(settings.migrationsTable)} already records ${facts.recordedMigrations} migration(s): node-pg-migrate already manages this database, and a baseline is only for databases without migration history. Write new migrations instead.`
    );
  }
}

/**
 * The migrations table and its sequence, which the dump must not create: the
 * sequence the table really uses when the server says so, else the one the
 * runner would create.
 *
 * @param settings Where the migrations table is.
 * @param facts What the server says, if there is a server.
 */
export function migrationsObjects(
  settings: Pick<BaselineSettings, 'migrationsSchema' | 'migrationsTable'>,
  facts: ServerFacts | undefined
): { readonly table: QualifiedName; readonly sequence: QualifiedName } {
  const { migrationsSchema: schema, migrationsTable: name } = settings;

  return {
    table: { schema, name },
    sequence: facts?.migrationsSequence ?? { schema, name: `${name}_id_seq` },
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

/**
 * The `max_locks_per_transaction` a blank database needs to run the baseline,
 * when it is more than the default (see `requiredMaxLocksPerTransaction()`).
 *
 * @param relations About how many relations the baseline creates.
 * @param facts What the server says, if there is a server: its lock table
 * settings. Without one, PostgreSQL's defaults.
 * @returns The setting, and a warning about it; neither when the default is
 * enough.
 */
export function locksNeeded(
  relations: number,
  facts: ServerFacts | undefined
): {
  readonly requiredMaxLocksPerTransaction?: number;
  readonly warnings: string[];
} {
  const required = requiredMaxLocksPerTransaction(
    relations,
    facts?.maxConnections,
    facts?.maxPreparedTransactions
  );

  return required > DEFAULT_MAX_LOCKS_PER_TRANSACTION
    ? {
        requiredMaxLocksPerTransaction: required,
        warnings: [
          `The baseline creates about ${relations} relations in one transaction: blank databases need max_locks_per_transaction = ${required} or more (the default is ${DEFAULT_MAX_LOCKS_PER_TRANSACTION}), or running it fails with "out of shared memory".`,
        ],
      }
    : { warnings: [] };
}
