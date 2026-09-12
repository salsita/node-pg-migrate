import { usesCreateFunction } from '../../codegen/emitters/functions';
import { makeObjectName } from '../../codegen/sql';
import type { OutputLanguage } from '../../codegen/types';
import type {
  DomainType,
  Routine,
  SchemaModel,
  Table,
} from '../../introspect/types';
import { decamelize } from '../../utils/decamelize';
import { getSchemas } from '../../utils/getSchemas';
import { quote } from '../../utils/quote';
import { BaselineError } from '../errors';
import type { BaselineOptions, QualifiedName, ServerFacts } from '../types';
import {
  DEFAULT_MAX_LOCKS_PER_TRANSACTION,
  requiredMaxLocksPerTransaction,
} from './locks';

// What `baseline()` decides from its options and from what it reads, without
// any I/O and without Node.js: the part of `src/baseline/plan.ts` that a
// TypeScript or JavaScript baseline needs, which `plan.ts` re-exports. The
// Node.js-free entry `node-pg-migrate/baseline/catalogs`
// (`src/baseline/catalogs.ts`) decides the same with it, so this module must
// only import modules that run anywhere (see
// test/baseline/catalogs.bundle.spec.ts).

/**
 * The migrations table node-pg-migrate uses when none is given.
 */
const DEFAULT_MIGRATIONS_TABLE = 'pgmigrations';

/**
 * The migrations directory node-pg-migrate uses when none is given.
 */
const DEFAULT_MIGRATIONS_DIR = 'migrations';

/**
 * Characters that a migration name cannot have: it becomes a file name and an
 * argument of the printed `up … --fake` command.
 */
const UNSAFE_NAME = /[\s/\\]/;

/**
 * How many identifiers the decamelize refusal names before it only counts
 * the rest.
 */
const LISTED_IDENTIFIERS = 10;

/**
 * The schemas of node-pg-migrate: the migrations table and its schema, and
 * the schemas migrations run on. From the `schema`, `migrationsSchema` and
 * `migrationsTable` options, with their defaults (see
 * {@link resolveSchemaSettings}).
 */
export interface SchemaSettings {
  readonly migrationsSchema: string;
  readonly migrationsTable: string;

  /**
   * node-pg-migrate's schemas, which the runner may create before it runs the
   * baseline (see `SanitizeOptions.createdSchemas`).
   */
  readonly createdSchemas: ReadonlyArray<string>;
}

/**
 * How a TypeScript or JavaScript baseline reads the catalogs, and what it
 * refuses. From the `format`, `strict`, `decamelize`, `includeSchemas` and
 * `excludeSchemas` options, with their defaults (see
 * {@link resolveCatalogSettings}).
 */
