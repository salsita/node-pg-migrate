import { relative } from 'node:path';
import type { ClientBase } from 'pg';
import { generateMigration } from '../codegen';
import { db as connect } from '../db';
import { introspect } from '../introspect/io/introspect';
import type { SchemaModel } from '../introspect/types';
import type { Logger } from '../logger';
import { formatFakeCommand } from './core/fakeCommand';
import { renderHeader } from './core/header';
import { estimateRelations } from './core/locks';
import { toPgEnv } from './core/pgEnv';
import { sanitizeDump } from './core/sanitize';
import { assertPgDumpCompatible } from './core/version';
import { BaselineError } from './errors';
import { getPgDumpVersion, runPgDump } from './io/pgDump';
import { readDumpFile } from './io/readDump';
import type { InstalledExtension } from './io/server';
import {
  assertIncludedSchemasExist,
  readExtensions,
  readServerFacts,
} from './io/server';
import { planBaselineFile, writeBaselineFile } from './io/writeBaseline';
import type {
  BaselineSettings,
  CatalogPlan,
  Connection,
  FileDumpPlan,
  PgDumpPlan,
} from './plan';
import {
  assertCanBaseline,
  assertDecamelizeKeepsNames,
  fallbackWarnings,
  locksNeeded,
  migrationsObjects,
  pgDumpArguments,
  resolveSettings,
} from './plan';
import type {
  BaselineOptions,
  BaselineResult,
  DumpSource,
  ServerFacts,
} from './types';

export { BaselineError } from './errors';
export type { BaselineErrorCode } from './errors';
export type { BaselineOptions, BaselineResult, DumpSource } from './types';

/**
 * A dump to turn into a baseline, and what is known about its database.
 */
interface Dump {
  /**
   * The pg_dump output.
   */
  readonly sql: string;

  /**
   * What the server says, when there is a connection.
   */
  readonly facts?: ServerFacts;

  /**
   * Where the dump came from, beyond what its header comments say.
   */
  readonly source: DumpSource;

