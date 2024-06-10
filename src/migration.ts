/*
 A new Migration is instantiated for each migration file.

 It is responsible for storing the name of the file and knowing how to execute
 the up and down migrations defined in the file.

 */

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, extname, join, resolve } from 'node:path';
import type { QueryResult } from 'pg';
import type { DBConnection } from './db';
import MigrationBuilder from './migrationBuilder';
import type { ColumnDefinitions } from './operations/tables';
import type {
  Logger,
  MigrationAction,
  MigrationBuilderActions,
  MigrationDirection,
  RunnerOption,
} from './types';
import { getMigrationTableSchema } from './utils';

export interface RunMigration {
  readonly path: string;
  readonly name: string;
  readonly timestamp: number;
}

export enum FilenameFormat {
  timestamp = 'timestamp',
  utc = 'utc',
}

export interface CreateOptionsTemplate {
  templateFileName: string;
}

export interface CreateOptionsDefault {
  language?: 'js' | 'ts' | 'sql';
  ignorePattern?: string;
}

export type CreateOptions = {
  filenameFormat?: FilenameFormat | `${FilenameFormat}`;
} & (CreateOptionsTemplate | CreateOptionsDefault);

const SEPARATOR = '_';

export async function loadMigrationFiles(
  dir: string,
  ignorePattern?: string
): Promise<string[]> {
  const dirContent = await readdir(`${dir}/`, { withFileTypes: true });
  const files = dirContent
    .map((file) => (file.isFile() || file.isSymbolicLink() ? file.name : null))
    .filter((file): file is string => Boolean(file))
    .sort();
  const filter = new RegExp(`^(${ignorePattern})$`);
  return ignorePattern === undefined
    ? files
    : files.filter((i) => !filter.test(i));
}

function getSuffixFromFileName(fileName: string): string {
  return extname(fileName).slice(1);
}

async function getLastSuffix(
  dir: string,
  ignorePattern?: string
): Promise<string | undefined> {
  try {
    const files = await loadMigrationFiles(dir, ignorePattern);
    return files.length > 0
      ? getSuffixFromFileName(files[files.length - 1])
      : undefined;
  } catch {
    return undefined;
  }
}

export function getTimestamp(logger: Logger, filename: string): number {
  const prefix = filename.split(SEPARATOR)[0];
  if (prefix && /^\d+$/.test(prefix)) {
    if (prefix.length === 13) {
      // timestamp: 1391877300255
      return Number(prefix);
    }

    if (prefix && prefix.length === 17) {
      // utc: 20200513070724505
      const year = prefix.slice(0, 4);
      const month = prefix.slice(4, 6);
      const date = prefix.slice(6, 8);
      const hours = prefix.slice(8, 10);
      const minutes = prefix.slice(10, 12);
      const seconds = prefix.slice(12, 14);
      const ms = prefix.slice(14, 17);
      return new Date(
        `${year}-${month}-${date}T${hours}:${minutes}:${seconds}.${ms}Z`
      ).valueOf();
    }
  }

  logger.error(`Can't determine timestamp for ${prefix}`);
  return Number(prefix) || 0;
}

async function resolveSuffix(
  directory: string,
  options: CreateOptionsDefault
): Promise<string> {
  const { language, ignorePattern } = options;
  return language || (await getLastSuffix(directory, ignorePattern)) || 'js';
}

export class Migration implements RunMigration {
  // class method that creates a new migration file by cloning the migration template
  static async create(
    name: string,
    directory: string,
    options: CreateOptions = {}
  ): Promise<string> {
    const { filenameFormat = FilenameFormat.timestamp } = options;

    // ensure the migrations directory exists
    await mkdir(directory, { recursive: true });

    const now = new Date();
    const time =
      filenameFormat === FilenameFormat.utc
        ? now.toISOString().replace(/\D/g, '')
        : now.valueOf();

    const crossRequire = createRequire(
      // @ts-expect-error: ignore until esm only
      import.meta.url || __dirname
    );
    const moduleDir = dirname(
      crossRequire.resolve('node-pg-migrate/package.json')
    );

    const templateFileName =
      'templateFileName' in options
        ? resolve(process.cwd(), options.templateFileName)
        : resolve(
            moduleDir,
            join(
              '..',
              'templates',
              `migration-template.${await resolveSuffix(directory, options)}`
            )
          );
    const suffix = getSuffixFromFileName(templateFileName);

    // file name looks like migrations/1391877300255_migration-title.js
    const newFile = `${directory}/${time}${SEPARATOR}${name}.${suffix}`;

    // copy the default migration template to the new file location
    await new Promise((resolve, reject) => {
      createReadStream(templateFileName)
        .pipe(createWriteStream(newFile))
        .on('close', resolve)
        .on('error', reject);
    });

    return newFile;
  }