export interface CatalogSettings {
  /**
   * The language of the migration.
   */
  readonly language: OutputLanguage;

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
 * The options of `generateBaselineFromCatalogs()` (`CatalogBaselineOptions`,
 * which this module cannot import without an import cycle): the options of
 * `baseline()` that decide what a TypeScript or JavaScript baseline says,
 * with the same names, plus the migration name.
 */
export type CatalogOptions = Pick<
  BaselineOptions,
  | 'migrationsTable'
  | 'migrationsSchema'
  | 'schema'
  | 'includeSchemas'
  | 'excludeSchemas'
  | 'strict'
  | 'decamelize'
> & {
  /**
   * `'ts'` or `'js'`.
   *
   * @default 'ts'
   */
  readonly format?: string;

  /**
   * The migration name (the file name without its extension).
   */
  readonly migrationName: string;

  /**
   * The migrations directory, as the user gives it to node-pg-migrate.
   *
   * @default 'migrations'
   */
  readonly dir?: string;
};

/**
 * The error for options that `baseline()` cannot work with.
 *
 * @param message What is wrong.
 */
export function invalidOptions(message: string): BaselineError {
  return new BaselineError('INVALID_OPTIONS', message);
}

/**
 * Refuses options whose value is an empty string.
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS` that names the first
 * one.
 *
 * @param options The options.
 * @param keys The options that must not be empty, in the order to check them.
 */
export function assertNoEmptyOption<K extends string>(
  options: Readonly<Partial<Record<K, unknown>>>,
  keys: ReadonlyArray<K>
): void {
  const empty = keys.find((key) => options[key] === '');
  if (empty !== undefined) {
    throw invalidOptions(`${empty} must not be empty.`);
  }
}

/**
 * Refuses a migration name with spaces or slashes, since it becomes a file
 * name and an argument of the printed `up … --fake` command.
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS`.
 *
 * @param name The migration name, or the part of it after the filename
 * prefix.
 */
export function assertSafeMigrationName(name: string): void {
  if (UNSAFE_NAME.test(name)) {
    throw invalidOptions(
      `The migration name "${name}" must not have spaces or slashes: it is part of a file name and of the command that records the migration.`
    );
  }
}

/**
 * The schemas of node-pg-migrate, from its options: `schema` (`'public'` when
 * it has none), the migrations table's schema (the first of them unless
 * `migrationsSchema` is given) and the migrations table (`'pgmigrations'`
 * unless `migrationsTable` is given), the way the runner defaults them.
 *
 * @param options The options of `baseline()`.
 */
export function resolveSchemaSettings(
  options: Pick<
    BaselineOptions,
    'schema' | 'migrationsSchema' | 'migrationsTable'
  >
): SchemaSettings {
  const schemas = getSchemas(options.schema);

  return {
    migrationsSchema: options.migrationsSchema ?? schemas[0],
    migrationsTable: options.migrationsTable ?? DEFAULT_MIGRATIONS_TABLE,
    createdSchemas: schemas,
  };
}

/**
 * How a TypeScript or JavaScript baseline reads the catalogs, from its
 * options: nothing is refused by default, and every schema is read, like
 * pg_dump does without `--schema`, when no schema (or an empty list) is
 * included.
 *
 * @param options The options of `baseline()`.
 * @param language The language of the migration.
 */
export function resolveCatalogSettings(
  options: Pick<
    BaselineOptions,
    'strict' | 'decamelize' | 'includeSchemas' | 'excludeSchemas'
  >,
  language: OutputLanguage
): CatalogSettings {
  const { includeSchemas = [], excludeSchemas = [] } = options;

  return {
    language,
    strict: options.strict ?? false,
    decamelize: options.decamelize ?? false,
    // Like pg_dump, which dumps every schema without --schema.
    ...(includeSchemas.length === 0 ? {} : { includeSchemas }),
    excludeSchemas,
  };
}

/**
 * Checks the options of `generateBaselineFromCatalogs()` the way `baseline()`
 * checks its own, and applies the same defaults (see
 * {@link resolveSchemaSettings} and {@link resolveCatalogSettings}), with
 * `format` `'ts'` and `dir` `'migrations'`.
 *
 * Throws a `BaselineError` with code `INVALID_OPTIONS` when `format` is
 * neither `'ts'` nor `'js'`, when `migrationName`, `dir`, `migrationsTable`
 * or `migrationsSchema` is empty, or when the migration name has spaces or
 * slashes.
 *
 * @param options The options of `generateBaselineFromCatalogs()`.
 * @returns The schemas of node-pg-migrate with the migrations directory, and
 * how to read the catalogs.
 */
export function resolveCatalogOptions(options: CatalogOptions): {
  readonly settings: SchemaSettings & { readonly dir: string };
  readonly catalog: CatalogSettings;
} {
  assertNoEmptyOption(options, [
    'migrationName',
    'dir',
    'migrationsTable',
    'migrationsSchema',
  ]);
  assertSafeMigrationName(options.migrationName);
  const format = options.format ?? 'ts';
  if (format !== 'ts' && format !== 'js') {
    throw invalidOptions(`format must be ts or js, not ${format}.`);
  }

  return {
    settings: {
      dir: options.dir ?? DEFAULT_MIGRATIONS_DIR,
      ...resolveSchemaSettings(options),
    },
    catalog: resolveCatalogSettings(options, format),
  };
}

/**
 * The identifiers of a function that `pgm` calls take besides its own schema
 * and name: the names of its arguments, and the names of the settings that
 * `createFunction` sets (`set`).
 *
 * @param routine The function.
 */
function routineIdentifiers(routine: Routine): Array<string | undefined> {
  const names = routine.arguments.map((argument) => argument.name);
  if (usesCreateFunction(routine)) {
    for (const setting of routine.config) {
      names.push(setting.name);
    }
  }

  return names;
}

/**
 * The constraint name that `createDomain` gives a domain (`constraintName`):
 * its `NOT NULL` constraint when it is not named `<domain>_not_null`, or else
 * its first valid CHECK.
 *
 * @param domain The domain.
 */
function domainConstraintNames(domain: DomainType): Array<string | undefined> {
  const names: Array<string | undefined> = [];
  const notNull = domain.notNullConstraintName;
  if (notNull !== makeObjectName(domain.name, undefined, 'not_null')) {
    names.push(notNull);
  }

  if (!domain.notNull) {
    names.push(domain.checks.find((check) => check.validated)?.name);
  }

  return names;
}

/**
 * The names of the constraints that `addConstraint` adds to the columns an
 * inheritance child declares `NOT NULL` itself, when not named
 * `<table>_<column>_not_null`.
 *
 * @param table The table.
 */
function localNotNullNames(table: Table): Array<string | undefined> {
  const names: Array<string | undefined> = [];
  for (const column of table.columns) {
    const name = column.notNullConstraint?.name;
    if (
      table.partitionOf === undefined &&
      column.inheritance?.localNotNull === true &&
      name !== makeObjectName(table.name, column.name, 'not_null')
    ) {
      names.push(name);
    }
  }

  return names;
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
  const addAll = (names: ReadonlyArray<string | undefined>): void => {
    for (const name of names) {
      add(name);
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
    addAll(routineIdentifiers(routine));
  }

  for (const domain of model.domains) {
    addAll(domainConstraintNames(domain));
  }

  for (const constraint of model.constraints) {
    for (const partitionIndex of constraint.partitionIndexes ?? []) {
      add(partitionIndex.name);
    }
  }

  for (const table of model.tables) {
    addAll(localNotNullNames(table));
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
  settings: Pick<SchemaSettings, 'migrationsSchema' | 'migrationsTable'>
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
  settings: Pick<SchemaSettings, 'migrationsSchema' | 'migrationsTable'>,
  facts: ServerFacts | undefined
): { readonly table: QualifiedName; readonly sequence: QualifiedName } {
  const { migrationsSchema: schema, migrationsTable: name } = settings;

  return {
    table: { schema, name },
    sequence: facts?.migrationsSequence ?? { schema, name: `${name}_id_seq` },
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
