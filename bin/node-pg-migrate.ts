#!/usr/bin/env node

import type { DotenvConfigOptions } from 'dotenv';
// Import as node-pg-migrate, so tsup does not self-reference as '../dist'
// otherwise this could not be imported by esm
import { default as migrationRunner, Migration } from 'node-pg-migrate';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import type { ClientConfig } from 'pg';
// This needs to be imported with .js extension, otherwise it will fail in esm
import ConnectionParameters from 'pg/lib/connection-parameters.js';
import yargs from 'yargs/yargs';
import type { RunnerOption } from '../src';
import type { FilenameFormat } from '../src/migration';

process.on('uncaughtException', (err) => {
  console.error(err);
  process.exit(1);
});

function tryRequire<TModule = unknown>(moduleName: string): TModule | null {
  try {
    return require(moduleName);
  } catch (error) {
    if (
      // @ts-expect-error: TS doesn't know about code property
      error?.code !== 'MODULE_NOT_FOUND'
    ) {
      throw error;
    }

    return null;
  }
}

const schemaArg = 'schema';
const createSchemaArg = 'create-schema';
const databaseUrlVarArg = 'database-url-var';
const migrationsDirArg = 'migrations-dir';
const migrationsTableArg = 'migrations-table';
const migrationsSchemaArg = 'migrations-schema';
const createMigrationsSchemaArg = 'create-migrations-schema';
const migrationFileLanguageArg = 'migration-file-language';
const migrationFilenameFormatArg = 'migration-filename-format';
const templateFileNameArg = 'template-file-name';
const checkOrderArg = 'check-order';
const configValueArg = 'config-value';
const configFileArg = 'config-file';
const ignorePatternArg = 'ignore-pattern';
const singleTransactionArg = 'single-transaction';
const lockArg = 'lock';
const timestampArg = 'timestamp';
const dryRunArg = 'dry-run';
const fakeArg = 'fake';
const decamelizeArg = 'decamelize';
const tsconfigArg = 'tsconfig';
const verboseArg = 'verbose';
const rejectUnauthorizedArg = 'reject-unauthorized';
const envPathArg = 'envPath';

const parser = yargs(process.argv.slice(2))
  .usage('Usage: $0 [up|down|create|redo] [migrationName] [options]')

  .options({
    [databaseUrlVarArg]: {
      alias: 'd',
      default: 'DATABASE_URL',
      description: 'Name of env variable where is set the databaseUrl',
      type: 'string',
    },
    [migrationsDirArg]: {
      alias: 'm',
      defaultDescription: '"migrations"',
      describe: 'The directory containing your migration files',
      type: 'string',
    },
    [migrationsTableArg]: {
      alias: 't',
      defaultDescription: '"pgmigrations"',
      describe: 'The table storing which migrations have been run',
      type: 'string',
    },
    [schemaArg]: {
      alias: 's',
      defaultDescription: '"public"',
      describe:
        'The schema on which migration will be run (defaults to `public`)',
      type: 'string',
      array: true,
    },
    [createSchemaArg]: {
      defaultDescription: 'false',
      describe: "Creates the configured schema if it doesn't exist",
      type: 'boolean',
    },
    [migrationsSchemaArg]: {
      defaultDescription: 'Same as "schema"',
      describe: 'The schema storing table which migrations have been run',
      type: 'string',
    },
    [createMigrationsSchemaArg]: {
      defaultDescription: 'false',
      describe: "Creates the configured migration schema if it doesn't exist",
      type: 'boolean',
    },
    [checkOrderArg]: {
      defaultDescription: 'true',
      describe: 'Check order of migrations before running them',
      type: 'boolean',
    },
    [verboseArg]: {
      defaultDescription: 'true',
      describe: 'Print debug messages - all DB statements run',
      type: 'boolean',
    },
    [ignorePatternArg]: {
      defaultDescription: '"\\..*"',
      describe: 'Regex pattern for file names to ignore',
      type: 'string',
    },
    [decamelizeArg]: {
      defaultDescription: 'false',
      describe: 'Runs decamelize on table/columns/etc names',
      type: 'boolean',
    },
    [configValueArg]: {
      default: 'db',
      describe: 'Name of config section with db options',
      type: 'string',
    },
    [configFileArg]: {
      alias: 'f',
      describe: 'Name of config file with db options',
      type: 'string',
    },
    [migrationFileLanguageArg]: {
      alias: 'j',
      defaultDescription: 'last one used or "js" if there is no migration yet',
      choices: ['js', 'ts', 'sql'],
      describe:
        'Language of the migration file (Only valid with the create action)',
      type: 'string',
    },
    [migrationFilenameFormatArg]: {
      defaultDescription: '"timestamp"',
      choices: ['timestamp', 'utc'],
      describe:
        'Prefix type of migration filename (Only valid with the create action)',
      type: 'string',
    },
    [templateFileNameArg]: {
      describe: 'Path to template for creating migrations',
      type: 'string',
    },
    [tsconfigArg]: {
      describe: 'Path to tsconfig.json file',
      type: 'string',
    },
    [envPathArg]: {
      describe: 'Path to the .env file that should be used for configuration',
      type: 'string',
    },
    [dryRunArg]: {
      default: false,
      describe: "Prints the SQL but doesn't run it",
      type: 'boolean',
    },
    [fakeArg]: {
      default: false,
      describe: 'Marks migrations as run',
      type: 'boolean',
    },
    [singleTransactionArg]: {
      default: true,
      describe:
        'Combines all pending migrations into a single database transaction so that if any migration fails, all will be rolled back',
      type: 'boolean',
    },
    [lockArg]: {
      default: true,
      describe: 'When false, disables locking mechanism and checks',
      type: 'boolean',
    },
    [rejectUnauthorizedArg]: {
      defaultDescription: 'false',
      describe: 'Sets rejectUnauthorized SSL option',
      type: 'boolean',
    },
    [timestampArg]: {
      default: false,
      describe: 'Treats number argument to up/down migration as timestamp',
      type: 'boolean',
    },
  })

  .version()
  .alias('version', 'i')
  .help();