  /**
   * What the user should know about how the dump was made.
   */
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Reads the facts of a server and refuses one that cannot get a baseline,
 * through a connection that is closed again unless it is the caller's
 * client.
 *
 * @param connection The database.
 * @param settings Where the migrations table is, and the logger.
 * @param options What else to check and read.
 * @param options.withExtensions Whether to list the extensions of the
 * database too.
 * @param options.includeSchemas `--include-schema`, refused when it names a
 * schema that does not exist.
 */
async function inspectServer(
  connection: Connection,
  settings: BaselineSettings,
  options: {
    readonly withExtensions: boolean;
    readonly includeSchemas: ReadonlyArray<string>;
  }
): Promise<{
  readonly facts: ServerFacts;
  readonly extensions: ReadonlyArray<InstalledExtension>;
}> {
  const db = connect(connection, settings.logger);
  try {
    const facts = await readServerFacts(db, settings, { requireTable: true });
    assertCanBaseline(facts, settings);
    await assertIncludedSchemasExist(db, options.includeSchemas);

    return {
      facts,
      extensions: options.withExtensions ? await readExtensions(db) : [],
    };
  } finally {
    await db.close();
  }
}

/**
 * Whether a connection is a caller-provided client, rather than a connection
 * string or a client config baseline can read a host and database from.
 *
 * @param connection The connection.
 */
function isClient(connection: Connection): connection is ClientBase {
  return (
    typeof connection === 'object' &&
    'query' in connection &&
    typeof connection.query === 'function'
  );
}

/**
 * The host and database a failed connection was trying to reach, for the
 * refusal of an unreachable `--from-file` connection. Never the password:
 * `toPgEnv()` keeps it out, and a caller-provided client has none to read.
 *
 * @param connection The connection baseline could not reach.
 */
async function connectionTarget(
  connection: Connection
): Promise<{ readonly host: string; readonly database: string }> {
  if (isClient(connection)) {
    return { host: 'the configured host', database: 'the configured database' };
  }

  const env = await toPgEnv(connection);

  return {
    host: env.PGHOST ?? 'localhost',
    database: env.PGDATABASE ?? 'the configured database',
  };
}

/**
 * Turns a failed `--from-file` connection into a `BaselineError` whose message
 * says what happened and how to run without a connection, without leaking the
 * password or a stack trace.
 *
 * @param connection The connection baseline could not reach.
 * @param cause The underlying error.
 */
async function unreachableConnection(
  connection: Connection,
  cause: unknown
): Promise<BaselineError> {
  const { host, database } = await connectionTarget(connection);

  return new BaselineError(
    'INVALID_OPTIONS',
    `Could not connect to the database (host ${host}, database ${database}) to check its migration history. With --from-file, the connection is only used to check the migration history: to write the baseline without that check, run baseline with no database connection (for example point -d at an unset environment variable).`,
    { cause }
  );
}

/**
 * The facts of the database a `--from-file` baseline checks. It silences the
 * connection's logger so that `db()` does not print the raw connection error
 * (with its stack) before the refusal: a connection failure becomes a
 * `BaselineError`, while a `BaselineError` the check itself raised (e.g.
 * `HISTORY_EXISTS`, `INVALID_MIGRATIONS_TABLE`) passes through unchanged.
 *
 * @param settings The settings of the baseline.
 * @param connection The database to check.
 */
async function readDumpFacts(
  settings: BaselineSettings,
  connection: Connection
): Promise<ServerFacts> {
  const quiet: BaselineSettings = {
    ...settings,
    logger: {
      debug: (message) => {
        settings.logger.debug?.(message);
      },
      info: (message) => {
        settings.logger.info(message);
      },
      warn: (message) => {
        settings.logger.warn(message);
      },
      error: () => {
        // The raw connection error (with its stack) is turned into a
        // BaselineError below, so it must not reach the logger.
      },
    },
  };

  try {
    const { facts } = await inspectServer(connection, quiet, {
      withExtensions: false,
      includeSchemas: [],
    });

    return facts;
  } catch (error) {
    if (error instanceof BaselineError) {
      throw error;
    }

    throw await unreachableConnection(connection, error);
  }
}

/**
 * Reads an existing pg_dump output, after checking the database when there is
 * one.
 *
 * With a connection that cannot be reached, it refuses with `INVALID_OPTIONS`
 * (see {@link unreachableConnection}) instead of letting the raw connection
 * error and its stack through, since `--from-file` is meant for exactly the
 * case where there is no route to the database.
 *
 * @param settings The settings of the baseline.
 * @param plan The dump file.
 */
async function readDump(
  settings: BaselineSettings,
  plan: FileDumpPlan
): Promise<Dump> {
  const facts =
    plan.connection === undefined
      ? undefined
      : await readDumpFacts(settings, plan.connection);

  return {
    sql: await readDumpFile(plan.path),
    facts,
    source: { file: plan.label },
    warnings: [],
  };
}

/**
 * Runs pg_dump against the database, after checking it.
 *
 * @param settings The settings of the baseline.
 * @param plan What to dump, and with which pg_dump.
 */
async function dumpDatabase(
  settings: BaselineSettings,
  plan: PgDumpPlan
): Promise<Dump> {
  const { facts, extensions } = await inspectServer(plan.connection, settings, {
    withExtensions: plan.includeSchemas.length + plan.excludeSchemas.length > 0,
    includeSchemas: plan.includeSchemas,
  });
  const env = await toPgEnv(plan.connection);
  const pgDump = await getPgDumpVersion(plan.bin, env);
  assertPgDumpCompatible(pgDump, facts.versionNum, facts.version);
  const { args, warnings } = pgDumpArguments({
    pgDump,
    plan,
    migrations: migrationsObjects(settings, facts),
    extensions,
  });

  return {
    sql: await runPgDump(plan.bin, args, env),
    facts,
    source: { serverVersion: facts.version, pgDumpVersion: pgDump.raw },
    warnings,
  };
}

/**
 * Reads the schema of the database from its catalogs, after checking it,
 * through a connection that is closed again unless it is the caller's
 * client.
 *
 * @param settings The settings of the baseline.
 * @param plan The database and the schemas to read.
 */
async function readCatalogs(
  settings: BaselineSettings,
  plan: CatalogPlan
): Promise<{ readonly facts: ServerFacts; readonly model: SchemaModel }> {
  const db = connect(plan.connection, settings.logger);
  try {
    const facts = await readServerFacts(db, settings, { requireTable: true });
    assertCanBaseline(facts, settings);
    await assertIncludedSchemasExist(db, plan.includeSchemas ?? []);
    const model = await introspect(db, {
      includeSchemas: plan.includeSchemas,
      excludeSchemas: plan.excludeSchemas,
      migrationsSchema: settings.migrationsSchema,
      migrationsTable: settings.migrationsTable,
      migrationsSequence: migrationsObjects(settings, facts).sequence,
    });

    return { facts, model };
  } finally {
    await db.close();
  }
}

/**
 * Tells the user where the baseline is and what to do with it.
 *
 * @param logger Where to write.
 * @param path The baseline migration.
 * @param fakeCommand The command that records it without running it.
 * @param messages What the user should know about it: notes (logged as
 * info), then warnings.
 */
function report(
  logger: Logger,
  path: string,
  fakeCommand: string,
  messages: {
    readonly notes?: ReadonlyArray<string>;
    readonly warnings: ReadonlyArray<string>;
  }
): void {
  logger.info(`> Wrote ${relative(process.cwd(), path)}`);
  logger.info(
    '> On databases that already have this schema, record it without running it:'
  );
  logger.info(`>   ${fakeCommand}`);
  logger.info('> Blank databases run it with a normal `node-pg-migrate up`.');
  for (const note of messages.notes ?? []) {
    logger.info(`> Note: ${note}`);
  }

  for (const warning of messages.warnings) {
    logger.warn(`> Warning: ${warning}`);
  }
}

/**
 * Writes a TypeScript or JavaScript baseline: reads the catalogs, generates
 * `pgm` calls (see `generateMigration()`) and writes them.
 *
 * @param settings The settings of the baseline.
 * @param plan The database, the language and what to refuse.
 * @param file Where the migration goes, and its name.
 */
async function generateBaseline(
  settings: BaselineSettings,
  plan: CatalogPlan,
  file: { readonly path: string; readonly migrationName: string }
): Promise<BaselineResult> {
  const { path, migrationName } = file;
  const { facts, model } = await readCatalogs(settings, plan);
  assertDecamelizeKeepsNames(model, plan.decamelize);

  const fakeCommand = formatFakeCommand(migrationName, settings.dir, {
    migrationsTable: settings.migrationsTable,
    migrationsSchema: settings.migrationsSchema,
  });
  const source: DumpSource = { serverVersion: facts.version };
  const generated = generateMigration(model, {
    language: plan.language,
    defaultSchema: settings.createdSchemas[0],
    strict: plan.strict,
    migrationName,
    fakeCommand,
    source,
    maxConnections: facts.maxConnections,
    maxPreparedTransactions: facts.maxPreparedTransactions,
  });
  const relations = estimateRelations(generated.stats);
  const { warnings: lockWarnings, ...locks } = locksNeeded(relations, facts);
  const warnings = [
    ...fallbackWarnings(generated.fallbacks.length),
    ...lockWarnings,
  ];

  await writeBaselineFile(path, generated.content);
  report(settings.logger, path, fakeCommand, {
    notes: [
      `--format ${plan.language} is experimental; review the generated migration.`,
    ],
    warnings,
  });

  return {
    path,
    migrationName,
    fakeCommand,
    relations,
    ...locks,
    warnings,
    source,
    fallbacks: generated.fallbacks,
  };
}

/**
 * Writes a baseline migration: one migration that creates the schema of an
 * existing database, so that node-pg-migrate can manage a database it did not
 * create.
 *
 * With `format` `'sql'` (the default), the schema comes from `pg_dump
 * --schema-only`, which either runs against the database or was run before
 * (`fromFile`), and is cleaned up to run inside node-pg-migrate's migration
 * transaction. With `format` `'ts'` or `'js'` (experimental), it comes from
 * the catalogs of the database, and the migration is made of `pgm` calls,
 * with `pgm.sql(…)` fallbacks for what they cannot express (see
 * `BaselineResult.fallbacks`). Databases that already have the schema record
 * the migration without running it (see `BaselineResult.fakeCommand`); blank
 * databases run it like any other migration.
 *
 * Throws a `BaselineError` when the options, the database or the dump are not
 * suitable for a baseline; its message says why and what to do.
 *
 * @param options Where the schema comes from and where the migration goes.
 * @returns The written migration, and what the user should know about it.
 */
export async function baseline(
  options: BaselineOptions
): Promise<BaselineResult> {
  const settings = resolveSettings(options);
  const { dump: from } = settings;
  const file = await planBaselineFile({
    ...settings,
    extension: from.kind === 'catalogs' ? from.language : 'sql',
  });
  if (from.kind === 'catalogs') {
    return generateBaseline(settings, from, file);
  }

  const { path, migrationName } = file;
  const dump =
    from.kind === 'file'
      ? await readDump(settings, from)
      : await dumpDatabase(settings, from);

  const sanitized = sanitizeDump(dump.sql, {
    migrationsSchema: settings.migrationsSchema,
    migrationsTable: settings.migrationsTable,
    migrationsSequence: migrationsObjects(settings, dump.facts).sequence,
    createdSchemas: settings.createdSchemas,
  });
  const relations = estimateRelations(sanitized.stats);
  // `requiredMaxLocksPerTransaction`, only when blank databases need more
  // than the default.
  const { warnings: lockWarnings, ...locks } = locksNeeded(
    relations,
    dump.facts
  );
  const fakeCommand = formatFakeCommand(migrationName, settings.dir, {
    migrationsTable: settings.migrationsTable,
    migrationsSchema: settings.migrationsSchema,
  });
  const source = { ...sanitized.source, ...dump.source };
  const warnings = [...dump.warnings, ...lockWarnings];

  await writeBaselineFile(
    path,
    renderHeader({
      migrationName,
      fakeCommand,
      source,
      materializedViews: sanitized.stats.materializedViews,
      relations,
      ...locks,
    }) + sanitized.sql
  );
  report(settings.logger, path, fakeCommand, { warnings });

  return {
    path,
    migrationName,
    fakeCommand,
    relations,
    ...locks,
    warnings,
    source,
  };
}
