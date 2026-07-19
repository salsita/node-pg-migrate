import type { Command } from 'commander';
import { Option } from 'commander';
import { PG_MIGRATE_LOCK_ID } from 'node-pg-migrate';
import {
  advisoryLockModeArg,
  checkOrderArg,
  configFileArg,
  configValueArg,
  createMigrationsSchemaArg,
  createSchemaArg,
  databaseUrlVarArg,
  decamelizeArg,
  dryRunArg,
  envPathArg,
  fakeArg,
  forceExitArg,
  ignorePatternArg,
  lockArg,
  lockValueArg,
  migrationFileLanguageArg,
  migrationFilenameFormatArg,
  migrationsDirArg,
  migrationsSchemaArg,
  migrationsTableArg,
  prettyArg,
  rejectUnauthorizedArg,
  schemaArg,
  singleTransactionArg,
  templateFileNameArg,
  timestampArg,
  tsconfigPathsArg,
  useGlobArg,
  verboseArg,
} from './args';

/**
 * Parsed shape of the CLI options exposed by commander.
 *
 * commander exposes each option value under its camelCase name. Options that
 * were not passed (and have no default) are `undefined`, mirroring how the
 * previous yargs parser behaved so the config-resolution pipeline can tell
 * "not provided" apart from an explicit value.
 */
export interface CliOptions {
  databaseUrlVar?: string;
  migrationsDir?: string;
  useGlob?: boolean;
  migrationsTable?: string;
  schema?: string[];
  createSchema?: boolean;
  migrationsSchema?: string;
  createMigrationsSchema?: boolean;
  checkOrder?: boolean;
  verbose?: boolean;
  ignorePattern?: string;
  decamelize?: boolean;
  pretty?: boolean;
  configValue?: string;
  configFile?: string;
  migrationFileLanguage?: string;
  migrationFilenameFormat?: string;
  templateFileName?: string;
  envPath?: string;
  dryRun?: boolean;
  fake?: boolean;
  singleTransaction?: boolean;
  lock?: boolean;
  lockValue?: number;
  rejectUnauthorized?: boolean;
  timestamp?: boolean;
  advisoryLockMode?: string;
  tsconfigPaths?: string;
  forceExit?: boolean;
}

/**
 * Options shared by every command: they feed the config-resolution pipeline
 * (dotenv, the `config` package and `--config-file`) and are therefore relevant
 * regardless of the action being run.
 */
function addConfigOptions(command: Command): Command {
  return (
    command
      .addOption(
        new Option(
          `-f, --${configFileArg} <${configFileArg}>`,
          'Name of config file with db options'
        )
      )
      .addOption(
        new Option(
          `--${configValueArg} <${configValueArg}>`,
          'Name of config section with db options'
        ).default('db')
      )
      .addOption(
        new Option(
          `--${envPathArg} <${envPathArg}>`,
          'Path to the .env file that should be used for configuration'
        )
      )
      // Note: `--force-exit` is intentionally a no-op-ish flag that forces the
      // process to exit right after dispatching the action (see the command
      // handlers). It was read but never declared by the previous parser.
      .addOption(
        new Option(`--${forceExitArg}`, 'Forcibly exit migration process')
      )
  );
}

/**
 * Options only relevant to the `create` action.
 */
export function addCreateOptions(command: Command): Command {
  command
    .addOption(
      new Option(
        `-m, --${migrationsDirArg} <${migrationsDirArg}>`,
        'The directory name or glob pattern containing your migration files (resolved from cwd())'
      )
    )
    .addOption(
      new Option(
        `-j, --${migrationFileLanguageArg} <${migrationFileLanguageArg}>`,
        'Language of the migration file'
      ).choices(['js', 'ts', 'sql', 'cjs', 'mjs', 'cts', 'mts'])
    )
    .addOption(
      new Option(
        `--${migrationFilenameFormatArg} <${migrationFilenameFormatArg}>`,
        'Prefix type of migration filename'
      ).choices(['timestamp', 'utc', 'index'])
    )
    .addOption(
      new Option(
        `--${templateFileNameArg} <${templateFileNameArg}>`,
        'Path to template for creating migrations'
      )
    )
    .addOption(
      new Option(
        `--${ignorePatternArg} <${ignorePatternArg}>`,
        'Regex or glob pattern for migration files to be ignored'
      )
    );

  return addConfigOptions(command);
}

