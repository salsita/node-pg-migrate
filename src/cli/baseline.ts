import type { Command } from 'commander';
import { Option } from 'commander';
import {
  databaseUrlVarArg,
  excludeSchemaArg,
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
} from './args';
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
    );

  return addConfigOptions(command);
}

/**
 * Handler for the `baseline` action.
 *
 * @param nameArgs The name of the migration, in parts (joined like `create`
 * does).
 * @param options The parsed options.
 */
export function runBaseline(
  _nameArgs: string[],
  _options: BaselineCliOptions
): Promise<void> {
  return Promise.reject(new Error('not implemented'));
}
