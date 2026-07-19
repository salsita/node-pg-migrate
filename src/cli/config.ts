import type { DotenvConfigOptions } from 'dotenv';
// Import as node-pg-migrate, so tsdown does not self-reference as '../dist'
// otherwise this could not be imported by esm. The built CLI lives alone in
// bin/, so it must resolve the library through the package `exports` map by
// name rather than via relative paths into dist/.
import { jiti } from 'node-pg-migrate';
import { join, resolve } from 'node:path';
import { cwd } from 'node:process';
import type { ClientConfig } from 'pg';
import type ConnectionParametersType from 'pg/lib/connection-parameters';
import type { FilenameFormat } from '../migration';
import {
  advisoryLockModeArg,
  checkOrderArg,
  createMigrationsSchemaArg,
  createSchemaArg,
  databaseUrlVarArg,
  decamelizeArg,
  ignorePatternArg,
  migrationFileLanguageArg,
  migrationFilenameFormatArg,
  migrationsDirArg,
  migrationsSchemaArg,
  migrationsTableArg,
  prettyArg,
  schemaArg,
  templateFileNameArg,
  tsconfigPathsArg,
  useGlobArg,
  verboseArg,
} from './args';
import type { CliOptions } from './options';

type MigrationFileLanguage =
  | 'js'
  | 'ts'
  | 'sql'
  | 'cjs'
  | 'mjs'
  | 'cts'
  | 'mts';

type DbConnection =
  | string
  | ConnectionParametersType
  | ClientConfig
  | undefined;

/**
 * The fully resolved configuration after merging CLI flags, dotenv, the
 * `config` package and an optional `--config-file`, with the post-merge
 * defaults applied.
 */
export interface ResolvedConfig {
  databaseUrlVar: string | undefined;
  dbConnection: DbConnection;
  migrationsDir: string;
  useGlob: boolean;
  ignorePattern: string | undefined;
  schema: string | string[];
  createSchema: boolean | undefined;
  migrationsSchema: string | undefined;
  createMigrationsSchema: boolean | undefined;
  migrationsTable: string;
  migrationsFileLanguage: MigrationFileLanguage;
  migrationsFilenameFormat: FilenameFormat;
  templateFileName: string | undefined;
  checkOrder: boolean;
  verbose: boolean;
  decamelize: boolean | undefined;
  pretty: boolean | undefined;
  advisoryLockMode: 'fail' | 'wait';
  tsconfigPaths: boolean | string | undefined;
}

/**
 * Try to import a module and return null if it doesn't exist.
 *
 * @param moduleName The name of the module to import.
 */