const argv = parser.parseSync();

if (argv.help || argv._.length === 0) {
  parser.showHelp();
  process.exit(1);
}

/* Load env before accessing process.env */
const envPath = argv[envPathArg];

// Create default dotenv config
const dotenvConfig: DotenvConfigOptions & { silent: boolean } = {
  // TODO @Shinigami92 2024-04-05: Does the silent option even still exists and do anything?
  silent: true,
};

// If the path has been configured, add it to the config, otherwise don't change the default dotenv path
if (envPath) {
  dotenvConfig.path = envPath;
}

const dotenv = tryRequire<typeof import('dotenv')>('dotenv');
if (dotenv) {
  // Load config from ".env" file
  const myEnv = dotenv.config(dotenvConfig);
  const dotenvExpand =
    tryRequire<typeof import('dotenv-expand')>('dotenv-expand');
  if (dotenvExpand && dotenvExpand.expand) {
    dotenvExpand.expand(myEnv);
  }
}

let MIGRATIONS_DIR = argv[migrationsDirArg];
let DB_CONNECTION: string | ConnectionParameters | ClientConfig | undefined =
  process.env[argv[databaseUrlVarArg]];
let IGNORE_PATTERN = argv[ignorePatternArg];
let SCHEMA = argv[schemaArg];
let CREATE_SCHEMA = argv[createSchemaArg];
let MIGRATIONS_SCHEMA = argv[migrationsSchemaArg];
let CREATE_MIGRATIONS_SCHEMA = argv[createMigrationsSchemaArg];
let MIGRATIONS_TABLE = argv[migrationsTableArg];
let MIGRATIONS_FILE_LANGUAGE: 'js' | 'ts' | 'sql' | undefined = argv[
  migrationFileLanguageArg
] as 'js' | 'ts' | 'sql' | undefined;
let MIGRATIONS_FILENAME_FORMAT: `${FilenameFormat}` | undefined = argv[
  migrationFilenameFormatArg
] as `${FilenameFormat}` | undefined;
let TEMPLATE_FILE_NAME = argv[templateFileNameArg];
let CHECK_ORDER = argv[checkOrderArg];
let VERBOSE = argv[verboseArg];
let DECAMELIZE = argv[decamelizeArg];
let tsconfigPath = argv[tsconfigArg];

