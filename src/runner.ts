import { extname } from 'node:path';
import type { ClientBase, ClientConfig } from 'pg';
import type { DBConnection } from './db';
import { db as Db } from './db';
import type { LogFn, Logger } from './logger';
import type { RunMigration } from './migration';
import { getMigrationFilePaths, Migration } from './migration';
import type { ColumnDefinitions } from './operations/tables';
import type { MigrationBuilderActions } from './sqlMigration';
import { sqlMigration as migrateSqlFile } from './sqlMigration';
import { createSchemalize, getMigrationTableSchema, getSchemas } from './utils';

export interface RunnerOptionConfig {
  /**
   * The table storing which migrations have been run.
   */
  migrationsTable: string;

  /**
   * The schema storing table which migrations have been run.
   *
   * (defaults to same value as `schema`)
   */
  migrationsSchema?: string;

  /**
   * The schema on which migration will be run.
   *
   * @default 'public'
   */
  schema?: string | string[];

  /**
   * The directory containing your migration files. This path is resolved from `cwd()`.
   * Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or
   * an array of glob patterns and set `useGlob = true`
   *
   * Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns
   */
  dir: string | string[];

  /**
   * Use [glob](https://www.npmjs.com/package/glob) to find migration files.
   * This will use `dir` _and_ `ignorePattern` to glob-search for migration files.
   *
   * Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns
   *
   * @default false
   */
  useGlob?: boolean;

  /**
   * Check order of migrations before running them.
   */
  checkOrder?: boolean;

  /**
   * Direction of migration-run.
   */
  direction: MigrationDirection;

  /**
   * Number of migration to run.
   */
  count?: number;

  /**
   * Treats `count` as timestamp.
   */
  timestamp?: boolean;

  /**
   * Regex pattern for file names to ignore (ignores files starting with `.` by default).
   * Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or
   * an array of glob patterns and set `isGlob = true`
   *
   * Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns
   */
  ignorePattern?: string | string[];

  /**
   * Run only migration with this name.
   */
  file?: string;

  dryRun?: boolean;

  /**
   * Creates the configured schema if it doesn't exist.
   */
  createSchema?: boolean;

  /**
   * Creates the configured migration schema if it doesn't exist.
   */
  createMigrationsSchema?: boolean;

  /**
   * Combines all pending migrations into a single transaction so that if any migration fails, all will be rolled back.
   *
   * @default true
   */
  singleTransaction?: boolean;

  /**
   * Disables locking mechanism and checks.
   */
  noLock?: boolean;

  /**
   * Mark migrations as run without actually performing them (use with caution!).
   */
  fake?: boolean;

  /**
   * Runs [`decamelize`](https://github.com/sindresorhus/decamelize) on table/column/etc. names.
   */
  decamelize?: boolean;

  /**
   * Redirect log messages to this function, rather than `console`.
   */
  log?: LogFn;

  /**
   * Redirect messages to this logger object, rather than `console`.
   */
  logger?: Logger;

  /**
   * Print all debug messages like DB queries run (if you switch it on, it will disable `logger.debug` method).
   */
  verbose?: boolean;
}

export interface RunnerOptionUrl {
  /**
   * Connection string or client config which is passed to [new pg.Client](https://node-postgres.com/api/client#constructor)
   */
  databaseUrl: string | ClientConfig;
}

export interface RunnerOptionClient {
  /**
   * Instance of [new pg.Client](https://node-postgres.com/api/client).
   *
   * Instance should be connected to DB and after finishing migration, user is responsible to close connection.
   */
  dbClient: ClientBase;
}

export type RunnerOption = RunnerOptionConfig &
  (RunnerOptionClient | RunnerOptionUrl);

/**
 * Random but well-known identifier shared by all instances of `node-pg-migrate`.
 */
const PG_MIGRATE_LOCK_ID = 7_241_865_325_823_964;

const idColumn = 'id';
const nameColumn = 'name';
const runOnColumn = 'run_on';

