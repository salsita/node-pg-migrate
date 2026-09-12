import { relative } from 'node:path';
import type { ClientBase, ClientConfig } from 'pg';
import { db as connect } from '../db';
import type { Logger } from '../logger';
import { formatFakeCommand } from './core/fakeCommand';
import { renderHeader } from './core/header';
import { estimateRelations } from './core/locks';
import { toPgEnv } from './core/pgEnv';
import { sanitizeDump } from './core/sanitize';
import { assertPgDumpCompatible } from './core/version';
import { getPgDumpVersion, runPgDump } from './io/pgDump';
import { readDumpFile } from './io/readDump';
import type { InstalledExtension } from './io/server';
import { readExtensions, readServerFacts } from './io/server';
import { planBaselineFile, writeBaselineFile } from './io/writeBaseline';
import type { BaselineSettings, FileDumpPlan, PgDumpPlan } from './plan';
import {
  assertCanBaseline,
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
 * @param withExtensions Whether to list the extensions of the database too.
 */
async function inspectServer(
  connection: ClientBase | string | ClientConfig,
  settings: BaselineSettings,
  withExtensions: boolean
): Promise<{
  readonly facts: ServerFacts;
  readonly extensions: ReadonlyArray<InstalledExtension>;
}> {
  const db = connect(connection, settings.logger);
  try {
    const facts = await readServerFacts(db, settings);
    assertCanBaseline(facts, settings);

    return {
      facts,
      extensions: withExtensions ? await readExtensions(db) : [],
    };
  } finally {
    await db.close();
  }
}

/**
 * Reads an existing pg_dump output, after checking the database when there is
 * one.
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
      : (await inspectServer(plan.connection, settings, false)).facts;

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
  const { facts, extensions } = await inspectServer(
    plan.connection,
    settings,
    plan.includeSchemas.length + plan.excludeSchemas.length > 0
  );
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
 * Tells the user where the baseline is and what to do with it.
 *
 * @param logger Where to write.
 * @param path The baseline migration.
 * @param fakeCommand The command that records it without running it.
 * @param warnings What the user should know about it.
 */
function report(
  logger: Logger,
  path: string,
  fakeCommand: string,
  warnings: ReadonlyArray<string>
): void {
  logger.info(`> Wrote ${relative(process.cwd(), path)}`);
  logger.info(
    '> On databases that already have this schema, record it without running it:'
  );
  logger.info(`>   ${fakeCommand}`);
  logger.info('> Blank databases run it with a normal `node-pg-migrate up`.');
  for (const warning of warnings) {
    logger.warn(`> Warning: ${warning}`);
  }
}

/**
 * Writes a baseline migration: one SQL migration that creates the schema of
 * an existing database, so that node-pg-migrate can manage a database it did
 * not create.
 *
 * The schema comes from `pg_dump --schema-only`, which either runs against
 * the database or was run before (`fromFile`), and is cleaned up to run
 * inside node-pg-migrate's migration transaction. Databases that already have
 * the schema record the migration without running it (see
 * `BaselineResult.fakeCommand`); blank databases run it like any other
 * migration.
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
  const { path, migrationName } = await planBaselineFile(settings);
  const dump =
    settings.dump.kind === 'file'
      ? await readDump(settings, settings.dump)
      : await dumpDatabase(settings, settings.dump);

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
  const fakeCommand = formatFakeCommand(migrationName, settings.dir);
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
  report(settings.logger, path, fakeCommand, warnings);

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
