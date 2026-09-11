import type { ClientBase, ClientConfig } from 'pg';
import type { DBConnection } from './db';
import { db as Db } from './db';
import type { LogFn, Logger } from './logger';
import type { RunMigration } from './migration';
import { getMigrationFilePaths, Migration } from './migration';
import type { MigrationLoaderConfig } from './migrationLoader';
import { loadMigrationUnits } from './migrationLoader';
import type { ColumnDefinitions } from './operations/tables';
import {
  getMigrationTableName,
  getMigrationTableSchema,
  getSchemas,
  toArray,
} from './utils';

type AdvisoryLockMode = 'fail' | 'wait';

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
   * Marks `schema` as a fallback filled in by the caller rather than a schema the user chose,
   * as the CLI does when `--schema` is not given. It still sets the `search_path`, but it does
   * not vouch for where the migration history lives: if the migrations table is missing or
   * empty there while another schema already holds one, the run is refused.
   *
   * Without `schema` this changes nothing: `public` is then already only a fallback.
   *
   * @default false
   */
  schemaIsDefault?: boolean;

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

  /**
   * Print the SQL that would be run without applying anything.
   *
   * The whole session runs inside a read-only transaction, so nothing is created, recorded
   * or written - not the migrations schema, not the migrations table, and not any statement
   * a migration issues itself through `pgm.db.query(...)`. No advisory lock is taken.
   *
   * @default false
   */
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
   * Value to use for the lock.
   */
  lockValue?: number;

  /**
   * Mark migrations as run without actually performing them (use with caution!).
   */
  fake?: boolean;

  /**
   * Runs [`decamelize`](https://github.com/sindresorhus/decamelize) on table/column/etc. names.
   */
  decamelize?: boolean;

  /**
   * Format the generated SQL statements with linebreaks and indentation for
   * better readability. When `false`, each statement is emitted as a single
   * line.
   *
   * @default false
   */
  pretty?: boolean;

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

  /**
   * Controls behavior when the migration advisory lock is already held by another process. Use `fail` to throw immediately or wait to block until the lock becomes available. Default to `fail`
   */
  advisoryLockMode?: AdvisoryLockMode;
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
  MigrationLoaderConfig &
  (RunnerOptionClient | RunnerOptionUrl);

/**
 * Random but well-known identifier shared by all instances of `node-pg-migrate`.
 */
export const PG_MIGRATE_LOCK_ID = 7_241_865_325_823_964;

const idColumn = 'id';
const nameColumn = 'name';
const runOnColumn = 'run_on';

export async function loadMigrations(
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
    const migrations: Migration[] = [];

    // Actual loading of files has been delegated to the loadMigrationUnits function.
    const migrationUnits = await loadMigrationUnits(options, absoluteFilePaths);
    for (const { id: filePath, actions } of migrationUnits) {
      shorthands = { ...shorthands, ...actions.shorthands };

      migrations.push(
        new Migration(
          db,
          filePath,
          actions,
          options,
          {
            ...shorthands,
          },
          logger
        )
      );
    }

    return migrations;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new TypeError(`Error loading migration files: ${error.message}`, {
        cause: error,
      });
    }

    throw new Error('Error loading migration files: Unknown error', {
      cause: error,
    });
  }
}

async function lock(
  db: DBConnection,
  lockValue: number = PG_MIGRATE_LOCK_ID,
  advisoryLockMode: AdvisoryLockMode = 'fail'
): Promise<void> {
  if (advisoryLockMode === 'wait') {
    await db.query(`SELECT pg_advisory_lock(${lockValue})`);
    return;
  }

  const [result] = await db.select(
    `SELECT pg_try_advisory_lock(${lockValue}) AS "lockObtained"`
  );

  if (!result.lockObtained) {
    throw new Error(
      "Another migration is already running. Advisory lock mode is set to 'fail'."
    );
  }
}

async function unlock(
  db: DBConnection,
  lockValue: number = PG_MIGRATE_LOCK_ID
): Promise<void> {
  const [result] = await db.select(
    `SELECT pg_advisory_unlock(${lockValue}) AS "lockReleased"`
  );

  if (!result.lockReleased) {
    throw new Error('Failed to release migration lock');
  }
}