function readTsconfig() {
  if (tsconfigPath) {
    let tsconfig;
    const json5 = tryRequire<typeof import('json5')>('json5');

    try {
      const config = readFileSync(resolve(process.cwd(), tsconfigPath), {
        encoding: 'utf8',
      });
      tsconfig = json5 ? json5.parse(config) : JSON.parse(config);

      if (tsconfig['ts-node']) {
        tsconfig = {
          ...tsconfig,
          ...tsconfig['ts-node'],
          compilerOptions: {
            // eslint-disable-next-line unicorn/no-useless-fallback-in-spread
            ...(tsconfig.compilerOptions ?? {}),
            // eslint-disable-next-line unicorn/no-useless-fallback-in-spread
            ...(tsconfig['ts-node'].compilerOptions ?? {}),
          },
        };
      }
    } catch (error) {
      console.error("Can't load tsconfig.json:", error);
    }

    const tsnode = tryRequire<typeof import('ts-node')>('ts-node');
    if (!tsnode) {
      console.error("For TypeScript support, please install 'ts-node' module");
    }

    if (tsconfig && tsnode) {
      tsnode.register(tsconfig);
      if (!MIGRATIONS_FILE_LANGUAGE) {
        MIGRATIONS_FILE_LANGUAGE = 'ts';
      }
    } else {
      process.exit(1);
    }
  }
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

function isClientConfig(val: unknown): val is ClientConfig & { name?: string } {
  return (
    typeof val === 'object' &&
    val !== null &&
    (('host' in val &&
      // @ts-expect-error: this is a TS 4.8 bug
      !!val.host) ||
      ('port' in val &&
        // @ts-expect-error: this is a TS 4.8 bug
        !!val.port) ||
      ('name' in val &&
        // @ts-expect-error: this is a TS 4.8 bug
        !!val.name) ||
      ('database' in val &&
        // @ts-expect-error: this is a TS 4.8 bug
        !!val.database))
  );
}

function readJson(json: unknown): void {
  if (typeof json === 'object' && json !== null) {
    SCHEMA = applyIf(SCHEMA, schemaArg, json, (val): val is string[] =>
      Array.isArray(val)
    );
    CREATE_SCHEMA = applyIf(CREATE_SCHEMA, createSchemaArg, json, isBoolean);
    MIGRATIONS_DIR = applyIf(MIGRATIONS_DIR, migrationsDirArg, json, isString);
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
      (val): val is 'js' | 'ts' | 'sql' =>
        val === 'js' || val === 'ts' || val === 'sql'
    );
    MIGRATIONS_FILENAME_FORMAT = applyIf(
      MIGRATIONS_FILENAME_FORMAT,
      migrationFilenameFormatArg,
      json,
      (val): val is `${FilenameFormat}` => val === 'timestamp' || val === 'utc'
    );
    TEMPLATE_FILE_NAME = applyIf(
      TEMPLATE_FILE_NAME,
      templateFileNameArg,
      json,
      isString
    );
    IGNORE_PATTERN = applyIf(IGNORE_PATTERN, ignorePatternArg, json, isString);
    CHECK_ORDER = applyIf(CHECK_ORDER, checkOrderArg, json, isBoolean);
    VERBOSE = applyIf(VERBOSE, verboseArg, json, isBoolean);
    DECAMELIZE = applyIf(DECAMELIZE, decamelizeArg, json, isBoolean);
    DB_CONNECTION = applyIf(
      DB_CONNECTION,
      databaseUrlVarArg,
      json,
      (val): val is string | ConnectionParameters | ClientConfig =>
        typeof val === 'string' || typeof val === 'object'
    );
    tsconfigPath = applyIf(tsconfigPath, tsconfigArg, json, isString);

    // @ts-expect-error: this is a TS 4.8 bug
    if ('url' in json && json.url) {
      // @ts-expect-error: this is a TS 4.8 bug
      DB_CONNECTION ??= json.url;
    } else if (isClientConfig(json)) {
      DB_CONNECTION ??= {
        user: json.user,
        host: json.host || 'localhost',
        database: json.name || json.database,
        password: json.password,
        port: json.port || 5432,
        ssl: json.ssl,
      };
    }
  } else {
    DB_CONNECTION ??= json as string | ConnectionParameters | ClientConfig;
  }
}

// Load config (and suppress the no-config-warning)
const oldSuppressWarning = process.env.SUPPRESS_NO_CONFIG_WARNING;
process.env.SUPPRESS_NO_CONFIG_WARNING = 'yes';
const config = tryRequire<typeof import('config')>('config');
if (config && config.has(argv[configValueArg])) {
  const db = config.get(argv[configValueArg]);
  readJson(db);
}

process.env.SUPPRESS_NO_CONFIG_WARNING = oldSuppressWarning;

const configFileName: string | undefined = argv[configFileArg];
if (configFileName) {
  const jsonConfig = require(resolve(configFileName));
  readJson(jsonConfig);
}

