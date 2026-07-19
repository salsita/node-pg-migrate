import type { Command } from 'commander';
import type { RunnerOption } from 'node-pg-migrate';
import { Migration, runner as migrationRunner } from 'node-pg-migrate';
import { format } from 'node:util';
import type { ClientConfig } from 'pg';
// TODO causes tests to fail when `.js` is removed
// @ts-expect-error type exports from @types/pg doesn't match importing
import ConnectionParameters from 'pg/lib/connection-parameters.js';
import { resolveConfig } from './config';
import type { CliOptions } from './options';

/**
 * Forcibly exit the process right after dispatching the action when
 * `--force-exit` was passed. This mirrors the previous behavior where the check
 * ran synchronously after kicking off the (async) migration work.
 */
function handleForceExit(options: CliOptions): void {
  if (options.forceExit) {
    console.log('Forcing exit');
    process.exit(0);
  }
}

/**
 * Handler for the `create` action.
 */
export async function runCreate(
  nameArgs: string[],
  options: CliOptions,
  command: Command
): Promise<void> {
  const config = await resolveConfig(options);

  // replaces spaces with dashes - should help fix some errors
  let newMigrationName = nameArgs.length > 0 ? nameArgs.join('-') : '';
  // forces use of dashes in names - keep thing clean
  newMigrationName = newMigrationName.replace(/[ _]+/g, '-');

  if (!newMigrationName) {
    console.error("'migrationName' is required.");
    command.help({ error: true });
  }

  Migration.create(newMigrationName, config.migrationsDir, {
    filenameFormat: config.migrationsFilenameFormat,
    ...(config.templateFileName
      ? { templateFileName: config.templateFileName }
      : {
          language: config.migrationsFileLanguage,
          ignorePattern: config.ignorePattern,
        }),
  })
    .then(
      (
        // @ts-ignore: when a clean was made, the types are not present in the first run
        migrationPath
      ) => {
        console.log(format('Created migration -- %s', migrationPath));
        process.exit(0);
      }
    )
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });

  handleForceExit(options);
}

/**
 * Handler for the `up`, `down` and `redo` actions.
 */
export async function runMigration(
  action: 'up' | 'down' | 'redo',
  posArgs: string[],
  options: CliOptions
): Promise<void> {
  const config = await resolveConfig(options);

  let dbConnection = config.dbConnection;
  if (!dbConnection) {
    const cp = new ConnectionParameters();

    const dbUrlFromEnv = config.databaseUrlVar
      ? process.env[config.databaseUrlVar]
      : undefined;
    if (!dbUrlFromEnv && (!process.env.PGHOST || !cp.user || !cp.database)) {
      console.error(
        `The ${config.databaseUrlVar} environment variable is not set or incomplete connection parameters are provided.`
      );
      process.exit(1);
    }

    dbConnection = cp;
  }

  const dryRun = options.dryRun;
  if (dryRun) {
    console.log('dry run');
  }

  const singleTransaction = options.singleTransaction;
  const fake = options.fake;
  const TIMESTAMP = options.timestamp;
  const rejectUnauthorized = options.rejectUnauthorized;
  const noLock = !options.lock;
  const lockValue = options.lockValue;
  if (noLock) {
    console.log('no lock');
  }

  const upDownArg = posArgs.length > 0 ? posArgs[0] : null;
  let numMigrations: number;
  let migrationName: string;

  if (upDownArg !== null) {
    const parsedUpDownArg = Number.parseInt(upDownArg, 10);
    // A bare integer positional means "count"; anything else is a migration
    // name. `parsedUpDownArg === Number(upDownArg)` reproduces the previous
    // `parsedUpDownArg == upDownArg` loose comparison (which coerced the string
    // positional to a number) without tripping the eqeqeq lint rule.
    if (parsedUpDownArg === Number(upDownArg)) {
      numMigrations = parsedUpDownArg;
    } else {
      migrationName = posArgs.join('-').replace(/_ /g, '-');
    }
  }

  const databaseUrl =
    typeof dbConnection === 'string'
      ? { connectionString: dbConnection }
      : dbConnection;

  const buildOptions: (
    direction: 'up' | 'down',
    count?: number,
    timestamp?: boolean
  ) => RunnerOption = (direction, _count, _timestamp) => {
    const count = _count === undefined ? numMigrations : _count;
    const timestamp = _timestamp === undefined ? TIMESTAMP : _timestamp;

    return {
      dryRun,
      databaseUrl: {
        // oxlint-disable-next-line typescript/no-misused-spread
        ...databaseUrl,
        ...(typeof rejectUnauthorized === 'boolean'
          ? {
              ssl: {
                // TODO @Shinigami92 2024-04-05: Fix ssl could be boolean
                // @ts-expect-error: ignore possible boolean for now
                ...databaseUrl.ssl,
                rejectUnauthorized,
              },
            }
          : undefined),
      } as ClientConfig,
      dir: config.migrationsDir,
      useGlob: config.useGlob,
      ignorePattern: config.ignorePattern,
      schema: config.schema,
      createSchema: config.createSchema,
      migrationsSchema: config.migrationsSchema,
      createMigrationsSchema: config.createMigrationsSchema,
      migrationsTable: config.migrationsTable,
      count,
      timestamp,
      file: migrationName,
      checkOrder: config.checkOrder,
      verbose: config.verbose,
      direction,
      singleTransaction,
      noLock,
      lockValue,
      fake,
      decamelize: config.decamelize,
      pretty: config.pretty,
      advisoryLockMode: config.advisoryLockMode,
      tsconfigPaths: config.tsconfigPaths,
    };
  };

  const promise =
    action === 'redo'
      ? migrationRunner(buildOptions('down')).then(() =>
          migrationRunner(buildOptions('up', Number.POSITIVE_INFINITY, false))
        )
      : migrationRunner(buildOptions(action));
  promise
    .then(() => {
      console.log('Migrations complete!');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });

  handleForceExit(options);
}