/**
 * `read_only_sql_transaction` - raised when a statement tries to write inside the read-only
 * transaction a dry run wraps itself in.
 */
const READ_ONLY_SQLSTATE = '25006';

const AUTOCOMMIT_BEFORE_DDL = 'autocommit_before_ddl';

/**
 * Read a session setting without failing when the server does not know it.
 */
async function getSetting(
  db: DBConnection,
  name: string
): Promise<string | undefined> {
  const [row] = await db.select(
    `SELECT current_setting('${name}', true) AS setting`
  );

  const setting: unknown = row?.setting;

  return typeof setting === 'string' && setting.length > 0
    ? setting.toLowerCase()
    : undefined;
}

/**
 * Make sure the database will really refuse the writes a dry run is not supposed to make.
 *
 * CockroachDB v25 and newer default `autocommit_before_ddl` to `on`, which commits DDL
 * immediately and escapes the surrounding transaction - including a read-only one. Measured
 * on v25.3.5: a `CREATE TABLE` inside `BEGIN; SET TRANSACTION READ ONLY;` was applied for
 * real. Turning the setting off restores the correct behavior, but a dry run that might not
 * be dry has to fail closed rather than warn and continue.
 *
 * Servers that do not know the setting at all (PostgreSQL, CockroachDB v23.2) keep DDL
 * inside the transaction and reject it in a read-only one, so there is nothing to do there.
 */
async function assertDryRunIsEnforceable(db: DBConnection): Promise<void> {
  const isOff = (value: string | undefined): boolean =>
    value === undefined || value === 'off' || value === 'false';

  if (isOff(await getSetting(db, AUTOCOMMIT_BEFORE_DDL))) {
    return;
  }

  await db.query(`SET ${AUTOCOMMIT_BEFORE_DDL} = false`);

  const value = await getSetting(db, AUTOCOMMIT_BEFORE_DDL);

  if (!isOff(value)) {
    throw new Error(
      `Refusing to dry run: this server auto-commits DDL (${AUTOCOMMIT_BEFORE_DDL} = ${value}), so migrations could escape the read-only transaction and be applied for real.`
    );
  }
}