readTsconfig();

const action = argv._.shift();

// defaults
MIGRATIONS_DIR ??= `${process.cwd()}/migrations`;
MIGRATIONS_FILE_LANGUAGE ??= 'js';
MIGRATIONS_FILENAME_FORMAT ??= 'timestamp';
MIGRATIONS_TABLE ??= 'pgmigrations';
SCHEMA ??= ['public'];
IGNORE_PATTERN ??= '\\..*';
CHECK_ORDER ??= true;
VERBOSE ??= true;

if (action === 'create') {
  // replaces spaces with dashes - should help fix some errors
  let newMigrationName = argv._.length > 0 ? argv._.join('-') : '';
  // forces use of dashes in names - keep thing clean
  newMigrationName = newMigrationName.replace(/[ _]+/g, '-');

  if (!newMigrationName) {
    console.error("'migrationName' is required.");
    parser.showHelp();
    process.exit(1);
  }

  Migration.create(newMigrationName, MIGRATIONS_DIR, {
    filenameFormat: MIGRATIONS_FILENAME_FORMAT,
    ...(TEMPLATE_FILE_NAME
      ? { templateFileName: TEMPLATE_FILE_NAME }
      : {
          language: MIGRATIONS_FILE_LANGUAGE,
          ignorePattern: IGNORE_PATTERN,
        }),
  })
    .then((migrationPath) => {
      console.log(format('Created migration -- %s', migrationPath));
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
} else if (action === 'up' || action === 'down' || action === 'redo') {
  if (!DB_CONNECTION) {
    const cp = new ConnectionParameters();

    if (!cp.host && !cp.port && !cp.database) {
      console.error(
        `The $${argv[databaseUrlVarArg]} environment variable is not set.`
      );
      process.exit(1);
    }

    DB_CONNECTION = cp;
  }

  const dryRun = argv[dryRunArg];
  if (dryRun) {
    console.log('dry run');
  }

  const singleTransaction = argv[singleTransactionArg];
  const fake = argv[fakeArg];
  const TIMESTAMP = argv[timestampArg];
  const rejectUnauthorized = argv[rejectUnauthorizedArg];
  const noLock = !argv[lockArg];
  if (noLock) {
    console.log('no lock');
  }

  const upDownArg = argv._.length > 0 ? argv._[0] : null;
  let numMigrations: number;
  let migrationName: string;

  if (upDownArg !== null) {
    const parsedUpDownArg = Number.parseInt(`${upDownArg}`, 10);
    // eslint-disable-next-line eqeqeq
    if (parsedUpDownArg == upDownArg) {
      numMigrations = parsedUpDownArg;
    } else {
      migrationName = argv._.join('-').replace(/_ /g, '-');
    }
  }

  const databaseUrl =
    typeof DB_CONNECTION === 'string'
      ? { connectionString: DB_CONNECTION }
      : DB_CONNECTION;

  const options: (
    direction: 'up' | 'down',
    count?: number,
    timestamp?: boolean
  ) => RunnerOption = (direction, _count, _timestamp) => {
    const count = _count === undefined ? numMigrations : _count;
    const timestamp = _timestamp === undefined ? TIMESTAMP : _timestamp;

    return {
      dryRun,
      databaseUrl: {
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
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dir: MIGRATIONS_DIR!,
      ignorePattern: IGNORE_PATTERN,
      schema: SCHEMA,
      createSchema: CREATE_SCHEMA,
      migrationsSchema: MIGRATIONS_SCHEMA,
      createMigrationsSchema: CREATE_MIGRATIONS_SCHEMA,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      migrationsTable: MIGRATIONS_TABLE!,
      count,
      timestamp,
      file: migrationName,
      checkOrder: CHECK_ORDER,
      verbose: VERBOSE,
      direction,
      singleTransaction,
      noLock,
      fake,
      decamelize: DECAMELIZE,
    };
  };

  const promise =
    action === 'redo'
      ? migrationRunner(options('down')).then(() =>
          migrationRunner(options('up', Number.POSITIVE_INFINITY, false))
        )
      : migrationRunner(options(action));
  promise
    .then(() => {
      console.log('Migrations complete!');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
} else {
  console.error('Invalid Action: Must be [up|down|create|redo].');
  parser.showHelp();
  process.exit(1);
}

if (argv['force-exit']) {
  console.log('Forcing exit');
  process.exit(0);
}