async function tryImport<TModule = unknown>(
  moduleName: string
): Promise<TModule | null> {
  try {
    const module = await import(moduleName);
    return module.default || module;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ERR_MODULE_NOT_FOUND' ||
        error.code === 'MODULE_NOT_FOUND')
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Coerces the `--tsconfig-paths` CLI value into the `boolean | string` shape that
 * jiti expects: the literals `true`/`false` toggle auto-discovery, any other
 * string is treated as an explicit path to a `tsconfig.json`.
 */
function parseTsconfigPaths(
  val: string | undefined
): boolean | string | undefined {
  if (val === undefined) {
    return undefined;
  }

  if (val === 'true') {
    return true;
  }

  if (val === 'false') {
    return false;
  }

  return val;
}

function applyIf<TArg, TKey extends string = string>(
  arg: TArg,
  key: TKey,
  obj: { [k in TKey]?: unknown },
  condition: (val: (typeof obj)[TKey]) => val is TArg
): TArg {
  if (arg !== undefined && !(key in obj)) {
    return arg;
  }

  const val = obj[key];

  return condition(val) ? val : arg;
}

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

function isBooleanOrString(val: unknown): val is boolean | string {
  return typeof val === 'boolean' || typeof val === 'string';
}

function isClientConfig(val: unknown): val is ClientConfig & { name?: string } {
  return (
    typeof val === 'object' &&
    val !== null &&
    (('host' in val && !!val.host) ||
      ('port' in val && !!val.port) ||
      ('name' in val && !!val.name) ||
      ('database' in val && !!val.database))
  );
}

/**
 * Resolves the runtime configuration from the parsed CLI options.
 *
 * The precedence is intentionally preserved from the previous implementation:
 * external config sources (the `config` package and `--config-file`) OVERRIDE
 * CLI flags via {@link applyIf}. This is arguably surprising (one would expect
 * explicit flags to win) but changing it would be a behavioral break, so it is
 * kept as-is here and could be revisited in a dedicated follow-up.
 */
export async function resolveConfig(
  options: CliOptions
): Promise<ResolvedConfig> {
  /* Load env before accessing process.env */
  const envPath = options.envPath;

  // Create default dotenv config
  const dotenvConfig: DotenvConfigOptions = {
    quiet: true,
  };

  // If the path has been configured, add it to the config, otherwise don't change the default dotenv path
  if (envPath) {
    dotenvConfig.path = envPath;
  }

  const dotenv = await tryImport<typeof import('dotenv')>('dotenv');
  if (dotenv) {
    // Load config from ".env" file
    const myEnv = dotenv.config(dotenvConfig);
    const dotenvExpand =
      await tryImport<typeof import('dotenv-expand')>('dotenv-expand');
    if (dotenvExpand && dotenvExpand.expand) {
      dotenvExpand.expand(myEnv);
    }
  }

  const databaseUrlVar = options.databaseUrlVar;

  let MIGRATIONS_DIR = options.migrationsDir;
  let USE_GLOB = options.useGlob;
  let DB_CONNECTION: DbConnection = databaseUrlVar
    ? process.env[databaseUrlVar]
    : undefined;
  let IGNORE_PATTERN = options.ignorePattern;
  let SCHEMA: string | string[] | undefined = options.schema;
  let CREATE_SCHEMA = options.createSchema;
  let MIGRATIONS_SCHEMA = options.migrationsSchema;
  let CREATE_MIGRATIONS_SCHEMA = options.createMigrationsSchema;
  let MIGRATIONS_TABLE = options.migrationsTable;
  let MIGRATIONS_FILE_LANGUAGE = options.migrationFileLanguage as
    | MigrationFileLanguage
    | undefined;
  let MIGRATIONS_FILENAME_FORMAT = options.migrationFilenameFormat as
    | FilenameFormat
    | undefined;
  let TEMPLATE_FILE_NAME = options.templateFileName;
  let CHECK_ORDER = options.checkOrder;
  let VERBOSE = options.verbose;
  let DECAMELIZE = options.decamelize;
  let PRETTY = options.pretty;
  let ADVISORY_LOCK_MODE = options.advisoryLockMode as
    | 'fail'
    | 'wait'
    | undefined;
  let TSCONFIG_PATHS: boolean | string | undefined = parseTsconfigPaths(
    options.tsconfigPaths
  );

  function readJson(json: unknown): void {
    if (typeof json === 'object' && json !== null) {
      SCHEMA = applyIf(
        SCHEMA,
        schemaArg,
        json,
        (val): val is string | string[] =>
          Array.isArray(val) || (isString(val) && val.length > 0)
      );
      CREATE_SCHEMA = applyIf(CREATE_SCHEMA, createSchemaArg, json, isBoolean);
      USE_GLOB = applyIf(USE_GLOB, useGlobArg, json, isBoolean);
      MIGRATIONS_DIR = applyIf(
        MIGRATIONS_DIR,
        migrationsDirArg,
        json,
        isString
      );
      MIGRATIONS_SCHEMA = applyIf(
        MIGRATIONS_SCHEMA,
        migrationsSchemaArg,
        json,
        isString
      );
      CREATE_MIGRATIONS_SCHEMA = applyIf(
        CREATE_MIGRATIONS_SCHEMA,
        createMigrationsSchemaArg,
        json,
        isBoolean
      );
      MIGRATIONS_TABLE = applyIf(
        MIGRATIONS_TABLE,
        migrationsTableArg,
        json,
        isString
      );
      MIGRATIONS_FILE_LANGUAGE = applyIf(
        MIGRATIONS_FILE_LANGUAGE,
        migrationFileLanguageArg,
        json,
        (val): val is MigrationFileLanguage =>
          val === 'js' ||
          val === 'ts' ||
          val === 'sql' ||
          val === 'cjs' ||
          val === 'mjs' ||
          val === 'cts' ||
          val === 'mts'
      );
      MIGRATIONS_FILENAME_FORMAT = applyIf(
        MIGRATIONS_FILENAME_FORMAT,
        migrationFilenameFormatArg,
        json,
        (val): val is FilenameFormat =>
          val === 'timestamp' || val === 'utc' || val === 'index'
      );
      TEMPLATE_FILE_NAME = applyIf(
        TEMPLATE_FILE_NAME,
        templateFileNameArg,
        json,
        isString
      );
      IGNORE_PATTERN = applyIf(
        IGNORE_PATTERN,
        ignorePatternArg,
        json,
        isString
      );
      CHECK_ORDER = applyIf(CHECK_ORDER, checkOrderArg, json, isBoolean);
      VERBOSE = applyIf(VERBOSE, verboseArg, json, isBoolean);
      DECAMELIZE = applyIf(DECAMELIZE, decamelizeArg, json, isBoolean);
      PRETTY = applyIf(PRETTY, prettyArg, json, isBoolean);
      TSCONFIG_PATHS = applyIf(
        TSCONFIG_PATHS,
        tsconfigPathsArg,
        json,
        isBooleanOrString
      );
      DB_CONNECTION = applyIf(
        DB_CONNECTION,
        databaseUrlVarArg,
        json,
        (val): val is string | ConnectionParametersType | ClientConfig =>
          typeof val === 'string' || typeof val === 'object'
      );

      if ('url' in json && json.url) {
        DB_CONNECTION ??= json.url as DbConnection;
      } else if (isClientConfig(json) && !DB_CONNECTION) {
        DB_CONNECTION = {
          user: json.user,
          host: json.host || 'localhost',
          database: json.name || json.database,
          password: json.password,
          port: json.port || 5432,
          ssl: json.ssl,
        };
      }
      ADVISORY_LOCK_MODE = applyIf(
        ADVISORY_LOCK_MODE,
        advisoryLockModeArg,
        json,
        (val): val is 'fail' | 'wait' => val === 'fail' || val === 'wait'
      );
    } else {
      DB_CONNECTION ??= json as DbConnection;
    }
  }

  // Load config (and suppress the no-config-warning)
  const oldSuppressWarning = process.env.SUPPRESS_NO_CONFIG_WARNING;
  process.env.SUPPRESS_NO_CONFIG_WARNING = 'yes';
  const configValue = options.configValue as string;
  const config = await tryImport<typeof import('config')>('config');
  if (config?.has(configValue)) {
    const db = config.get(configValue);
    readJson(db);
  }

  process.env.SUPPRESS_NO_CONFIG_WARNING = oldSuppressWarning;

  const configFileName = options.configFile;
  if (configFileName) {
    const configModule: unknown = await jiti.import(resolve(configFileName));

    const json: unknown =
      configModule &&
      typeof configModule === 'object' &&
      'default' in configModule
        ? (configModule as { default: unknown }).default
        : configModule;

    if (json && typeof json === 'object' && configValue in json) {
      readJson((json as Record<string, unknown>)[configValue]);
    } else {
      readJson(json);
    }
  }

  // defaults
  MIGRATIONS_DIR ??= join(cwd(), 'migrations');
  USE_GLOB ??= false;
  MIGRATIONS_FILE_LANGUAGE ??= 'js';
  MIGRATIONS_FILENAME_FORMAT ??= 'timestamp';
  MIGRATIONS_TABLE ??= 'pgmigrations';
  SCHEMA ??= ['public'];
  CHECK_ORDER ??= true;
  VERBOSE ??= true;
  ADVISORY_LOCK_MODE ??= 'fail';

  return {
    databaseUrlVar,
    dbConnection: DB_CONNECTION,
    migrationsDir: MIGRATIONS_DIR,
    useGlob: USE_GLOB,
    ignorePattern: IGNORE_PATTERN,
    schema: SCHEMA,
    createSchema: CREATE_SCHEMA,
    migrationsSchema: MIGRATIONS_SCHEMA,
    createMigrationsSchema: CREATE_MIGRATIONS_SCHEMA,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsFileLanguage: MIGRATIONS_FILE_LANGUAGE,
    migrationsFilenameFormat: MIGRATIONS_FILENAME_FORMAT,
    templateFileName: TEMPLATE_FILE_NAME,
    checkOrder: CHECK_ORDER,
    verbose: VERBOSE,
    decamelize: DECAMELIZE,
    pretty: PRETTY,
    advisoryLockMode: ADVISORY_LOCK_MODE,
    tsconfigPaths: TSCONFIG_PATHS,
  };
}