/**
 * Options relevant to the migration actions (`up`, `down`, `redo`).
 */
export function addRunnerOptions(command: Command): Command {
  command
    .addOption(
      new Option(
        `-d, --${databaseUrlVarArg} <${databaseUrlVarArg}>`,
        'Name of env variable where is set the databaseUrl'
      ).default('DATABASE_URL')
    )
    .addOption(
      new Option(
        `-m, --${migrationsDirArg} <${migrationsDirArg}>`,
        `The directory name or glob pattern containing your migration files (resolved from cwd()). When using glob pattern, "${useGlobArg}" must be used as well`
      )
    )
    .addOption(
      new Option(
        `--${useGlobArg}`,
        `Use glob to find migration files. This will use "${migrationsDirArg}" _and_ "${ignorePatternArg}" to glob-search for migration files.`
      )
    )
    .addOption(
      new Option(
        `-t, --${migrationsTableArg} <${migrationsTableArg}>`,
        'The table storing which migrations have been run'
      )
    )
    .addOption(
      new Option(
        `-s, --${schemaArg} <${schemaArg}...>`,
        'The schema on which migration will be run (defaults to `public`)'
      )
    )
    .addOption(
      new Option(
        `--${createSchemaArg}`,
        "Creates the configured schema if it doesn't exist"
      )
    )
    .addOption(
      new Option(
        `--${migrationsSchemaArg} <${migrationsSchemaArg}>`,
        'The schema storing table which migrations have been run'
      )
    )
    .addOption(
      new Option(
        `--${createMigrationsSchemaArg}`,
        "Creates the configured migration schema if it doesn't exist"
      )
    )
    .addOption(
      new Option(
        `--no-${checkOrderArg}`,
        'Check order of migrations before running them'
      )
    )
    .addOption(
      new Option(
        `--no-${verboseArg}`,
        'Print debug messages - all DB statements run'
      )
    )
    .addOption(
      new Option(
        `--${ignorePatternArg} <${ignorePatternArg}>`,
        `Regex or glob pattern for migration files to be ignored. When using glob pattern, "${useGlobArg}" must be used as well`
      )
    )
    .addOption(
      new Option(
        `--${decamelizeArg}`,
        'Runs decamelize on table/columns/etc names'
      )
    )
    .addOption(
      new Option(
        `--${prettyArg}`,
        'Formats the generated SQL statements with linebreaks and indentation (use `--no-pretty` or omit for single-line statements)'
      )
    )
    .addOption(
      new Option(`--${dryRunArg}`, "Prints the SQL but doesn't run it").default(
        false
      )
    )
    .addOption(
      new Option(`--${fakeArg}`, 'Marks migrations as run').default(false)
    )
    .addOption(
      new Option(
        `--no-${singleTransactionArg}`,
        'Combines all pending migrations into a single database transaction so that if any migration fails, all will be rolled back'
      )
    )
    .addOption(
      new Option(
        `--no-${lockArg}`,
        'When false, disables locking mechanism and checks'
      )
    )
    .addOption(
      new Option(
        `--${lockValueArg} <${lockValueArg}>`,
        'The value to use for the lock'
      )
        .default(PG_MIGRATE_LOCK_ID)
        .argParser(Number)
    )
    .addOption(
      new Option(
        `--${rejectUnauthorizedArg}`,
        'Sets rejectUnauthorized SSL option'
      )
    )
    .addOption(
      new Option(
        `--${timestampArg}`,
        'Treats number argument to up/down migration as timestamp'
      ).default(false)
    )
    .addOption(
      new Option(
        `--${advisoryLockModeArg} <${advisoryLockModeArg}>`,
        'Controls behavior when the migration advisory lock is already held by another process. Use "fail" to throw immediately or "wait" to block until the lock becomes available'
      )
        .choices(['fail', 'wait'])
        .default('fail')
    )
    .addOption(
      new Option(
        `--${tsconfigPathsArg} <${tsconfigPathsArg}>`,
        "Enable jiti's tsconfig paths resolution when loading TS/JS migration files. Pass `true` to auto-discover tsconfig.json, or a path to a specific tsconfig.json"
      )
    );

  return addConfigOptions(command);
}