async function loadMigrations(
  db: DBConnection,
  options: RunnerOption,
  logger: Logger
): Promise<Migration[]> {
  try {
    let shorthands: ColumnDefinitions = {};
    const absoluteFilePaths = await getMigrationFilePaths(options.dir, {
      ignorePattern: options.ignorePattern,
      useGlob: options.useGlob,
      logger,
    });

    const migrations = await Promise.all(
      absoluteFilePaths.map(async (filePath) => {
        const actions: MigrationBuilderActions =
          extname(filePath) === '.sql'
            ? await migrateSqlFile(filePath)
            : await import(`file://${filePath}`);
        shorthands = { ...shorthands, ...actions.shorthands };

        return new Migration(
          db,
          filePath,
          actions,
          options,
          {
            ...shorthands,
          },
          logger
        );
      })
    );

    return migrations;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(`Can't get migration files: ${error.stack}`);
  }
}

async function lock(db: DBConnection): Promise<void> {
  const [result] = await db.select(
    `SELECT pg_try_advisory_lock(${PG_MIGRATE_LOCK_ID}) AS "lockObtained"`
  );

  if (!result.lockObtained) {
    throw new Error('Another migration is already running');
  }
}

async function unlock(db: DBConnection): Promise<void> {
  const [result] = await db.select(
    `SELECT pg_advisory_unlock(${PG_MIGRATE_LOCK_ID}) AS "lockReleased"`
  );

  if (!result.lockReleased) {
    throw new Error('Failed to release migration lock');
  }
}

async function ensureMigrationsTable(
  db: DBConnection,
  options: RunnerOption
): Promise<void> {
  try {
    const schema = getMigrationTableSchema(options);
    const { migrationsTable } = options;
    const fullTableName = createSchemalize({
      shouldDecamelize: Boolean(options.decamelize),
      shouldQuote: true,
    })({
      schema,
      name: migrationsTable,
    });

    const migrationTables = await db.select(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}'`
    );

    if (migrationTables && migrationTables.length === 1) {
      const primaryKeyConstraints = await db.select(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}' AND constraint_type = 'PRIMARY KEY'`
      );

      if (!primaryKeyConstraints || primaryKeyConstraints.length !== 1) {
        await db.query(
          `ALTER TABLE ${fullTableName} ADD PRIMARY KEY (${idColumn})`
        );
      }
    } else {
      await db.query(
        `CREATE TABLE ${fullTableName} (${idColumn} SERIAL PRIMARY KEY, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL)`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(`Unable to ensure migrations table: ${error.stack}`);
  }
}

async function getRunMigrations(
  db: DBConnection,
  options: RunnerOption
): Promise<string[]> {
  const schema = getMigrationTableSchema(options);
  const { migrationsTable } = options;
  const fullTableName = createSchemalize({
    shouldDecamelize: Boolean(options.decamelize),
    shouldQuote: true,
  })({
    schema,
    name: migrationsTable,
  });

  return db.column(
    nameColumn,
    `SELECT ${nameColumn} FROM ${fullTableName} ORDER BY ${runOnColumn}, ${idColumn}`
  );
}

function getMigrationsToRun(
  options: RunnerOption,
  runNames: string[],
  migrations: Migration[]
): Migration[] {
  if (options.direction === 'down') {
    const downMigrations: Array<string | Migration> = runNames
      .filter(
        (migrationName) => !options.file || options.file === migrationName
      )
      .map(
        (migrationName) =>
          migrations.find(({ name }) => name === migrationName) || migrationName
      );

    const { count = 1 } = options;

    const toRun = (
      options.timestamp
        ? downMigrations.filter(
            (migration) =>
              typeof migration === 'object' && migration.timestamp >= count
          )
        : downMigrations.slice(-Math.abs(count))
    ).reverse();

    const deletedMigrations = toRun.filter(
      (migration): migration is string => typeof migration === 'string'
    );

    if (deletedMigrations.length > 0) {
      const deletedMigrationsStr = deletedMigrations.join(', ');
      throw new Error(
        `Definitions of migrations ${deletedMigrationsStr} have been deleted.`
      );
    }

    return toRun as Migration[];
  }

  const upMigrations = migrations.filter(
    ({ name }) =>
      !runNames.includes(name) && (!options.file || options.file === name)
  );

  const { count = Number.POSITIVE_INFINITY } = options;

  return options.timestamp
    ? upMigrations.filter(({ timestamp }) => timestamp <= count)
    : upMigrations.slice(0, Math.abs(count));
}

