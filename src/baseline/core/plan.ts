import { getSchemas } from '../../utils/getSchemas';
import { quote } from '../../utils/quote';
import { BaselineError } from '../errors';
import type { BaselineOptions, QualifiedName, ServerFacts } from '../types';
import {
  DEFAULT_MAX_LOCKS_PER_TRANSACTION,
  requiredMaxLocksPerTransaction,
} from './locks';

// What `baseline()` decides from its options and from what it reads, without
// any I/O and without Node.js; `src/baseline/plan.ts` re-exports it.

/**
 * The migrations table node-pg-migrate uses when none is given.
 */
const DEFAULT_MIGRATIONS_TABLE = 'pgmigrations';

/**
 * Characters that a migration name cannot have: it becomes a file name and an
 * argument of the printed `up … --fake` command.
 */
const UNSAFE_NAME = /[\s/\\]/;

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
