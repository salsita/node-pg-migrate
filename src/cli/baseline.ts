import type { Command } from 'commander';
import { Option } from 'commander';
// Import from node-pg-migrate, like commands.ts does: the CLI bundle must use
// the library's own `BaselineError` for `instanceof` to work.
import { baseline, BaselineError } from 'node-pg-migrate';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
  databaseUrlVarArg,
  excludeSchemaArg,
  formatArg,
  fromFileArg,
  includeSchemaArg,
  lockWaitTimeoutArg,
  migrationFilenameFormatArg,
  migrationsDirArg,
  migrationsSchemaArg,
  migrationsTableArg,
  pgDumpArg,
  rejectUnauthorizedArg,
  schemaArg,
  strictArg,
} from './args';
import type { ResolvedConfig } from './config';
import { resolveConfig } from './config';
import {
  baselineConnection,
  findDbConnection,
  requireDbConnection,
} from './connection';
import type { CliOptions } from './options';
import { addConfigOptions } from './options';

/**
 * Parsed shape of the `baseline` command's options, as commander exposes them
 * (see {@link CliOptions}).
 */
export interface BaselineCliOptions extends Pick<
  CliOptions,
  | 'databaseUrlVar'
  | 'migrationsDir'
  | 'migrationFilenameFormat'
  | 'migrationsTable'
  | 'migrationsSchema'
  | 'schema'
  | 'rejectUnauthorized'
  | 'configFile'
  | 'configValue'
  | 'envPath'
  | 'forceExit'
> {
  /**
   * `--from-file`: an existing `pg_dump --schema-only` output to clean up
   * instead of running pg_dump; `-` reads standard input.
   */
  fromFile?: string;

  /**
   * `--pg-dump`: the pg_dump executable to run.
   */
  pgDump?: string;

  /**
   * `--include-schema`: only dump these schemas.
   */
  includeSchema?: string[];

  /**
   * `--exclude-schema`: leave these schemas out of the dump.
   */
  excludeSchema?: string[];

  /**
   * `--lock-wait-timeout`: how long pg_dump waits for table locks.
   */
  lockWaitTimeout?: string;

  /**
   * `--format`: the language of the migration, `sql` (the default), or the
   * experimental `ts` and `js`, which read the catalogs instead of running
   * pg_dump.
   */
  format?: 'sql' | 'ts' | 'js';

  /**
   * `--strict`: with `--format ts|js`, refuse to write a migration that needs
   * raw SQL.
   */
  strict?: boolean;
}

/**
 * Options of the `baseline` action.
 */
export function addBaselineOptions(command: Command): Command {
  command
    .addOption(
      new Option(
        `-m, --${migrationsDirArg} <dir>`,
        'The directory the baseline migration is written to (resolved from cwd()). It is created if missing and must not have any migration yet'
      )
    )
    .addOption(
      new Option(
        `--${migrationFilenameFormatArg} <format>`,
        'Prefix type of migration filename'
      ).choices(['timestamp', 'utc', 'index'])
    )
    .addOption(
      new Option(
        `-t, --${migrationsTableArg} <table>`,
        'The table storing which migrations have been run'
      )
    )
    .addOption(
      new Option(
        `--${migrationsSchemaArg} <schema>`,
        'The schema storing table which migrations have been run (defaults to the first `--schema`)'
      )
    )
    .addOption(
      new Option(
        `-s, --${schemaArg} <schema...>`,
        'The schema on which migrations will be run (defaults to `public`)'
      )
    )
    .addOption(
      new Option(
        `-d, --${databaseUrlVarArg} <var>`,
        'Name of env variable where is set the databaseUrl'
      ).default('DATABASE_URL')
    )
    .addOption(
      new Option(
        `--${fromFileArg} <path>`,
        'Clean up this `pg_dump --schema-only` output instead of running pg_dump (`-` reads stdin). The database connection is optional then'
      )
    )
    .addOption(
      new Option(
        `--${rejectUnauthorizedArg}`,
        'Sets rejectUnauthorized SSL option'
      )
    )
    .addOption(
      new Option(
        `--${pgDumpArg} <path>`,
        'The pg_dump executable to run (defaults to `pg_dump` from the PATH)'
      )
    )
    .addOption(
      new Option(
        `--${includeSchemaArg} <schema...>`,
        'Only dump these schemas (pg_dump --schema)'
      )
    )
    .addOption(
      new Option(
        `--${excludeSchemaArg} <schema...>`,
        'Leave these schemas out of the dump (pg_dump --exclude-schema)'
      )
    )
    .addOption(
      new Option(
        `--${lockWaitTimeoutArg} <duration>`,
        'How long pg_dump waits for table locks before it fails (pg_dump --lock-wait-timeout)'
      ).default('10s')
    )
    .addOption(
      new Option(
        `--${formatArg} <format>`,
        'The language of the migration: sql cleans up pg_dump output; ts and js (experimental) read the catalogs of the database and write pgm calls'
      )
        .choices(['sql', 'ts', 'js'])
        .default('sql')
    )
    .addOption(
      new Option(
        `--${strictArg}`,
        'With --format ts|js: fail, listing every object that needs raw SQL (pgm.sql), instead of writing the migration'
      )
    );

  return addConfigOptions(command);
}

/**
 * The migrations directory to give `baseline()`: as configured, except that
 * the default is `migrations`, the way `up` finds it from the current
 * directory, so that the migration header and the printed command do not
 * name an absolute path of this machine.
 *
 * @param config The resolved configuration.
 */
function migrationsDir(config: ResolvedConfig): string {
  return config.migrationsDir === join(cwd(), 'migrations')
    ? 'migrations'
    : config.migrationsDir;
}

/**
 * Handler for the `baseline` action.
 *
 * It exits the process when it is done: with code 0 once the migration is
 * written, and with code 1 after printing why it was not. A `BaselineError`
 * is printed as its message only, which says what to do.
 *
 * @param nameArgs The name of the migration, in parts (joined like `create`
 * does).
 * @param options The parsed options.
 */
export async function runBaseline(
  nameArgs: string[],
  options: BaselineCliOptions
): Promise<void> {
  const config = await resolveConfig(options);
  // A dump file needs no database, but when there is one, baseline checks
  // that it has no migration history.
  const connection =
    options.fromFile === undefined
      ? requireDbConnection(config)
      : findDbConnection(config);
  const name =
    nameArgs.length > 0
      ? nameArgs.join('-').replaceAll(/[ _]+/g, '-')
      : 'baseline';

  try {
    await baseline({
      databaseUrl:
        connection === undefined
          ? undefined
          : baselineConnection(connection, options.rejectUnauthorized),
      dir: migrationsDir(config),
      name,
      migrationsTable: config.migrationsTable,
      migrationsSchema: config.migrationsSchema,
      schema: config.schema,
      fromFile: options.fromFile,
      pgDump: options.pgDump,
      includeSchemas: options.includeSchema,
      excludeSchemas: options.excludeSchema,
      lockWaitTimeout: options.lockWaitTimeout,
      filenameFormat: config.migrationsFilenameFormat,
      format: options.format,
      strict: options.strict,
      decamelize: config.decamelize,
      logger: console,
    });
  } catch (error) {
    console.error(error instanceof BaselineError ? error.message : error);
    process.exit(1);
  }

  process.exit(0);
}