function checkOrder(runNames: string[], migrations: Migration[]): void {
  const len = Math.min(runNames.length, migrations.length);

  for (let i = 0; i < len; i += 1) {
    const runName = runNames[i];
    const migrationName = migrations[i].name;

    if (runName !== migrationName) {
      throw new Error(
        `Not run migration ${migrationName} is preceding already run migration ${runName}`
      );
    }
  }
}

export type MigrationDirection = 'up' | 'down';

function runMigrations(
  toRun: Migration[],
  method: 'markAsRun' | 'apply',
  direction: MigrationDirection
): Promise<unknown> {
  return toRun.reduce<Promise<unknown>>(
    (promise, migration) => promise.then(() => migration[method](direction)),
    Promise.resolve()
  );
}

function getLogger(options: RunnerOption): Logger {
  const { log, logger, verbose } = options;

  let loggerObject: Logger = console;

  if (typeof logger === 'object') {
    loggerObject = logger;
  } else if (typeof log === 'function') {
    loggerObject = {
      debug: log,
      info: log,
      warn: log,
      error: log,
    };
  }

  return verbose
    ? loggerObject
    : {
        debug: undefined,
        info: loggerObject.info.bind(loggerObject),
        warn: loggerObject.warn.bind(loggerObject),
        error: loggerObject.error.bind(loggerObject),
      };
}

export async function runner(options: RunnerOption): Promise<RunMigration[]> {
  const logger = getLogger(options);

  const connection =
    (options as RunnerOptionClient).dbClient ||
    (options as RunnerOptionUrl).databaseUrl;

  if (connection == null) {
    throw new Error('You must provide either a databaseUrl or a dbClient');
  }

  const db = Db(connection, logger);

  try {
    await db.createConnection();

    if (!options.noLock) {
      await lock(db);
    }

    if (options.schema) {
      const schemas = getSchemas(options.schema);

      if (options.createSchema) {
        await Promise.all(
          schemas.map((schema) =>
            db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
          )
        );
      }

      await db.query(
        `SET search_path TO ${schemas.map((s) => `"${s}"`).join(', ')}`
      );
    }

    if (options.migrationsSchema && options.createMigrationsSchema) {
      await db.query(
        `CREATE SCHEMA IF NOT EXISTS "${options.migrationsSchema}"`
      );
    }

    await ensureMigrationsTable(db, options);

    const [migrations, runNames] = await Promise.all([
      loadMigrations(db, options, logger),
      getRunMigrations(db, options),
    ]);

    if (options.checkOrder !== false) {
      checkOrder(runNames, migrations);
    }

    const toRun: Migration[] = getMigrationsToRun(
      options,
      runNames,
      migrations
    );

    if (toRun.length === 0) {
      logger.info('No migrations to run!');
      return [];
    }

    // TODO: add some fancy colors to logging
    logger.info('> Migrating files:');
    for (const m of toRun) {
      logger.info(`> - ${m.name}`);
    }

    if (options.fake) {
      await runMigrations(toRun, 'markAsRun', options.direction);
    } else if (options.singleTransaction) {
      await db.query('BEGIN');

      try {
        await runMigrations(toRun, 'apply', options.direction);
        await db.query('COMMIT');
      } catch (error) {
        logger.warn('> Rolling back attempted migration ...');
        await db.query('ROLLBACK');
        throw error;
      }
    } else {
      await runMigrations(toRun, 'apply', options.direction);
    }

    return toRun.map((m) => ({
      path: m.path,
      name: m.name,
      timestamp: m.timestamp,
    }));
  } finally {
    if (db.connected()) {
      if (!options.noLock) {
        await unlock(db).catch((error: unknown) => {
          logger.warn((error as Error).message);
        });
      }

      await db.close();
    }
  }
}