async function createSchemas(
  db: DBConnection,
  schemas: ReadonlyArray<string>,
  dryRun: boolean,
  logger: Logger
): Promise<void> {
  if (dryRun) {
    for (const schema of schemas) {
      logger.info(`> Would create schema "${schema}"`);
    }

    return;
  }

  await Promise.all(
    schemas.map((schema) => db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`))
  );
}

interface QueryParameters {
  values: unknown[];

  /**
   * Adds `value` to `values` and returns its placeholder.
   */
  bind: (value: unknown) => string;
}

/**
 * The values of a parameterized query. Each placeholder is handed out as its value is bound,
 * so the numbering always matches, however the conditions using them are ordered.
 */
function queryParameters(): QueryParameters {
  const values: unknown[] = [];

  return { values, bind: (value) => `$${values.push(value)}` };
}

/**
 * `FROM` and `WHERE` for the relations named `name` (a placeholder) that also meet
 * `conditions`, looked up in the system catalogs. Not in `information_schema`: it only shows
 * objects the connected role holds privileges on, so a role without a grant on an existing
 * migrations table would be told it does not exist, try to create it and fail with "already
 * exists" rather than a permissions error.
 */
function relationsNamed(name: string, ...conditions: string[]): string {
  return `FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE ${[`c.relname = ${name}`, ...conditions].join(' AND ')}`;
}

/**
 * The relation kinds `information_schema.tables` lists: tables, partitioned tables, views and
 * foreign tables.
 */
const LISTED_RELATION_KINDS = "c.relkind IN ('r', 'p', 'v', 'f')";

/**
 * The run's own migrations table, as `information_schema.tables` would list it.
 */
function ownMigrationsTable(
  options: RunnerOption,
  { bind }: QueryParameters
): string {
  return relationsNamed(
    bind(options.migrationsTable),
    LISTED_RELATION_KINDS,
    `n.nspname = ${bind(getMigrationTableSchema(options))}`
  );
}

/**
 * Whether the table storing which migrations have been run already exists.
 *
 * This is a plain `SELECT`, so it is also safe inside the read-only transaction a dry run
 * uses - unlike querying the table itself, which would raise `42P01` and poison the
 * transaction for every statement that follows.
 */
async function migrationsTableExists(
  db: DBConnection,
  options: RunnerOption
): Promise<boolean> {
  const parameters = queryParameters();
  const migrationTables = await db.select(
    `SELECT 1 ${ownMigrationsTable(options, parameters)}`,
    parameters.values
  );

  return migrationTables?.length === 1;
}

async function ensureMigrationsTable(
  db: DBConnection,
  options: RunnerOption,
  hasMigrationsTable: boolean
): Promise<void> {
  try {
    const fullTableName = getMigrationTableName(options);

    if (hasMigrationsTable) {
      const parameters = queryParameters();
      const primaryKeyConstraints = await db.select(
        `SELECT 1 FROM pg_catalog.pg_constraint WHERE contype = 'p' AND conrelid = (SELECT c.oid ${ownMigrationsTable(options, parameters)})`,
        parameters.values
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
  } catch (error: any) {
    throw new Error(`Unable to ensure migrations table: ${error.stack}`, {
      cause: error,
    });
  }
}

async function getRunMigrations(
  db: DBConnection,
  options: RunnerOption
): Promise<string[]> {
  return db.column(
    nameColumn,
    `SELECT ${nameColumn} FROM ${getMigrationTableName(options)} ORDER BY ${runOnColumn}, ${idColumn}`
  );
}

/**
 * Whether the user pointed the run at a schema, rather than it falling back to the default.
 */
function isSchemaChosen(options: RunnerOption): boolean {
  return !options.schemaIsDefault && toArray(options.schema).some(Boolean);
}

interface MigrationsTableLocation {
  schema: string;

  /**
   * Whether the connected role may read the table, and so tell whether it records anything.
   */
  readable: boolean;
}

/**
 * The columns every migrations table has. A table in another schema only counts as a history
 * when it has all of them: an unrelated table that merely shares a generic name such as
 * `migrations` is not one, and pointing the run at it would fail.
 */
const MIGRATIONS_TABLE_COLUMNS = [idColumn, nameColumn, runOnColumn];

/**
 * Whether the migrations table in `schema` records anything. Unlike the catalog lookups, this
 * reads the table itself: the catalog has just shown that it exists and that this role may read
 * it, so it cannot raise the `42P01` that would poison a dry run's read-only transaction.
 */
async function recordsMigrations(
  db: DBConnection,
  options: RunnerOption,
  schema: string
): Promise<boolean> {
  const rows = await db.select(
    `SELECT 1 FROM ${getMigrationTableName(options, schema)} LIMIT 1`
  );

  return rows.length > 0;
}

/**
 * Look for the migration history this run would otherwise ignore: a table named like the
 * migrations table, in another schema, that already records migrations - or that this role
 * cannot read, and so might.
 *
 * Where to look depends on how the run was pointed at its own table. A `migrationsSchema`
 * is taken at its word. Without one, the table follows the first `schema`: when the user
 * chose those schemas, other schemas belong to other tenants and only the rest of the list
 * is searched (a reordered list moves the table); when the schema is only a fallback, any
 * schema may hold the history.
 */
async function findHistoryElsewhere(
  db: DBConnection,
  options: RunnerOption
): Promise<MigrationsTableLocation | undefined> {
  if (options.migrationsSchema !== undefined) {
    return undefined;
  }

  const schema = getMigrationTableSchema(options);
  const searched = isSchemaChosen(options)
    ? getSchemas(options.schema).filter((s) => s !== schema)
    : undefined;

  if (searched?.length === 0) {
    return undefined;
  }

  const parameters = queryParameters();
  const name = parameters.bind(options.migrationsTable);
  const conditions = [
    // Local tables only: a view is not a history, and a foreign table would be read on another
    // server, failing the run whenever that server is down.
    "c.relkind IN ('r', 'p')",
    `n.nspname <> ${parameters.bind(schema)}`,
    String.raw`n.nspname NOT LIKE 'pg\_%'`,
    "n.nspname NOT IN ('information_schema', 'crdb_internal')",
    `(SELECT count(*) FROM pg_catalog.pg_attribute a WHERE a.attrelid = c.oid AND a.attname = ANY(${parameters.bind(MIGRATIONS_TABLE_COLUMNS)}::text[]) AND NOT a.attisdropped) = ${MIGRATIONS_TABLE_COLUMNS.length}`,
  ];

  if (searched) {
    conditions.push(`n.nspname = ANY(${parameters.bind(searched)}::text[])`);
  }

  const tables: MigrationsTableLocation[] = await db.select(
    `SELECT n.nspname AS "schema", has_schema_privilege(n.oid, 'USAGE') AND has_table_privilege(c.oid, 'SELECT') AS "readable" ${relationsNamed(name, ...conditions)} ORDER BY n.nspname`,
    parameters.values
  );

  for (const table of tables) {
    if (
      !table.readable ||
      (await recordsMigrations(db, options, table.schema))
    ) {
      return table;
    }
  }

  return undefined;
}

/**
 * Why a run that finds no history where it looks is refused, and which options point it at the
 * history found elsewhere - or start a new one on purpose.
 */
function describeHistoryElsewhere(
  options: RunnerOption,
  history: MigrationsTableLocation,
  hasMigrationsTable: boolean
): string {
  const schema = getMigrationTableSchema(options);
  const found = history.schema;
  // Starting a new history is offered through `--migrations-schema` in both cases: unlike
  // `--schema`, it does not also change the `search_path` a run without a schema leaves alone.
  const hint = isSchemaChosen(options)
    ? `The migrations table follows the first \`--schema\` entry, and "${found}" is further down that list. To continue that history, pass \`--migrations-schema ${found}\` (or list "${found}" first)`
    : `No schema was configured, so "${schema}" is only the fallback. To continue that history, pass \`--schema ${found}\` (or \`--migrations-schema ${found}\` if only the migrations table lives there)`;

  return `Refusing to run: the migrations table ${getMigrationTableName(options)} ${hasMigrationsTable ? 'is empty' : 'does not exist'}, but ${getMigrationTableName(options, found)} ${history.readable ? 'already records migrations' : 'exists and cannot be read by this role'}. Carrying on would start the history over and could apply migrations that have already run. ${hint}; to start a new one in "${schema}", pass \`--migrations-schema ${schema}\`. From the API, use the \`schema\` and \`migrationsSchema\` options.`;
}

interface MigrationHistory {
  hasMigrationsTable: boolean;
  runNames: string[];
}

/**
 * Read which migrations have been run, once it is clear the history really is where the run
 * looks for it. That place only comes from configuration: when the migrations table there is
 * missing or empty while another schema holds a history, starting over would replay every
 * migration - failing half-way (`relation "…" does not exist`) or silently duplicating
 * objects into the wrong schema. The run is refused instead, before it has created anything.
 */
async function readMigrationHistory(
  db: DBConnection,
  options: RunnerOption
): Promise<MigrationHistory> {
  const hasMigrationsTable = await migrationsTableExists(db, options);
  const runNames: string[] = hasMigrationsTable
    ? await getRunMigrations(db, options)
    : [];
  const history =
    runNames.length === 0 ? await findHistoryElsewhere(db, options) : undefined;

  if (history) {
    throw new Error(
      describeHistoryElsewhere(options, history, hasMigrationsTable)
    );
  }

  return { hasMigrationsTable, runNames };
}

/**
 * Read the history and load the migration files together - loading touches no database - but
 * report the history check's verdict first: a refusal matters more than a migration file that
 * fails to load.
 */
async function readHistoryAndMigrations(
  db: DBConnection,
  options: RunnerOption,
  logger: Logger
): Promise<[MigrationHistory, Migration[]]> {
  const [history, migrations] = await Promise.allSettled([
    readMigrationHistory(db, options),
    loadMigrations(db, options, logger),
  ]);

  if (history.status === 'rejected') {
    throw history.reason;
  }

  if (migrations.status === 'rejected') {
    throw migrations.reason;
  }

  return [history.value, migrations.value];
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
    ).toReversed();

    const deletedMigrations = toRun.filter(
      (migration): migration is string => typeof migration === 'string'
    );

    if (deletedMigrations.length > 0) {
      const deletedMigrationsStr = deletedMigrations.join(', ');
      throw new Error(
        `Definitions of migrations ${deletedMigrationsStr} have been deleted.`
      );
    }

    return toRun.filter(
      (migration): migration is Migration => typeof migration === 'object'
    );
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

function isReadOnlyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === READ_ONLY_SQLSTATE
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

  const dbClient = 'dbClient' in options ? options.dbClient : undefined;
  const databaseUrl =
    'databaseUrl' in options ? options.databaseUrl : undefined;
  const connection = dbClient ?? databaseUrl;

  if (connection == null) {
    throw new Error('You must provide either a databaseUrl or a dbClient');
  }

  const db = Db(connection, logger);
  const dryRun = Boolean(options.dryRun);
  let readOnlyTransaction = false;

  try {
    await db.createConnection();

    if (dryRun) {
      await assertDryRunIsEnforceable(db);

      // From here on the database itself refuses every write, including the ones we do not
      // control: a migration reaching for `pgm.db.query('DROP TABLE ...')` is stopped by
      // the server rather than by our own honor system.
      await db.query('BEGIN');
      await db.query('SET TRANSACTION READ ONLY');
      readOnlyTransaction = true;
    }

    // A dry run never writes, so it has nothing to serialize against - and it must not be
    // able to block a real deployment while it prints.
    if (!options.noLock && !dryRun) {
      await lock(db, options.lockValue, options.advisoryLockMode);
    }

    // Before anything is created: a run that is refused must leave the database as it was.
    const [{ hasMigrationsTable, runNames }, migrations] =
      await readHistoryAndMigrations(db, options, logger);

    if (options.schema) {
      const schemas = getSchemas(options.schema);

      if (options.createSchema) {
        await createSchemas(db, schemas, dryRun, logger);
      }

      await db.query(
        `SET search_path TO ${schemas.map((s) => `"${s}"`).join(', ')}`
      );
    }

    if (options.migrationsSchema && options.createMigrationsSchema) {
      await createSchemas(db, [options.migrationsSchema], dryRun, logger);
    }

    if (dryRun) {
      if (!hasMigrationsTable) {
        logger.info(
          `> Would create migrations table ${getMigrationTableName(options)}`
        );
      }
    } else {
      await ensureMigrationsTable(db, options, hasMigrationsTable);
    }

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

    try {
      if (options.fake) {
        await runMigrations(toRun, 'markAsRun', options.direction);
      } else if (dryRun || !options.singleTransaction) {
        // A dry run is already inside its own read-only transaction; opening another one
        // and committing it would end exactly the guarantee it is there to provide.
        await runMigrations(toRun, 'apply', options.direction);
      } else {
        await db.query('BEGIN');

        try {
          await runMigrations(toRun, 'apply', options.direction);
          await db.query('COMMIT');
        } catch (error) {
          logger.warn('> Rolling back attempted migration ...');
          await db.query('ROLLBACK');
          throw error;
        }
      }
    } catch (error) {
      if (dryRun && isReadOnlyViolation(error)) {
        throw new Error(
          'This migration writes to the database directly (e.g. through `pgm.db.query(...)`), which a dry run refuses: it holds a read-only transaction so that nothing can be applied. Run without `--dry-run` to apply it.',
          { cause: error }
        );
      }

      throw error;
    }

    return toRun.map((m) => ({
      path: m.path,
      name: m.name,
      timestamp: m.timestamp,
    }));
  } finally {
    if (db.connected()) {
      if (readOnlyTransaction) {
        // Ends the read-only transaction. It cannot have changed anything, but leaving it
        // open would strand the session for an externally provided client.
        await db.query('ROLLBACK').catch((error: unknown) => {
          logger.warn(error instanceof Error ? error.message : String(error));
        });
      }

      if (!options.noLock && !dryRun) {
        await unlock(db, options.lockValue).catch((error: unknown) => {
          logger.warn(error instanceof Error ? error.message : String(error));
        });
      }

      await db.close();
    }
  }
}