  public readonly db: DBConnection;

  public readonly path: string;

  public readonly name: string;

  public readonly timestamp: number;

  public up?: false | MigrationAction;

  public down?: false | MigrationAction;

  public readonly options: RunnerOption;

  public readonly typeShorthands?: ColumnDefinitions;

  public readonly logger: Logger;

  constructor(
    db: DBConnection,
    migrationPath: string,
    { up, down }: MigrationBuilderActions,
    options: RunnerOption,
    typeShorthands?: ColumnDefinitions,
    logger: Logger = console
  ) {
    this.db = db;
    this.path = migrationPath;
    this.name = basename(migrationPath, extname(migrationPath));
    this.timestamp = getTimestamp(logger, this.name);
    this.up = up;
    this.down = down;
    this.options = options;
    this.typeShorthands = typeShorthands;
    this.logger = logger;
  }

  _getMarkAsRun(action: MigrationAction): string {
    const schema = getMigrationTableSchema(this.options);

    const { migrationsTable } = this.options;
    const { name } = this;

    switch (action) {
      case this.down: {
        this.logger.info(`### MIGRATION ${this.name} (DOWN) ###`);
        return `DELETE FROM "${schema}"."${migrationsTable}" WHERE name='${name}';`;
      }

      case this.up: {
        this.logger.info(`### MIGRATION ${this.name} (UP) ###`);
        return `INSERT INTO "${schema}"."${migrationsTable}" (name, run_on) VALUES ('${name}', NOW());`;
      }

      default: {
        throw new Error('Unknown direction');
      }
    }
  }

  async _apply(
    action: MigrationAction,
    pgm: MigrationBuilder
  ): Promise<unknown> {
    if (action.length === 2) {
      await new Promise<void>((resolve) => {
        action(pgm, resolve);
      });
    } else {
      await action(pgm);
    }

    const sqlSteps = pgm.getSqlSteps();

    sqlSteps.push(this._getMarkAsRun(action));

    if (!this.options.singleTransaction && pgm.isUsingTransaction()) {
      // if not in singleTransaction mode we need to create our own transaction
      sqlSteps.unshift('BEGIN;');
      sqlSteps.push('COMMIT;');
    } else if (this.options.singleTransaction && !pgm.isUsingTransaction()) {
      // in singleTransaction mode we are already wrapped in a global transaction
      this.logger.warn('#> WARNING: Need to break single transaction! <');
      sqlSteps.unshift('COMMIT;');
      sqlSteps.push('BEGIN;');
    } else if (!this.options.singleTransaction || !pgm.isUsingTransaction()) {
      this.logger.warn(
        '#> WARNING: This migration is not wrapped in a transaction! <'
      );
    }

    if (typeof this.logger.debug === 'function') {
      this.logger.debug(`${sqlSteps.join('\n')}\n\n`);
    }

    return sqlSteps.reduce<Promise<unknown>>(
      (promise, sql) =>
        promise.then((): unknown => this.options.dryRun || this.db.query(sql)),
      Promise.resolve()
    );
  }

  _getAction(direction: MigrationDirection): MigrationAction {
    if (direction === 'down' && this.down === undefined) {
      this.down = this.up;
    }

    const action: MigrationAction | false | undefined = this[direction];

    if (action === false) {
      throw new Error(
        `User has disabled ${direction} migration on file: ${this.name}`
      );
    }

    if (typeof action !== 'function') {
      throw new Error(
        `Unknown value for direction: ${direction}. Is the migration ${this.name} exporting a '${direction}' function?`
      );
    }

    return action;
  }

  apply(direction: MigrationDirection): Promise<unknown> {
    const pgm = new MigrationBuilder(
      this.db,
      this.typeShorthands,
      Boolean(this.options.decamelize),
      this.logger
    );
    const action = this._getAction(direction);

    if (this.down === this.up) {
      // automatically infer the down migration by running the up migration in reverse mode...
      pgm.enableReverseMode();
    }

    return this._apply(action, pgm);
  }

  markAsRun(direction: MigrationDirection): Promise<QueryResult> {
    return this.db.query(this._getMarkAsRun(this._getAction(direction)));
  }
}
